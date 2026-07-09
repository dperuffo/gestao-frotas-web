"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsearXmlNfe, mensagemMotivoPendencia, type NfeExtraida } from "@/lib/nfe";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Fase 27.94 — pedido do Daniel: upload do XML da NF-e (modelo 55) pelo
// posto, vinculando-a ao abastecimento que ela documenta. Fluxo: 1) parse
// estrutural do XML (src/lib/nfe.ts, sem tocar no banco); 2) checa
// duplicidade; 3) busca o(s) abastecimento(s) candidato(s) (o sistema tenta
// achar sozinho — decisão do Daniel via AskUserQuestion — por CNPJ
// emitente/destinatário + janela de data + tolerância de quantidade/valor);
// 4) se achar exatamente 1, vincula direto; se achar mais de 1, devolve a
// lista pro posto escolher manualmente (reenviando com
// abastecimento_id_forcado); se não achar nenhum, devolve pendência. Toda a
// crítica final (CNPJ, tolerância, código ANP) é REFEITA server-side pela
// RPC inserir_nota_fiscal_abastecimento — esta action nunca decide sozinha
// se uma NF-e é válida, só orquestra e traduz o resultado pro usuário.
//
// Fase 27.97 — pedido do Daniel: o upload passou a ser em LOTE (o usuário
// escolhe uma pasta inteira de XMLs, não 1 arquivo por vez — ver
// UploadNotaFiscal.tsx) e "os registros de abastecimentos impactados devem
// ser facilmente identificados". Por isso toda resposta que resulta num
// vínculo (sucesso OU duplicada, já que "duplicada" também aponta pra um
// abastecimento já vinculado antes) agora devolve um resumo do
// abastecimento (placa, motorista, data, combustível) junto — sem isso, com
// vários arquivos processados de uma vez, o usuário não tinha como saber
// qual abastecimento cada linha da lista correspondia sem clicar em cada
// um.

export type CandidatoNota = {
  abastecimentoId: number;
  dataAbastecimento: string;
  veiculoPlaca: string | null;
  motoristaNome: string | null;
  itemNome: string | null;
  itemQuantidade: number;
  itemValorUnitario: number;
  itemValorTotal: number;
};

export type AbastecimentoResumo = {
  abastecimentoId: number;
  dataAbastecimento: string | null;
  veiculoPlaca: string | null;
  motoristaNome: string | null;
  itemNome: string | null;
  itemQuantidade: number | null;
  itemValorTotal: number | null;
};

export type ResultadoEnvioNotaFiscal =
  | { status: "sucesso"; notaId: string; abastecimento: AbastecimentoResumo | null; avisoArquivo?: string }
  | { status: "duplicada"; notaId: string | null; abastecimento: AbastecimentoResumo | null }
  | { status: "sem_correspondencia"; extraido: NfeExtraida }
  | { status: "ambiguo"; candidatos: CandidatoNota[]; extraido: NfeExtraida }
  | { status: "erro"; mensagem: string };

async function buscarResumoAbastecimento(supabase: Supabase, abastecimentoId: number): Promise<AbastecimentoResumo | null> {
  const { data } = await supabase
    .from("profrotas_abastecimentos")
    .select("id, data_abastecimento, veiculo_placa, motorista_nome, item_nome, item_quantidade, item_valor_total")
    .eq("id", abastecimentoId)
    .maybeSingle();
  if (!data) return null;
  return {
    abastecimentoId: data.id,
    dataAbastecimento: data.data_abastecimento,
    veiculoPlaca: data.veiculo_placa,
    motoristaNome: data.motorista_nome,
    itemNome: data.item_nome,
    itemQuantidade: data.item_quantidade === null ? null : Number(data.item_quantidade),
    itemValorTotal: data.item_valor_total === null ? null : Number(data.item_valor_total),
  };
}

export async function enviarNotaFiscalAcao(formData: FormData): Promise<ResultadoEnvioNotaFiscal> {
  const arquivo = formData.get("arquivo");
  const abastecimentoForcadoRaw = formData.get("abastecimento_id_forcado");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { status: "erro", mensagem: "Selecione o(s) arquivo(s) XML da NF-e." };
  }
  if (arquivo.size > 2 * 1024 * 1024) {
    return { status: "erro", mensagem: "O arquivo é grande demais (máximo 2 MB) — confira se é mesmo o XML da NF-e." };
  }

  const texto = await arquivo.text();
  const parse = parsearXmlNfe(texto);
  if (!parse.ok) {
    return { status: "erro", mensagem: parse.erro };
  }
  const nfe = parse.nfe;

  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("notas_fiscais_abastecimento")
    .select("id, abastecimento_id")
    .eq("chave_acesso", nfe.chaveAcesso)
    .maybeSingle();
  if (existente) {
    const abastecimento = await buscarResumoAbastecimento(supabase, existente.abastecimento_id);
    return { status: "duplicada", notaId: existente.id, abastecimento };
  }

  let abastecimentoId: number | null = abastecimentoForcadoRaw ? Number(abastecimentoForcadoRaw) : null;
  if (abastecimentoForcadoRaw && !Number.isFinite(abastecimentoId)) {
    abastecimentoId = null;
  }

  if (!abastecimentoId) {
    const { data: candidatos, error: erroBusca } = await supabase.rpc("buscar_abastecimentos_candidatos_nota_fiscal", {
      p_cnpj_emitente: nfe.cnpjEmitente,
      p_cnpj_destinatario: nfe.cnpjDestinatario,
      p_data_emissao: nfe.dataEmissao,
      p_quantidade: nfe.quantidade,
      p_valor_total: nfe.valorTotal,
    });

    if (erroBusca) {
      return { status: "erro", mensagem: `Não foi possível buscar o abastecimento correspondente: ${erroBusca.message}` };
    }

    if (!candidatos || candidatos.length === 0) {
      return { status: "sem_correspondencia", extraido: nfe };
    }

    if (candidatos.length > 1) {
      return {
        status: "ambiguo",
        extraido: nfe,
        candidatos: candidatos.map((c) => ({
          abastecimentoId: c.abastecimento_id,
          dataAbastecimento: c.data_abastecimento,
          veiculoPlaca: c.veiculo_placa,
          motoristaNome: c.motorista_nome,
          itemNome: c.item_nome,
          itemQuantidade: c.item_quantidade,
          itemValorUnitario: c.item_valor_unitario,
          itemValorTotal: c.item_valor_total,
        })),
      };
    }

    abastecimentoId = candidatos[0].abastecimento_id;
  }

  const { data: resultadoRpc, error: erroRpc } = await supabase.rpc("inserir_nota_fiscal_abastecimento", {
    p_abastecimento_id: abastecimentoId,
    p_chave_acesso: nfe.chaveAcesso,
    p_numero_nf: nfe.numeroNf,
    p_serie_nf: nfe.serieNf,
    p_modelo: nfe.modelo,
    p_data_emissao: nfe.dataEmissao,
    p_cnpj_emitente: nfe.cnpjEmitente,
    p_nome_emitente: nfe.nomeEmitente,
    p_cnpj_destinatario: nfe.cnpjDestinatario,
    p_nome_destinatario: nfe.nomeDestinatario,
    p_produto_nome_xml: nfe.produtoNomeXml,
    p_produto_codigo_anp: nfe.produtoCodigoAnp,
    p_produto_descricao_anp: nfe.produtoDescricaoAnp,
    p_quantidade: nfe.quantidade,
    p_valor_unitario: nfe.valorUnitario,
    p_valor_total: nfe.valorTotal,
    p_valor_nf_total: nfe.valorNfTotal,
    p_xml_storage_path: `${abastecimentoId}/${nfe.chaveAcesso}.xml`,
  });

  if (erroRpc) {
    return { status: "erro", mensagem: `Falha ao gravar a NF-e: ${erroRpc.message}` };
  }

  const resultado = resultadoRpc as { ok: boolean; motivo?: string; nota_id?: string };
  if (!resultado.ok) {
    if (resultado.motivo === "chave_duplicada") {
      const abastecimento = await buscarResumoAbastecimento(supabase, abastecimentoId);
      return { status: "duplicada", notaId: null, abastecimento };
    }
    return { status: "erro", mensagem: mensagemMotivoPendencia(resultado.motivo) };
  }

  // Fase 27.18 — mesmo padrão "best-effort" já usado pros anexos de
  // chamados: a linha em notas_fiscais_abastecimento (fonte da verdade da
  // validação/vínculo) já foi gravada com sucesso — se falhar só a cópia do
  // XML bruto no Storage, não desfazemos a NF (o PDF é gerado a partir dos
  // campos já salvos, não do arquivo), só avisamos o usuário.
  let avisoArquivo: string | undefined;
  const { error: erroUpload } = await supabase.storage
    .from("notas-fiscais-xml")
    .upload(`${abastecimentoId}/${nfe.chaveAcesso}.xml`, texto, { contentType: "text/xml" });
  if (erroUpload) {
    avisoArquivo = "NF-e validada e vinculada, mas não foi possível guardar uma cópia do arquivo XML original.";
  }

  const abastecimento = await buscarResumoAbastecimento(supabase, abastecimentoId);
  revalidatePath("/notas-fiscais");
  return { status: "sucesso", notaId: resultado.nota_id!, abastecimento, avisoArquivo };
}
