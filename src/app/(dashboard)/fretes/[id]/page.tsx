import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PainelPropostas, type Proposta } from "../_components/PainelPropostas";
import { FormPostoRecomendado } from "../_components/FormPostoRecomendado";
import { RemoverPostoRecomendadoButton } from "../_components/RemoverPostoRecomendadoButton";
import { AvaliarMotoristaForm } from "../_components/AvaliarMotoristaForm";
import { FretesDocumentos, type CteRow, type CiotRow } from "../_components/FretesDocumentos";
import type { ParceiroSalvo } from "../_components/CteEmissaoForm";
import { MdfeCard, type MdfeAtivo, type VeiculoOpcao } from "../_components/MdfeCard";
import { RomaneioCard, type NfeCargaRow } from "../_components/RomaneioCard";
import { EntregaCard, type EntregaConfirmada } from "../_components/EntregaCard";
import { PagamentosFrete, type PagamentoFrete } from "../_components/PagamentosFrete";
import { RecolocarParaBaseCard } from "../_components/RecolocarParaBaseCard";
import { ChatFrete } from "../_components/ChatFrete";

type FreteDetalhe = {
  id: string;
  empresa_id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  // Fase Fretes-Público-Alvo (23/07/26) — alvo da solicitação no mercado
  // aberto: fora_base (rede/parceiros) ou base (motoristas próprios).
  publico_alvo: string;
  origem_label: string;
  destino_label: string;
  tipo_carga: string | null;
  peso_carga_kg: number | null;
  data_saida_prevista: string | null;
  prazo_entrega: string | null;
  km_estimado: number | null;
  valor_oferecido: number;
  motorista_id: string | null;
  coleta_rua: string | null;
  coleta_numero: string | null;
  coleta_bairro: string | null;
  coleta_cidade: string | null;
  coleta_uf: string | null;
  coleta_cep: string | null;
  coleta_referencia: string | null;
  coleta_data: string | null;
  coleta_hora: string | null;
  coleta_contato_nome: string | null;
  coleta_contato_telefone: string | null;
  entrega_rua: string | null;
  entrega_numero: string | null;
  entrega_bairro: string | null;
  entrega_cidade: string | null;
  entrega_uf: string | null;
  entrega_cep: string | null;
  entrega_referencia: string | null;
  entrega_data: string | null;
  entrega_hora: string | null;
  entrega_contato_nome: string | null;
  entrega_contato_telefone: string | null;
  carga_comprimento_m: number | null;
  carga_largura_m: number | null;
  carga_altura_m: number | null;
  veiculos_aceitos: string[] | null;
  carrocerias_aceitas: string[] | null;
};

const LABEL_STATUS: Record<string, string> = {
  disponivel: "Disponível (mercado aberto)",
  aguardando_confirmacao: "Aguardando confirmação do motorista",
  aceito: "Aceito",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  recusado: "Recusado pelo motorista",
};

export default async function FreteDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { id } = await params;
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: frete } = await supabase
    .from("fretes")
    .select(
      "id, empresa_id, titulo, descricao, status, publico_alvo, origem_label, destino_label, tipo_carga, peso_carga_kg, data_saida_prevista, prazo_entrega, km_estimado, valor_oferecido, motorista_id, coleta_rua, coleta_numero, coleta_bairro, coleta_cidade, coleta_uf, coleta_cep, coleta_referencia, coleta_data, coleta_hora, coleta_contato_nome, coleta_contato_telefone, entrega_rua, entrega_numero, entrega_bairro, entrega_cidade, entrega_uf, entrega_cep, entrega_referencia, entrega_data, entrega_hora, entrega_contato_nome, entrega_contato_telefone, carga_comprimento_m, carga_largura_m, carga_altura_m, veiculos_aceitos, carrocerias_aceitas"
    )
    .eq("id", id)
    .maybeSingle();

  if (!frete) {
    return <p className="p-4 text-sm text-slate-500">Frete não encontrado.</p>;
  }

  const freteTipado = frete as FreteDetalhe;
  const empresaId = empresaParam ?? freteTipado.empresa_id;

  const { data: propostas } = await supabase.rpc("negociacoes_frete_empresa", { p_frete_id: id });

  const emAndamentoOuConcluido = ["aceito", "em_andamento", "concluido"].includes(freteTipado.status);

  const [{ data: postos }, { data: eventos }, { data: itensParceria }, { data: avaliacoes }] = await Promise.all([
    supabase
      .from("fretes_postos_recomendados")
      .select("id, nome_posto, observacao, item_catalogo_id, criado_em")
      .eq("frete_id", id)
      .order("ordem"),
    supabase
      .from("fretes_eventos")
      .select("id, tipo_evento, observacao, criado_em, foto_path, codigo_ocorrencia")
      .eq("frete_id", id)
      .order("criado_em"),
    supabase
      .from("fidelidade_catalogo_itens")
      .select("id, titulo, parceiro_nome")
      .eq("categoria", "conveniencia_posto")
      .eq("ativo", true),
    supabase.from("fretes_avaliacoes").select("avaliador, estrelas, comentario").eq("frete_id", id),
  ]);

  // Fase Fretes-Adiantamento-Combustível (19/07) — parcelas de pagamento
  // (adiantamento/saldo_final), geradas automaticamente pelo banco quando
  // o frete vira "aceito" (ver trg_gerar_pagamentos_frete).
  const { data: pagamentosData } = await supabase
    .from("fretes_pagamentos")
    .select("id, tipo, percentual, valor, status, pago_em")
    .eq("frete_id", id)
    .order("tipo");
  const pagamentos = (pagamentosData ?? []) as PagamentoFrete[];

  // Fase Fretes-CIOT-CTe (18/07) — documentos registrados pro frete (não
  // emitidos por aqui, ver comentário em src/lib/cte.ts). Bucket
  // fretes-documentos é privado, então geramos signed URL por arquivo (1h),
  // mesmo padrão já usado pras fotos de evidência acima.
  const [{ data: ctesData }, { data: ciotsData }, { data: fiscalData }, { data: parceirosData }, { data: mdfeData }, { data: veiculosData }, { data: motoristaData }, { data: nfesCargaData }, { data: entregaData }] = await Promise.all([
    supabase
      .from("fretes_cte")
      .select(
        "id, numero_cte, serie, protocolo_autorizacao, valor_prestacao, data_emissao, xml_storage_path, origem, status, motivo_rejeicao"
      )
      .eq("frete_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("fretes_ciot")
      .select("id, numero_ciot, rntrc, placa_veiculo, valor_frete, data_emissao, observacao, anexo_storage_path")
      .eq("frete_id", id)
      .order("criado_em", { ascending: false }),
    // Fase P0.2 — CT-e só pode ser emitido pela plataforma se o emitente já
    // estiver cadastrado no provedor fiscal (Fase P0.1, tela /fiscal).
    supabase.from("empresas_fiscal").select("provedor_ref").eq("empresa_id", empresaId).maybeSingle(),
    // Fase P0.2 — remetente/destinatário/tomador reutilizáveis entre fretes.
    supabase
      .from("cadastros_parceiros")
      .select(
        "papel, cnpj_cpf, razao_social, ie, endereco_logradouro, endereco_numero, endereco_bairro, endereco_municipio, endereco_uf, endereco_cep"
      )
      .eq("empresa_id", empresaId),
    // Fase P0.3 — MDF-e mais recente deste frete (qualquer status, pra
    // mostrar histórico/estado atual).
    supabase
      .from("mdfe")
      .select("id, status, placa_veiculo, condutor_nome, uf_carregamento, uf_descarregamento, chave_acesso, protocolo_autorizacao, numero_mdfe, motivo_rejeicao, criado_em")
      .eq("frete_id", id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Fase P0.3 — lista de veículos da empresa pra selecionar no "Iniciar
    // viagem" (mesma RPC paginada usada no resto do app).
    supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresaId }).select("id, placa"),
    freteTipado.motorista_id
      ? supabase.from("motoristas").select("nome_completo, cpf").eq("id", freteTipado.motorista_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Fase P0.4 — romaneio (NF-e da carga) deste frete.
    supabase
      .from("fretes_nfe")
      .select("id, numero_nf, serie_nf, nome_emitente, valor_nf, peso_bruto_kg, quantidade_volumes, chave_acesso, origem")
      .eq("frete_id", id)
      .order("criado_em", { ascending: false }),
    // Fase P0.4 — canhoto digital (POD) confirmado pelo motorista, se houver.
    supabase
      .from("fretes_entregas")
      .select("nome_recebedor, documento_recebedor, foto_canhoto_path, assinatura_path, criado_em")
      .eq("frete_id", id)
      .maybeSingle(),
  ]);

  const veiculos: VeiculoOpcao[] = (veiculosData ?? []).map((v: { id: string; placa: string }) => ({ id: v.id, placa: v.placa }));

  const nfesCarga: NfeCargaRow[] = (nfesCargaData ?? []).map((n) => ({
    id: n.id,
    numeroNf: n.numero_nf,
    serieNf: n.serie_nf,
    nomeEmitente: n.nome_emitente,
    valorNf: n.valor_nf,
    pesoBrutoKg: n.peso_bruto_kg,
    quantidadeVolumes: n.quantidade_volumes,
    chaveAcesso: n.chave_acesso,
    origem: n.origem,
  }));
  // Fase P0.4 — sugestão pronta pro campo "chaves de NF-e" da tela de
  // emissão de CT-e (P0.2), pra não precisar redigitar.
  const chavesNfeRomaneio = nfesCarga.map((n) => n.chaveAcesso).join("\n");

  // Fase P0.4 — canhoto digital (POD): mesmo bucket privado
  // fretes-evidencias já usado pelas fotos de checkpoint do motorista.
  let entrega: EntregaConfirmada | null = null;
  if (entregaData) {
    const [{ data: fotoAssinada }, { data: assinaturaAssinada }] = await Promise.all([
      supabase.storage.from("fretes-evidencias").createSignedUrl(entregaData.foto_canhoto_path, 3600),
      supabase.storage.from("fretes-evidencias").createSignedUrl(entregaData.assinatura_path, 3600),
    ]);
    entrega = {
      nomeRecebedor: entregaData.nome_recebedor,
      documentoRecebedor: entregaData.documento_recebedor,
      criadoEm: entregaData.criado_em,
      fotoCanhotoUrl: fotoAssinada?.signedUrl ?? null,
      assinaturaUrl: assinaturaAssinada?.signedUrl ?? null,
    };
  }

  const mdfeAtivo: MdfeAtivo | null = mdfeData
    ? {
        id: mdfeData.id,
        status: mdfeData.status,
        placaVeiculo: mdfeData.placa_veiculo,
        condutorNome: mdfeData.condutor_nome,
        ufCarregamento: mdfeData.uf_carregamento,
        ufDescarregamento: mdfeData.uf_descarregamento,
        chaveAcesso: mdfeData.chave_acesso,
        protocoloAutorizacao: mdfeData.protocolo_autorizacao,
        numeroMdfe: mdfeData.numero_mdfe,
        motivoRejeicao: mdfeData.motivo_rejeicao,
        criadoEm: mdfeData.criado_em,
      }
    : null;
  // "mdfeAtivo" só deve travar a tela de "Iniciar viagem" enquanto o MDF-e
  // anterior ainda está em curso — um encerrado/cancelado/rejeitado libera
  // iniciar uma viagem nova.
  const mdfeBloqueiaNovaViagem = mdfeAtivo && ["enviando", "autorizado"].includes(mdfeAtivo.status) ? mdfeAtivo : null;

  const parceiros: ParceiroSalvo[] = (parceirosData ?? []).map((p) => ({
    papel: p.papel as ParceiroSalvo["papel"],
    cnpjCpf: p.cnpj_cpf,
    razaoSocial: p.razao_social,
    ie: p.ie,
    logradouro: p.endereco_logradouro,
    numero: p.endereco_numero,
    bairro: p.endereco_bairro,
    municipio: p.endereco_municipio,
    uf: p.endereco_uf,
    cep: p.endereco_cep,
  }));

  const ctes: CteRow[] = await Promise.all(
    (ctesData ?? []).map(async (c): Promise<CteRow> => {
      let xmlUrl: string | null = null;
      if (c.xml_storage_path) {
        const { data } = await supabase.storage.from("fretes-documentos").createSignedUrl(c.xml_storage_path, 3600);
        xmlUrl = data?.signedUrl ?? null;
      }
      return {
        id: c.id,
        numero_cte: c.numero_cte,
        serie: c.serie,
        protocolo_autorizacao: c.protocolo_autorizacao,
        valor_prestacao: c.valor_prestacao,
        data_emissao: c.data_emissao,
        xmlUrl,
        origem: c.origem,
        status: c.status,
        motivoRejeicao: c.motivo_rejeicao,
      };
    })
  );

  const ciots: CiotRow[] = await Promise.all(
    (ciotsData ?? []).map(async (c): Promise<CiotRow> => {
      let anexoUrl: string | null = null;
      if (c.anexo_storage_path) {
        const { data } = await supabase.storage.from("fretes-documentos").createSignedUrl(c.anexo_storage_path, 3600);
        anexoUrl = data?.signedUrl ?? null;
      }
      return {
        id: c.id,
        numero_ciot: c.numero_ciot,
        rntrc: c.rntrc,
        placa_veiculo: c.placa_veiculo,
        valor_frete: c.valor_frete,
        data_emissao: c.data_emissao,
        observacao: c.observacao,
        anexoUrl,
      };
    })
  );

  // Fase foto-evidência-checkpoints — bucket `fretes-evidencias` é privado,
  // então geramos uma signed URL por foto (válida 1h) só pra quem esta
  // página já provou (via RLS de storage) que pode ver: dono da empresa do
  // frete ou o próprio motorista. Foto ausente ou signed URL falhando não
  // pode derrubar a página — mesmo tratamento best-effort do resto do app.
  const eventosComFoto = await Promise.all(
    (eventos ?? []).map(async (e) => {
      if (!e.foto_path) return { ...e, fotoUrl: null as string | null };
      const { data } = await supabase.storage.from("fretes-evidencias").createSignedUrl(e.foto_path, 3600);
      return { ...e, fotoUrl: data?.signedUrl ?? null };
    })
  );

  const avaliacaoMotorista = (avaliacoes ?? []).find((a) => a.avaliador === "motorista");
  const avaliacaoCliente = (avaliacoes ?? []).find((a) => a.avaliador === "cliente");

  const LABEL_EVENTO: Record<string, string> = {
    chegou_origem: "Chegou na origem",
    saiu_origem: "Saiu da origem",
    chegou_posto: "Chegou no posto",
    abasteceu: "Abasteceu",
    parada: "Parada",
    chegou_destino: "Chegou no destino",
    ocorrencia: "Ocorrência",
    concluido: "Concluiu o frete",
    panico: "🚨 Alerta de emergência",
  };

  // Fase P0.4 — classificação estruturada da ocorrência (antes só existia
  // como texto livre em observacao).
  const LABEL_CODIGO_OCORRENCIA: Record<string, string> = {
    atraso: "Atraso",
    avaria: "Avaria",
    recusa: "Recusa",
    reentrega: "Reentrega",
    devolucao: "Devolução",
  };

  const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  // Fase Fretes-Público-Alvo (23/07/26) — frete fora da base ainda
  // disponível (ninguém pegou / propostas recusadas) ou recusado no modo
  // direto pode ser recolocado pra base. Lista de motoristas próprios
  // ativos só é buscada quando o card vai aparecer.
  const podeRecolocarParaBase =
    (freteTipado.status === "disponivel" && freteTipado.publico_alvo === "fora_base") ||
    freteTipado.status === "recusado";
  let motoristasBase: { id: string; nome: string }[] = [];
  if (podeRecolocarParaBase) {
    const { data: proprios } = await supabase
      .from("motoristas")
      .select("id, nome_completo")
      .eq("empresa_id", freteTipado.empresa_id)
      .eq("status", "Ativo")
      .order("nome_completo");
    motoristasBase = (proprios ?? []).map((m) => ({ id: m.id, nome: m.nome_completo }));
  }

  return (
    <div>
      <Link href={`/fretes?empresa=${empresaId}`} className="mb-4 inline-block text-sm text-frota-600 hover:underline">
        ← Voltar pra Fretes
      </Link>

      <div className="card mb-6 p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{freteTipado.titulo}</h1>
          <span className="text-xs font-medium text-slate-500">
            {LABEL_STATUS[freteTipado.status] ?? freteTipado.status}
            {freteTipado.status === "disponivel" &&
              (freteTipado.publico_alvo === "base" ? " — minha base" : " — fora da base")}
          </span>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          {freteTipado.origem_label} → {freteTipado.destino_label}
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-slate-500">Valor</p>
            <p className="font-semibold text-slate-900">{formatoMoeda.format(freteTipado.valor_oferecido)}</p>
          </div>
          {freteTipado.km_estimado && (
            <div>
              <p className="text-xs uppercase text-slate-500">Km estimado</p>
              <p className="font-semibold text-slate-900">{freteTipado.km_estimado.toLocaleString("pt-BR")}</p>
            </div>
          )}
          {freteTipado.tipo_carga && (
            <div>
              <p className="text-xs uppercase text-slate-500">Carga</p>
              <p className="font-semibold text-slate-900">{freteTipado.tipo_carga}</p>
            </div>
          )}
          {freteTipado.peso_carga_kg && (
            <div>
              <p className="text-xs uppercase text-slate-500">Peso</p>
              <p className="font-semibold text-slate-900">{freteTipado.peso_carga_kg.toLocaleString("pt-BR")} kg</p>
            </div>
          )}
        </div>
        {freteTipado.descricao && <p className="mt-4 text-sm text-slate-600">{freteTipado.descricao}</p>}
        {(freteTipado.carga_comprimento_m || freteTipado.carga_largura_m || freteTipado.carga_altura_m) && (
          <p className="mt-3 text-xs text-slate-500">
            📐 Dimensões: {freteTipado.carga_comprimento_m ?? "—"}m × {freteTipado.carga_largura_m ?? "—"}m ×{" "}
            {freteTipado.carga_altura_m ?? "—"}m (C×L×A)
          </p>
        )}
        {((freteTipado.veiculos_aceitos ?? []).length > 0 || (freteTipado.carrocerias_aceitas ?? []).length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(freteTipado.veiculos_aceitos ?? []).map((v) => (
              <span key={v} className="rounded-full bg-frota-50 px-2 py-0.5 text-[11px] text-frota-700">
                🚚 {v}
              </span>
            ))}
            {(freteTipado.carrocerias_aceitas ?? []).map((c) => (
              <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                📦 {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {(freteTipado.coleta_rua || freteTipado.entrega_rua) && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BlocoEndereco
            titulo="📍 Coleta"
            rua={freteTipado.coleta_rua}
            numero={freteTipado.coleta_numero}
            bairro={freteTipado.coleta_bairro}
            cidade={freteTipado.coleta_cidade}
            uf={freteTipado.coleta_uf}
            cep={freteTipado.coleta_cep}
            referencia={freteTipado.coleta_referencia}
            data={freteTipado.coleta_data}
            hora={freteTipado.coleta_hora}
            contatoNome={freteTipado.coleta_contato_nome}
            contatoTelefone={freteTipado.coleta_contato_telefone}
          />
          <BlocoEndereco
            titulo="📍 Entrega"
            rua={freteTipado.entrega_rua}
            numero={freteTipado.entrega_numero}
            bairro={freteTipado.entrega_bairro}
            cidade={freteTipado.entrega_cidade}
            uf={freteTipado.entrega_uf}
            cep={freteTipado.entrega_cep}
            referencia={freteTipado.entrega_referencia}
            data={freteTipado.entrega_data}
            hora={freteTipado.entrega_hora}
            contatoNome={freteTipado.entrega_contato_nome}
            contatoTelefone={freteTipado.entrega_contato_telefone}
          />
        </div>
      )}

      <PagamentosFrete freteId={id} freteConcluido={freteTipado.status === "concluido"} pagamentos={pagamentos} />

      <RomaneioCard freteId={id} empresaId={empresaId} nfes={nfesCarga} />

      <FretesDocumentos
        freteId={id}
        empresaId={empresaId}
        ctes={ctes}
        ciots={ciots}
        fiscalConfigurado={Boolean(fiscalData?.provedor_ref)}
        municipioInicioPadrao={freteTipado.coleta_cidade ?? ""}
        ufInicioPadrao={freteTipado.coleta_uf ?? ""}
        municipioFimPadrao={freteTipado.entrega_cidade ?? ""}
        ufFimPadrao={freteTipado.entrega_uf ?? ""}
        parceiros={parceiros}
        chavesNfePadrao={chavesNfeRomaneio}
      />

      <MdfeCard
        freteId={id}
        empresaId={empresaId}
        fiscalConfigurado={Boolean(fiscalData?.provedor_ref)}
        temCteAutorizado={ctes.some((c) => c.status === "autorizado")}
        veiculos={veiculos}
        condutorNomePadrao={motoristaData?.nome_completo ?? ""}
        condutorCpfPadrao={motoristaData?.cpf ?? ""}
        ufCarregamentoPadrao={freteTipado.coleta_uf ?? ""}
        ufDescarregamentoPadrao={freteTipado.entrega_uf ?? ""}
        mdfeAtivo={mdfeBloqueiaNovaViagem}
      />

      {freteTipado.status === "aguardando_confirmacao" && (
        <p className="card mb-6 p-4 text-sm text-slate-600">
          Frete atribuído diretamente — aguardando o motorista aceitar ou recusar no app dele.
        </p>
      )}

      {podeRecolocarParaBase && (
        <RecolocarParaBaseCard freteId={id} empresaId={empresaId} motoristas={motoristasBase} />
      )}

      {(freteTipado.status === "disponivel" || (propostas ?? []).length > 0) && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Propostas recebidas</h2>
          <PainelPropostas
            empresaId={empresaId}
            propostas={(propostas ?? []) as unknown as Proposta[]}
            freteAberto={freteTipado.status === "disponivel"}
          />
        </div>
      )}

      {freteTipado.status !== "cancelado" && freteTipado.status !== "recusado" && (
        <div className="card mb-6 p-6">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">🛢️ Postos recomendados</h2>
          <p className="mb-3 text-xs text-slate-500">
            Sugira paradas de abastecimento no caminho — pode vincular a um benefício de Parcerias Locais daquele posto.
          </p>
          <div className="mb-3 space-y-2">
            {(postos ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{p.nome_posto}</span>
                  {p.item_catalogo_id && <span className="ml-2 text-xs text-frota-600">🎟️ com benefício vinculado</span>}
                  {p.observacao && <span className="ml-2 text-xs text-slate-500">{p.observacao}</span>}
                </div>
                <RemoverPostoRecomendadoButton id={p.id} freteId={id} empresaId={empresaId} />
              </div>
            ))}
            {(postos ?? []).length === 0 && <p className="text-sm text-slate-400">Nenhum posto recomendado ainda.</p>}
          </div>
          <FormPostoRecomendado freteId={id} empresaId={empresaId} itensParceria={itensParceria ?? []} />
        </div>
      )}

      {emAndamentoOuConcluido && (eventos ?? []).length > 0 && (
        <div className="card mb-6 p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">📍 Linha do tempo</h2>
          <div className="space-y-2 text-sm">
            {eventosComFoto.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2">
                <span className="flex items-center gap-2 text-slate-700">
                  {LABEL_EVENTO[e.tipo_evento] ?? e.tipo_evento}
                  {e.codigo_ocorrencia && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      {LABEL_CODIGO_OCORRENCIA[e.codigo_ocorrencia] ?? e.codigo_ocorrencia}
                    </span>
                  )}
                  {e.observacao && <span className="text-xs text-slate-500">— {e.observacao}</span>}
                  {e.fotoUrl && (
                    <a href={e.fotoUrl} target="_blank" rel="noopener noreferrer" title="Ver foto do motorista">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={e.fotoUrl}
                        alt={`Foto anexada em ${LABEL_EVENTO[e.tipo_evento] ?? e.tipo_evento}`}
                        className="h-8 w-8 rounded border border-slate-200 object-cover hover:opacity-80"
                      />
                    </a>
                  )}
                </span>
                <span className="text-xs text-slate-400">{new Date(e.criado_em).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {emAndamentoOuConcluido && freteTipado.motorista_id && (
        <ChatFrete
          freteId={id}
          remetenteEmail={user?.email ?? null}
          nomeMotorista={motoristaData?.nome_completo ?? null}
        />
      )}

      {entrega && (
        <EntregaCard
          freteTitulo={freteTipado.titulo}
          origemLabel={freteTipado.origem_label}
          destinoLabel={freteTipado.destino_label}
          entrega={entrega}
        />
      )}

      {freteTipado.status === "concluido" && (
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">⭐ Avaliação</h2>
          {avaliacaoMotorista && (
            <p className="mb-2 text-sm text-slate-600">
              Você avaliou o motorista: {"★".repeat(avaliacaoMotorista.estrelas)}
              {avaliacaoMotorista.comentario && ` — ${avaliacaoMotorista.comentario}`}
            </p>
          )}
          {!avaliacaoMotorista && <AvaliarMotoristaForm freteId={id} empresaId={empresaId} />}
          {avaliacaoCliente && (
            <p className="mt-3 text-sm text-slate-600">
              O motorista avaliou você: {"★".repeat(avaliacaoCliente.estrelas)}
              {avaliacaoCliente.comentario && ` — ${avaliacaoCliente.comentario}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BlocoEndereco({
  titulo,
  rua,
  numero,
  bairro,
  cidade,
  uf,
  cep,
  referencia,
  data,
  hora,
  contatoNome,
  contatoTelefone,
}: {
  titulo: string;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  referencia: string | null;
  data: string | null;
  hora: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
}) {
  const linhaEndereco = [rua && numero ? `${rua}, ${numero}` : rua, bairro, cidade && uf ? `${cidade}/${uf}` : cidade]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="card p-5">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{titulo}</h3>
      {linhaEndereco ? (
        <p className="text-sm text-slate-700">{linhaEndereco}</p>
      ) : (
        <p className="text-sm text-slate-400">Endereço não informado.</p>
      )}
      {cep && <p className="text-xs text-slate-500">CEP {cep}</p>}
      {referencia && <p className="text-xs text-slate-500">Referência: {referencia}</p>}
      {(data || hora) && (
        <p className="mt-2 text-xs text-slate-600">
          🗓️ {data ? new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR") : "Data não informada"}
          {hora ? ` às ${hora.slice(0, 5)}` : ""}
        </p>
      )}
      {(contatoNome || contatoTelefone) && (
        <p className="mt-1 text-xs text-slate-600">
          👤 {contatoNome ?? "Contato"} {contatoTelefone ? `— ${contatoTelefone}` : ""}
        </p>
      )}
    </div>
  );
}
