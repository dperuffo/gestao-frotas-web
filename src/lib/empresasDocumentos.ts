import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type ClienteSupabase = SupabaseClient<Database>;

// Fase 27.149 — pedido do Daniel: mecanismo de upload de documentos
// societários/cadastrais (Contrato Social, documentos pessoais dos sócios,
// comprovante de endereço da empresa) pra checagem e liberação pelo admin.
// Vale pra TODO posto/cliente da plataforma: documentação aprovada é
// pré-requisito pra (a) criar uma Rede de Postos/Grupo Econômico, (b) ser
// vinculado como novo membro a um grupo já existente, (c) posto aceitar uma
// negociação, (d) cliente criar uma negociação — mesmo espírito do gate de
// assinatura obrigatória já usado em decidirNegociacao (Fase 27.125):
// checagem em código, ANTES de qualquer escrita, mensagem pronta pra
// mostrar ao usuário (ver exigirDocumentacaoAprovada, abaixo).
//
// Esta lib centraliza a escrita/leitura da documentação, usada tanto pela
// tela self-service (/documentos, posto e cliente) quanto pela fila de
// revisão do admin (/documentos-empresas) e pelos 4 pontos de bloqueio
// citados acima.

export const BUCKET_DOCUMENTOS_EMPRESAS = "documentos-empresas";

// Fase 27.149 — documentos a nível de EMPRESA (não têm sócio associado):
// Contrato Social/Estatuto (precisa estar registrado na Junta Comercial e
// explicitar o quadro societário) e comprovante de endereço do
// estabelecimento (IPTU, conta de consumo).
export const TIPOS_DOCUMENTO_EMPRESA = ["contrato_social", "comprovante_endereco_empresa"] as const;
export type TipoDocumentoEmpresa = (typeof TIPOS_DOCUMENTO_EMPRESA)[number];

// Documentos POR SÓCIO — cada sócio da lista dinâmica (empresas_socios)
// precisa enviar os 3: CPF, identidade (RG ou CNH — qualquer um dos dois
// serve, por isso um único tipo "socio_identidade") e comprovante de
// endereço pessoal atualizado.
export const TIPOS_DOCUMENTO_SOCIO = ["socio_cpf", "socio_identidade", "socio_comprovante_endereco"] as const;
export type TipoDocumentoSocio = (typeof TIPOS_DOCUMENTO_SOCIO)[number];

export type TipoDocumento = TipoDocumentoEmpresa | TipoDocumentoSocio;

export const LABEL_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  contrato_social: "Contrato Social ou Estatuto (com quadro societário)",
  comprovante_endereco_empresa: "Comprovante de endereço da empresa (IPTU, conta de consumo...)",
  socio_cpf: "CPF",
  socio_identidade: "RG ou CNH",
  socio_comprovante_endereco: "Comprovante de endereço",
};

export const STATUS_DOCUMENTACAO = ["nao_iniciada", "pendente", "aprovada", "rejeitada"] as const;
export type StatusDocumentacao = (typeof STATUS_DOCUMENTACAO)[number];

export const LABEL_STATUS_DOCUMENTACAO: Record<StatusDocumentacao, string> = {
  nao_iniciada: "Documentação não iniciada",
  pendente: "Em análise pelo admin",
  aprovada: "Documentação aprovada",
  rejeitada: "Documentação rejeitada",
};

export type Socio = { id: string; nome: string; cpf: string };

export type DocumentoEmpresa = {
  id: string;
  tipo: TipoDocumento;
  socioId: string | null;
  nomeArquivo: string;
  storagePath: string;
  enviadoEm: string;
};

export type SituacaoDocumentacao = {
  socios: Socio[];
  documentos: DocumentoEmpresa[];
  status: StatusDocumentacao;
  motivoRejeicao: string | null;
  enviadaEm: string | null;
  revisadoEm: string | null;
};

async function ehAdminOuSuperusuario(supabase: ClienteSupabase): Promise<boolean> {
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return perfil === "admin" || user?.email === "d.peruffo@gmail.com";
}

// Path convencionado {empresa_id}/{tipo}[-{socio_id}].{ext} — mesmo padrão
// já usado no bucket "termos-adesao" (RLS de storage.objects casa pelo 1º
// segmento do path com empresas_do_usuario). Reenvio usa o MESMO path
// (upsert:true no .upload()), então nunca acumula arquivo órfão.
function caminhoStorage(empresaId: string, tipo: TipoDocumento, socioId: string | null, nomeOriginal: string): string {
  const ponto = nomeOriginal.lastIndexOf(".");
  const ext = ponto >= 0 ? nomeOriginal.slice(ponto) : "";
  const sufixo = socioId ? `${tipo}-${socioId}` : tipo;
  return `${empresaId}/${sufixo}${ext}`;
}

export async function listarDocumentacao(supabase: ClienteSupabase, empresaId: string): Promise<SituacaoDocumentacao> {
  const [{ data: socios }, { data: documentos }, { data: empresa }] = await Promise.all([
    supabase.from("empresas_socios").select("id, nome, cpf").eq("empresa_id", empresaId).order("criado_em"),
    supabase
      .from("empresas_documentos")
      .select("id, tipo, socio_id, nome_arquivo, storage_path, enviado_em")
      .eq("empresa_id", empresaId),
    supabase
      .from("empresas")
      .select("documentacao_status, documentacao_motivo_rejeicao, documentacao_enviada_em, documentacao_revisado_em")
      .eq("id", empresaId)
      .maybeSingle(),
  ]);

  return {
    socios: (socios ?? []).map((s) => ({ id: s.id, nome: s.nome, cpf: s.cpf })),
    documentos: (documentos ?? []).map((d) => ({
      id: d.id,
      tipo: d.tipo as TipoDocumento,
      socioId: d.socio_id,
      nomeArquivo: d.nome_arquivo,
      storagePath: d.storage_path,
      enviadoEm: d.enviado_em,
    })),
    status: (empresa?.documentacao_status as StatusDocumentacao | undefined) ?? "nao_iniciada",
    motivoRejeicao: empresa?.documentacao_motivo_rejeicao ?? null,
    enviadaEm: empresa?.documentacao_enviada_em ?? null,
    revisadoEm: empresa?.documentacao_revisado_em ?? null,
  };
}

export async function adicionarSocio(
  supabase: ClienteSupabase,
  params: { empresaId: string; nome: string; cpf: string; criadoPor: string | null }
): Promise<{ id: string } | { erro: string }> {
  const nome = params.nome.trim();
  const cpf = params.cpf.replace(/\D/g, "");
  if (!nome) return { erro: "Informe o nome do sócio." };
  if (cpf.length !== 11) return { erro: "CPF inválido — informe os 11 dígitos." };

  const { data, error } = await supabase
    .from("empresas_socios")
    .insert({ empresa_id: params.empresaId, nome, cpf, criado_por: params.criadoPor })
    .select("id")
    .single();
  if (error) return { erro: error.message };
  return { id: data.id };
}

// Remove o sócio e, junto, os documentos pessoais dele (a FK já faz cascade
// nas LINHAS; aqui só cuida de apagar os ARQUIVOS correspondentes no
// Storage antes, senão ficariam órfãos — best-effort, como o resto do
// projeto trata upload/remoção de Storage).
export async function removerSocio(supabase: ClienteSupabase, socioId: string): Promise<{ erro?: string }> {
  const { data: docs } = await supabase.from("empresas_documentos").select("storage_path").eq("socio_id", socioId);
  if (docs && docs.length > 0) {
    try {
      await supabase.storage.from(BUCKET_DOCUMENTOS_EMPRESAS).remove(docs.map((d) => d.storage_path));
    } catch {
      // best-effort
    }
  }
  const { error } = await supabase.from("empresas_socios").delete().eq("id", socioId);
  if (error) return { erro: error.message };
  return {};
}

export async function enviarDocumento(
  supabase: ClienteSupabase,
  params: { empresaId: string; tipo: TipoDocumento; socioId: string | null; arquivo: File; enviadoPor: string | null }
): Promise<{ ok: true } | { erro: string }> {
  if (params.arquivo.size === 0) return { erro: "Selecione um arquivo." };
  if (params.arquivo.size > 5 * 1024 * 1024) {
    return { erro: "Arquivo grande demais (máximo 5 MB)." };
  }
  const ehDocSocio = (TIPOS_DOCUMENTO_SOCIO as readonly string[]).includes(params.tipo);
  if (ehDocSocio && !params.socioId) return { erro: "Este documento precisa estar vinculado a um sócio." };
  if (!ehDocSocio && params.socioId) return { erro: "Este tipo de documento não é vinculado a um sócio." };

  const path = caminhoStorage(params.empresaId, params.tipo, params.socioId, params.arquivo.name);

  let queryExistente = supabase
    .from("empresas_documentos")
    .select("id, storage_path")
    .eq("empresa_id", params.empresaId)
    .eq("tipo", params.tipo);
  queryExistente = params.socioId ? queryExistente.eq("socio_id", params.socioId) : queryExistente.is("socio_id", null);
  const { data: existente } = await queryExistente.maybeSingle();

  const bytes = await params.arquivo.arrayBuffer();
  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_DOCUMENTOS_EMPRESAS)
    .upload(path, bytes, { contentType: params.arquivo.type || "application/octet-stream", upsert: true });
  if (erroUpload) return { erro: `Não foi possível enviar o arquivo: ${erroUpload.message}` };

  const linha = {
    empresa_id: params.empresaId,
    tipo: params.tipo,
    socio_id: params.socioId,
    storage_path: path,
    nome_arquivo: params.arquivo.name,
    tamanho_bytes: params.arquivo.size,
    enviado_por: params.enviadoPor,
    enviado_em: new Date().toISOString(),
  };
  const { error } = existente
    ? await supabase.from("empresas_documentos").update(linha).eq("id", existente.id)
    : await supabase.from("empresas_documentos").insert(linha);
  if (error) return { erro: error.message };
  return { ok: true };
}

export async function removerDocumento(supabase: ClienteSupabase, documentoId: string): Promise<{ erro?: string }> {
  const { data: doc } = await supabase.from("empresas_documentos").select("storage_path").eq("id", documentoId).maybeSingle();
  if (doc) {
    try {
      await supabase.storage.from(BUCKET_DOCUMENTOS_EMPRESAS).remove([doc.storage_path]);
    } catch {
      // best-effort
    }
  }
  const { error } = await supabase.from("empresas_documentos").delete().eq("id", documentoId);
  if (error) return { erro: error.message };
  return {};
}

// Regra mínima pra poder mandar pra análise: Contrato Social + comprovante
// de endereço da empresa, e pelo menos 1 sócio com os 3 documentos
// pessoais completos.
function validarDocumentacaoCompleta(socios: Socio[], documentos: DocumentoEmpresa[]): string | null {
  const tem = (tipo: TipoDocumento, socioId: string | null = null) =>
    documentos.some((d) => d.tipo === tipo && d.socioId === socioId);

  if (!tem("contrato_social")) return "Envie o Contrato Social ou Estatuto.";
  if (!tem("comprovante_endereco_empresa")) return "Envie o comprovante de endereço da empresa.";
  if (socios.length === 0) return "Cadastre pelo menos um sócio.";
  for (const s of socios) {
    if (!tem("socio_cpf", s.id)) return `Envie o CPF de ${s.nome}.`;
    if (!tem("socio_identidade", s.id)) return `Envie o RG ou CNH de ${s.nome}.`;
    if (!tem("socio_comprovante_endereco", s.id)) return `Envie o comprovante de endereço de ${s.nome}.`;
  }
  return null;
}

export async function enviarDocumentacaoParaAnalise(
  supabase: ClienteSupabase,
  empresaId: string,
  enviadoPor: string | null
): Promise<{ ok: true } | { erro: string }> {
  const { socios, documentos } = await listarDocumentacao(supabase, empresaId);
  const erroValidacao = validarDocumentacaoCompleta(socios, documentos);
  if (erroValidacao) return { erro: erroValidacao };

  const { error } = await supabase
    .from("empresas")
    .update({
      documentacao_status: "pendente",
      documentacao_enviada_em: new Date().toISOString(),
      documentacao_motivo_rejeicao: null,
    })
    .eq("id", empresaId);
  if (error) return { erro: error.message };
  void enviadoPor; // reservado — quem enviou já fica nas linhas de empresas_documentos (enviado_por)
  return { ok: true };
}

export async function revisarDocumentacao(
  supabase: ClienteSupabase,
  params: { empresaId: string; decisao: "aprovada" | "rejeitada"; motivo: string | null; revisadoPor: string | null }
): Promise<{ ok: true } | { erro: string }> {
  if (!(await ehAdminOuSuperusuario(supabase))) {
    return { erro: "Só o time administrativo (FNI) pode revisar documentação." };
  }
  if (params.decisao === "rejeitada" && !params.motivo?.trim()) {
    return { erro: "Informe o motivo da rejeição, pra a empresa saber o que corrigir." };
  }

  const { error } = await supabase
    .from("empresas")
    .update({
      documentacao_status: params.decisao,
      documentacao_revisado_em: new Date().toISOString(),
      documentacao_revisado_por: params.revisadoPor,
      documentacao_motivo_rejeicao: params.decisao === "rejeitada" ? params.motivo!.trim() : null,
    })
    .eq("id", params.empresaId);
  if (error) return { erro: error.message };
  return { ok: true };
}

// Gate reutilizável — mesmo espírito do gate de assinatura obrigatória já
// usado em decidirNegociacao (Fase 27.125): checagem em código, ANTES de
// qualquer escrita, devolve uma mensagem pronta (ou null se está tudo bem).
// `contexto` é a frase que abre a mensagem (ex: "Criar uma Rede de Postos",
// "Aceitar esta negociação").
export async function exigirDocumentacaoAprovada(
  supabase: ClienteSupabase,
  empresaId: string,
  contexto: string
): Promise<string | null> {
  const { data: empresa } = await supabase
    .from("empresas")
    .select("documentacao_status, nome")
    .eq("id", empresaId)
    .maybeSingle();
  if (!empresa) return "Empresa não encontrada.";
  if (empresa.documentacao_status === "aprovada") return null;

  const situacao =
    empresa.documentacao_status === "pendente"
      ? "está em análise pelo admin"
      : empresa.documentacao_status === "rejeitada"
        ? "foi rejeitada e precisa ser reenviada"
        : "ainda não foi enviada";

  return `${contexto} exige documentação societária aprovada — a de "${empresa.nome}" ${situacao}. Acesse Documentos para enviar/corrigir.`;
}

export async function gerarUrlAssinada(supabase: ClienteSupabase, storagePath: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from(BUCKET_DOCUMENTOS_EMPRESAS).createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
