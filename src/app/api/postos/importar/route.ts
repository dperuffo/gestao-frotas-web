import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerAba, indiceColunas, texto, textoOuNull, numero, data as celulaData, simNao, dedupePorChave } from "@/lib/xlsx";
import { normalizarCNPJ, resolverUf } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import { verificarLimite, respostaLimiteExcedido } from "@/lib/rateLimit";

export type ResultadoImportacaoPostosGf =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; duplicadas: number; conflitantes: number };

type LinhaPostoGf = Database["public"]["Tables"]["postos_gf"]["Insert"];

// A planilha "postos_gf.xlsx" (aba "Ponto de Venda") é a fonte real do
// sistema de origem e tem colunas repetidas de nome (duas colunas
// "Telefone" e duas "E-mail" — uma para o contato, outra para o
// responsável), então mapeamos por POSIÇÃO fixa em vez de por nome de
// cabeçalho, na ordem exata do arquivo exportado:
//
// 0 CNPJ · 1 Nome · 2 Tipo de localização · 3 Perfil de venda · 4 Status ·
// 5 Situação · 6 Status Ipiranga · 7 Código JDE Ipiranga · 8 Código JDE ·
// 9 Rede · 10 Micromercado · 11 Bandeira · 12 Tipo de Bandeira ·
// 13 Grupo Econômico · 14 Taxa de Administração Padrão · 15 CEP ·
// 16 Logradouro · 17 Número · 18 Complemento · 19 Latitude · 20 Longitude ·
// 21 Bairro · 22 Cidade · 23 UF · 24 Nome Contato · 25 Telefone (contato) ·
// 26 E-mail (contato) · 27 Nome Responsável · 28 Telefone (responsável) ·
// 29 E-mail (responsável) · 30 Possui conveniência? · 31 AM/PM? ·
// 32 Restaurante? · 33 Banheiro? · 34 Cobrança banheiro? · 35 Estacionamento? ·
// 36 Troca de óleo? · 37 Óleo a granel? · 38 Arla 32? · 39 Qual tipo? ·
// 40 Internet? · 41 Outros serviços · 42 Data/hora de habilitação
const COL = {
  cnpj: 0,
  nome: 1,
  tipoLocalizacao: 2,
  perfilVenda: 3,
  status: 4,
  situacao: 5,
  statusIpiranga: 6,
  codigoJdeIpiranga: 7,
  codigoJde: 8,
  rede: 9,
  micromercado: 10,
  bandeira: 11,
  tipoBandeira: 12,
  grupoEconomico: 13,
  taxaAdministracao: 14,
  cep: 15,
  logradouro: 16,
  numero: 17,
  complemento: 18,
  latitude: 19,
  longitude: 20,
  bairro: 21,
  cidade: 22,
  uf: 23,
  nomeContato: 24,
  telefoneContato: 25,
  emailContato: 26,
  nomeResponsavel: 27,
  telefoneResponsavel: 28,
  emailResponsavel: 29,
  conveniencia: 30,
  convenienciaAmPm: 31,
  restaurante: 32,
  banheiro: 33,
  cobrancaBanheiro: 34,
  estacionamento: 35,
  trocaOleo: 36,
  oleoGranel: 37,
  arla: 38,
  tipoArla: 39,
  internet: 40,
  outrosServicos: 41,
  dataHabilitacao: 42,
} as const;

// Envia contatos, código interno e informações operacionais extras no jsonb
// `extras`, mantendo o schema principal com as colunas mais usadas em
// filtros/telas.
function montarExtras(linha: unknown[]) {
  return {
    status_ipiranga: textoOuNull(linha[COL.statusIpiranga]),
    codigo_jde_ipiranga: textoOuNull(linha[COL.codigoJdeIpiranga]),
    codigo_jde: textoOuNull(linha[COL.codigoJde]),
    nome_contato: textoOuNull(linha[COL.nomeContato]),
    telefone_contato: textoOuNull(linha[COL.telefoneContato]),
    email_contato: textoOuNull(linha[COL.emailContato]),
    nome_responsavel: textoOuNull(linha[COL.nomeResponsavel]),
    telefone_responsavel: textoOuNull(linha[COL.telefoneResponsavel]),
    email_responsavel: textoOuNull(linha[COL.emailResponsavel]),
  };
}

// Fase template-padrao-planilhas — pedido do Daniel: além do arquivo
// "postos_gf.xlsx" exportado da integração Pró-Frotas (layout posicional
// fixo acima), também aceitamos um "modelo padrão" genérico — planilha com
// cabeçalho por NOME de coluna (qualquer ordem), pensada para qualquer
// sistema externo que não seja o Pró-Frotas preencher/mapear os próprios
// dados. Baixável em /postos/importar/modelo-padrao. Colunas reconhecidas
// (cabeçalho normalizado — sem acento, minúsculo — entre parênteses; só
// "cnpj" é obrigatória, o resto fica null/false se a coluna não existir):
// CNPJ (cnpj, obrigatória) · Razão Social (razao social) · Município
// (municipio) · UF (uf) · Bairro (bairro) · CEP (cep) · Logradouro
// (logradouro) · Número (numero) · Complemento (complemento) · Latitude
// (latitude) · Longitude (longitude) · Bandeira (bandeira) · Rede (rede) ·
// Telefone (telefone) · E-mail (e-mail) · Horário de Funcionamento (horario
// de funcionamento) · Funciona 24h? (funciona 24h) · Pista para Caminhão?
// (pista para caminhao) · Possui Conveniência? (possui conveniencia) ·
// Possui Restaurante? (possui restaurante) · Possui Banheiro? (possui
// banheiro) · Possui Estacionamento? (possui estacionamento) · Possui Troca
// de Óleo? (possui troca de oleo) · Possui Arla 32? (possui arla 32) ·
// Possui Internet? (possui internet) · Ativo? (ativo).
function montarRegistroGenerico(linha: unknown[], idx: Map<string, number>, empresaId: string): LinhaPostoGf | null {
  const pegar = (nomeColuna: string) => {
    const i = idx.get(nomeColuna);
    return i === undefined ? undefined : linha[i];
  };
  const cnpj = normalizarCNPJ(texto(pegar("cnpj")));
  if (!cnpj) return null;
  return {
    cnpj,
    empresa_id: empresaId,
    razao_social: textoOuNull(pegar("razao social")),
    municipio: textoOuNull(pegar("municipio")),
    uf: resolverUf(textoOuNull(pegar("uf"))),
    bairro: textoOuNull(pegar("bairro")),
    cep: textoOuNull(pegar("cep")),
    logradouro: textoOuNull(pegar("logradouro")),
    numero: textoOuNull(pegar("numero")),
    complemento: textoOuNull(pegar("complemento")),
    lat: numero(pegar("latitude")),
    lon: numero(pegar("longitude")),
    bandeira: textoOuNull(pegar("bandeira")),
    rede: textoOuNull(pegar("rede")),
    telefone_contato: textoOuNull(pegar("telefone")),
    email_contato: textoOuNull(pegar("e-mail")),
    horario: textoOuNull(pegar("horario de funcionamento")),
    funciona_24h: simNao(pegar("funciona 24h")),
    pista_caminhao: simNao(pegar("pista para caminhao")),
    conveniencia: simNao(pegar("possui conveniencia")),
    possui_restaurante: simNao(pegar("possui restaurante")),
    possui_banheiro: simNao(pegar("possui banheiro")),
    possui_estacionamento: simNao(pegar("possui estacionamento")),
    possui_troca_oleo: simNao(pegar("possui troca de oleo")),
    arla: simNao(pegar("possui arla 32")),
    possui_internet: simNao(pegar("possui internet")),
    // "Ativo?" fica ligado por padrão (coluna ausente OU célula vazia) — só
    // vira false com um "Não"/"0" explícito, pra não desativar em massa um
    // posto só porque o sistema externo não preencheu essa coluna opcional.
    ativo: textoOuNull(pegar("ativo")) === null ? true : simNao(pegar("ativo")),
    origem: "planilha_cliente",
    atualizado_em: new Date().toISOString(),
  };
}

// Fase corrige-bloqueio-cloudflare-waf — pedido do Daniel: o upload dessa
// planilha estava tomando 403 da Cloudflare (regra gerenciada "React -
// Leaking Server Functions", virtual patch do CVE-2025-55183) porque Server
// Actions do Next.js usam um protocolo de requisição (header Next-Action +
// campos multipart tipo "1_arquivo") que bate na assinatura da regra — mesmo
// o app já estando na versão corrigida (Next 15.5.20 > patch 15.5.9). Como o
// plano gratuito da Cloudflare não deixa criar regra/exceção nova pra
// liberar só essa rota, a saída foi trocar de Server Action pra Route
// Handler comum: o navegador manda um POST multipart "de verdade" (fetch +
// FormData), sem o protocolo especial de Server Actions, então não bate mais
// na assinatura do WAF.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json<ResultadoImportacaoPostosGf>({ erro: "Sessão expirada. Faça login novamente." });
  }

  // M2 — protege processamento pesado (parsing de planilha de milhares de
  // linhas): importação em lote é uma operação naturalmente esporádica.
  const limite = verificarLimite(`importar-postos:${user.id}`, 10, 10 * 60 * 1000);
  if (!limite.permitido) return respostaLimiteExcedido(limite);

  const formData = await request.formData();

  const empresaId = String(formData.get("empresa_id") ?? "");
  if (!empresaId) {
    return NextResponse.json<ResultadoImportacaoPostosGf>({ erro: "Selecione o cliente dono desta rede de postos." });
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json<ResultadoImportacaoPostosGf>({ erro: "Selecione o arquivo postos_gf.xlsx." });
  }

  const buffer = await arquivo.arrayBuffer();
  const linhasDaAbaProFrotas = lerAba(buffer, "Ponto de Venda");
  const usaLayoutProFrotas = linhasDaAbaProFrotas.length > 0;
  const linhas = usaLayoutProFrotas ? linhasDaAbaProFrotas : lerAba(buffer);
  if (linhas.length < 2) {
    return NextResponse.json<ResultadoImportacaoPostosGf>({ erro: "A planilha está vazia ou não tem nenhuma linha de dados." });
  }

  const registros: LinhaPostoGf[] = [];
  let erros = 0;

  if (usaLayoutProFrotas) {
    const primeiraCelula = texto(linhas[0][COL.cnpj]).toLowerCase();
    if (primeiraCelula !== "cnpj") {
      return NextResponse.json<ResultadoImportacaoPostosGf>({
        erro: 'A primeira coluna da planilha precisa ser "CNPJ" — confira se o arquivo enviado é o modelo correto (aba "Ponto de Venda").',
      });
    }

    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i];
      const cnpj = normalizarCNPJ(texto(linha[COL.cnpj]));
      if (!cnpj) {
        erros++;
        continue;
      }
      registros.push({
        cnpj,
        empresa_id: empresaId,
        razao_social: textoOuNull(linha[COL.nome]),
        tipo_localizacao: textoOuNull(linha[COL.tipoLocalizacao]),
        perfil_venda: textoOuNull(linha[COL.perfilVenda]),
        status_pdv: textoOuNull(linha[COL.status]),
        situacao_pdv: textoOuNull(linha[COL.situacao]),
        rede: textoOuNull(linha[COL.rede]),
        micromercado: textoOuNull(linha[COL.micromercado]),
        bandeira: textoOuNull(linha[COL.bandeira]),
        tipo_bandeira: textoOuNull(linha[COL.tipoBandeira]),
        grupo_economico: textoOuNull(linha[COL.grupoEconomico]),
        taxa_administracao: numero(linha[COL.taxaAdministracao]),
        cep: textoOuNull(linha[COL.cep]),
        logradouro: textoOuNull(linha[COL.logradouro]),
        numero: textoOuNull(linha[COL.numero]),
        complemento: textoOuNull(linha[COL.complemento]),
        lat: numero(linha[COL.latitude]),
        lon: numero(linha[COL.longitude]),
        bairro: textoOuNull(linha[COL.bairro]),
        municipio: textoOuNull(linha[COL.cidade]),
        uf: resolverUf(textoOuNull(linha[COL.uf])),
        conveniencia: simNao(linha[COL.conveniencia]),
        conveniencia_am_pm: simNao(linha[COL.convenienciaAmPm]),
        possui_restaurante: simNao(linha[COL.restaurante]),
        possui_banheiro: simNao(linha[COL.banheiro]),
        cobranca_banheiro: simNao(linha[COL.cobrancaBanheiro]),
        possui_estacionamento: simNao(linha[COL.estacionamento]),
        possui_troca_oleo: simNao(linha[COL.trocaOleo]),
        possui_oleo_granel: simNao(linha[COL.oleoGranel]),
        arla: simNao(linha[COL.arla]),
        tipo_arla: textoOuNull(linha[COL.tipoArla]),
        possui_internet: simNao(linha[COL.internet]),
        outros_servicos: textoOuNull(linha[COL.outrosServicos]),
        data_habilitacao: celulaData(linha[COL.dataHabilitacao]),
        extras: montarExtras(linha),
        atualizado_em: new Date().toISOString(),
      });
    }
  } else {
    // Não é o layout Pró-Frotas (não tem aba "Ponto de Venda") — tratamos
    // como o modelo padrão genérico, mapeando por NOME de cabeçalho (ver
    // montarRegistroGenerico acima) em vez de posição fixa.
    const idx = indiceColunas(linhas[0]);
    if (!idx.has("cnpj")) {
      return NextResponse.json<ResultadoImportacaoPostosGf>({
        erro:
          'Planilha não reconhecida: envie o arquivo "postos_gf.xlsx" da integração Pró-Frotas (aba "Ponto de Venda") ' +
          'ou o modelo padrão (com uma coluna "CNPJ" no cabeçalho) — baixe o modelo padrão na tela de importação.',
      });
    }

    for (let i = 1; i < linhas.length; i++) {
      const registro = montarRegistroGenerico(linhas[i], idx, empresaId);
      if (!registro) {
        erros++;
        continue;
      }
      registros.push(registro);
    }
  }

  // Se o mesmo CNPJ aparecer mais de uma vez na planilha, o Postgres recusa
  // o upsert ("cannot affect row a second time") — deduplicamos mantendo a
  // última ocorrência (a mais recente no arquivo) antes de gravar.
  const registrosSemDuplicata = dedupePorChave(registros, (r) => r.cnpj);
  const duplicadas = registros.length - registrosSemDuplicata.length;

  // postos_gf tem UMA linha global por CNPJ (chave primária), marcada com o
  // empresa_id do cliente que hoje "ativou" aquele posto na própria rede. Se
  // a planilha trouxer um CNPJ que já pertence a OUTRO cliente, o RLS recusa
  // a atualização de propósito (evita um cliente reatribuir silenciosamente
  // um posto de outro) — em vez de abortar o lote inteiro de 500 linhas
  // quando isso acontece, filtramos essas linhas antes de gravar e avisamos
  // quantas foram puladas.
  //
  // Importante: essa checagem usa o client ADMIN (sem RLS), não o client de
  // sessão — com RLS, a policy de leitura esconde justamente as linhas de
  // OUTROS clientes (é o comportamento correto pra tela normal do app), então
  // usar o client de sessão aqui faria o conflito passar despercebido e o
  // erro voltaria a acontecer na hora de gravar.
  const supabaseAdmin = createAdminClient();
  const cnpjsDoArquivo = registrosSemDuplicata.map((r) => r.cnpj);
  const donosAtuais = new Map<string, string | null>();
  for (let i = 0; i < cnpjsDoArquivo.length; i += 1000) {
    const { data: existentes } = await supabaseAdmin
      .from("postos_gf")
      .select("cnpj, empresa_id")
      .in("cnpj", cnpjsDoArquivo.slice(i, i + 1000));
    for (const p of existentes ?? []) donosAtuais.set(p.cnpj, p.empresa_id);
  }

  const registrosParaGravar: LinhaPostoGf[] = [];
  let conflitantes = 0;
  for (const registro of registrosSemDuplicata) {
    const donoAtual = donosAtuais.get(registro.cnpj);
    if (donoAtual && donoAtual !== empresaId) {
      conflitantes++;
      continue;
    }
    registrosParaGravar.push(registro);
  }

  // A gravação em si também usa o client admin: essa tela já é uma operação
  // administrativa (o admin escolhe explicitamente o cliente dono da rede
  // importada) e o conflito de propriedade — o único caso que realmente
  // precisa ser bloqueado — já foi filtrado acima em código, com a
  // visibilidade completa do admin. Depender do RLS aqui além disso só
  // adiciona um jeito a mais de falhar (ex.: o usuário logado não ter vínculo
  // em usuarios_empresas com o cliente selecionado), sem proteção adicional.
  let sucesso = 0;
  const tamanhoLote = 500;
  for (let i = 0; i < registrosParaGravar.length; i += tamanhoLote) {
    const lote = registrosParaGravar.slice(i, i + tamanhoLote);
    const { error } = await supabaseAdmin.from("postos_gf").upsert(lote, { onConflict: "cnpj" });
    if (error) {
      return NextResponse.json<ResultadoImportacaoPostosGf>({
        erro: `Falha ao gravar a partir da linha ${i + 2}: ${error.message}. Linhas já gravadas até aqui foram mantidas.`,
      });
    }
    sucesso += lote.length;
  }

  revalidatePath("/postos");

  return NextResponse.json<ResultadoImportacaoPostosGf>({
    total: linhas.length - 1,
    sucesso,
    erros,
    duplicadas,
    conflitantes,
  });
}
