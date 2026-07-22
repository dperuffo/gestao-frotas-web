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
// Fase 27.97 — pedido do Daniel: o upload passou a ser em LOTE e toda
// resposta que resulta num vínculo (sucesso ou duplicada) devolve um
// resumo do abastecimento junto.
//
// Fase 27.99 — pedido do Daniel, testando o upload em lote: "Precisa
// evidenciar melhor no registro de abastecimento com uma cor diferente e
// trazer mais detalhes da rejeição para dar nova oportunidade de upload
// correto da NFe". Até aqui, quando um upload falhava, NADA era
// persistido — o motivo só existia na lista temporária da tela, e
// desaparecia ao sair da página. Agora TODA rejeição (estrutural, sem
// correspondência, ou pendência retornada pela RPC de inserção — exceto
// "chave_duplicada", que já é tratada como "duplicada" e aponta pra um
// abastecimento já vinculado, não é uma rejeição) é registrada via
// `registrar_pendencia_nota_fiscal`, pra a listagem de /notas-fiscais poder
// mostrar "Rejeitada: <motivo>" na própria linha do abastecimento (quando
// dá pra saber qual é) ou numa seção à parte (quando não dá — ex.: CNPJ do
// cliente não bate com nada). Registro é BEST-EFFORT: se falhar, não
// interrompe nem muda a resposta que o usuário já ia receber — é só um log
// de diagnóstico, não a fonte de verdade (que continua sendo
// notas_fiscais_abastecimento pra sucesso).
//
// Fase 27.101 — achado real do Daniel testando o lote de 9 XMLs de exemplo:
// mesmo com 5 uploads rejeitados, o filtro "Rejeitada" continuava em 0.
// Causa raiz: o posto da pendência era resolvido por resolverEmpresaAtual
// (empresa "atual" da SESSÃO do navegador), que só resolve sozinha quando o
// usuário tem acesso a EXATAMENTE 1 empresa — o usuário de teste tem acesso
// a 2 postos (Posto Teste + Posto Teste 2, via Rede de Postos, Fase 27.87),
// então essa resolução sempre devolvia null e o registro nunca acontecia.
// Trocado por resolução via o CNPJ EMITENTE do próprio XML (RPC
// resolver_posto_por_cnpj, mesmo match usado em
// buscar_abastecimentos_candidatos_nota_fiscal) — além de corrigir o bug,
// é mais correto: um único lote pode ter XMLs de dois postos diferentes (o
// caso real do Daniel), e nenhuma "empresa atual" de sessão representaria
// isso certo de qualquer forma.
//
// Fase 27.136 — pedido do Daniel: "O posto cobra do cliente sobre
// abastecimentos de outras modalidades de pagamentos, assim como notas
// fiscais, o posto faz o upload das notas fiscais destes abastecimentos" —
// o fluxo de NF-e (matching + inserção) passa a valer também pra
// abastecimentos de outros provedores (Valecard, RedeFrota, TicketLog,
// Veloe...), não só PróFrotas. As RPCs agora sempre devolvem/recebem
// `provedor` junto do id (as duas fontes usam sequências de id bigint
// independentes — sem o provedor junto, um id podia apontar pra linha
// errada).

export type CandidatoNota = {
  abastecimentoId: number;
  provedor: string;
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
  provedor: string;
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

// Fase 27.136 — resumo agora busca em uma das duas tabelas conforme o
// provedor (as duas têm colunas com nomes diferentes pro mesmo conceito —
// item_nome/item_quantidade/item_valor_total no PróFrotas vs
// combustivel/quantidade/valor_total no lado externo).
// `ehProfrotas` decide só qual TABELA consultar — o `id` já é a chave
// primária de cada uma (não precisa confirmar o provedor de novo pra achar
// a linha, só pra saber onde procurar).
async function buscarResumoAbastecimento(
  supabase: Supabase,
  abastecimentoId: number,
  ehProfrotas: boolean
): Promise<AbastecimentoResumo | null> {
  if (ehProfrotas) {
    const { data } = await supabase
      .from("profrotas_abastecimentos")
      .select("id, data_abastecimento, veiculo_placa, motorista_nome, item_nome, item_quantidade, item_valor_total")
      .eq("id", abastecimentoId)
      .maybeSingle();
    if (!data) return null;
    return {
      abastecimentoId: data.id,
      provedor: "profrotas",
      dataAbastecimento: data.data_abastecimento,
      veiculoPlaca: data.veiculo_placa,
      motoristaNome: data.motorista_nome,
      itemNome: data.item_nome,
      itemQuantidade: data.item_quantidade === null ? null : Number(data.item_quantidade),
      itemValorTotal: data.item_valor_total === null ? null : Number(data.item_valor_total),
    };
  }

  const { data } = await supabase
    .from("abastecimentos_externos")
    .select("id, provedor, data_abastecimento, placa, motorista_nome, combustivel, quantidade, valor_total")
    .eq("id", abastecimentoId)
    .maybeSingle();
  if (!data) return null;
  return {
    abastecimentoId: data.id,
    provedor: data.provedor,
    dataAbastecimento: data.data_abastecimento,
    veiculoPlaca: data.placa,
    motoristaNome: data.motorista_nome,
    itemNome: data.combustivel,
    itemQuantidade: data.quantidade === null ? null : Number(data.quantidade),
    itemValorTotal: data.valor_total === null ? null : Number(data.valor_total),
  };
}

// Fase 27.101 — resolve o posto pelo CNPJ emitente declarado no PRÓPRIO XML
// (RPC resolver_posto_por_cnpj, SECURITY DEFINER, já confere se o usuário
// logado tem acesso a esse posto). Substitui a resolução por sessão da Fase
// 27.99 (ver nota acima). Best-effort: se não der pra resolver (CNPJ
// ilegível, posto não cadastrado, ou usuário sem acesso a ele), simplesmente
// não registra pendência nenhuma — não é motivo pra quebrar o fluxo do
// usuário.
async function resolverPostoPorCnpj(supabase: Supabase, cnpjEmitente: string | undefined | null): Promise<string | null> {
  if (!cnpjEmitente) return null;
  try {
    const { data, error } = await supabase.rpc("resolver_posto_por_cnpj", { p_cnpj_emitente: cnpjEmitente });
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

type DadosPendencia = {
  abastecimentoId: number | null;
  provedor: string | null;
  motivo: string;
  detalheTexto?: string | null;
  nfe?: NfeExtraida | null;
  nomeArquivo: string;
};

async function registrarPendenciaBestEffort(supabase: Supabase, empresaPostoId: string, dados: DadosPendencia): Promise<void> {
  try {
    const ehProfrotas = dados.provedor === "profrotas" || dados.provedor === null;
    await supabase.rpc("registrar_pendencia_nota_fiscal", {
      p_empresa_posto_id: empresaPostoId,
      p_abastecimento_id: ehProfrotas ? dados.abastecimentoId : null,
      p_provedor: dados.provedor,
      p_abastecimento_externo_id: ehProfrotas ? null : dados.abastecimentoId,
      p_motivo: dados.motivo,
      p_detalhe_texto: dados.detalheTexto ?? null,
      p_cnpj_emitente: dados.nfe?.cnpjEmitente ?? null,
      p_cnpj_destinatario: dados.nfe?.cnpjDestinatario ?? null,
      p_chave_acesso: dados.nfe?.chaveAcesso ?? null,
      p_numero_nf: dados.nfe?.numeroNf ?? null,
      p_produto_nome_xml: dados.nfe?.produtoNomeXml ?? null,
      p_produto_codigo_anp: dados.nfe?.produtoCodigoAnp ?? null,
      p_quantidade: dados.nfe?.quantidade ?? null,
      p_valor_total: dados.nfe?.valorTotal ?? null,
      p_data_emissao_nfe: dados.nfe?.dataEmissao ?? null,
      p_nome_arquivo: dados.nomeArquivo,
    });
  } catch {
    // best-effort — falha em registrar o diagnóstico não deve impactar o
    // resultado que o usuário já vai receber.
  }
}

export async function enviarNotaFiscalAcao(formData: FormData): Promise<ResultadoEnvioNotaFiscal> {
  const arquivo = formData.get("arquivo");
  const abastecimentoForcadoRaw = formData.get("abastecimento_id_forcado");
  const provedorForcadoRaw = formData.get("provedor_forcado");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { status: "erro", mensagem: "Selecione o(s) arquivo(s) XML da NF-e." };
  }
  if (arquivo.size > 2 * 1024 * 1024) {
    return { status: "erro", mensagem: "O arquivo é grande demais (máximo 2 MB) — confira se é mesmo o XML da NF-e." };
  }

  const supabase = await createClient();

  const texto = await arquivo.text();
  const parse = parsearXmlNfe(texto);
  if (!parse.ok) {
    const empresaPostoId = await resolverPostoPorCnpj(supabase, parse.cnpjEmitenteParcial);
    if (empresaPostoId) {
      await registrarPendenciaBestEffort(supabase, empresaPostoId, {
        abastecimentoId: null,
        provedor: null,
        motivo: "erro_leitura_xml",
        detalheTexto: parse.erro,
        nomeArquivo: arquivo.name,
      });
    }
    return { status: "erro", mensagem: parse.erro };
  }
  const nfe = parse.nfe;

  // Nova regra do Daniel (ajuste de abastecimento): quando um ajuste é
  // aceito e o abastecimento já tinha NFe vinculada, ela é removida de
  // notas_fiscais_abastecimento e arquivada em
  // notas_fiscais_abastecimento_historico (ver decidir_ajuste_abastecimento)
  // — a MESMA nota (mesma chave_acesso) não pode ser reenviada depois disso;
  // o posto precisa emitir/subir uma NF-e nova pro abastecimento ajustado.
  const { data: notaHistorico } = await supabase
    .from("notas_fiscais_abastecimento_historico")
    .select("id, motivo_exclusao")
    .eq("chave_acesso", nfe.chaveAcesso)
    .maybeSingle();
  if (notaHistorico) {
    return {
      status: "erro",
      mensagem:
        "Esta NF-e já foi removida por causa de um ajuste aceito neste abastecimento e não pode ser reenviada. Envie a NF-e nova referente ao abastecimento ajustado.",
    };
  }

  const { data: existente } = await supabase
    .from("notas_fiscais_abastecimento")
    .select("id, abastecimento_id, abastecimento_externo_id")
    .eq("chave_acesso", nfe.chaveAcesso)
    .maybeSingle();
  if (existente) {
    const abastecimento =
      existente.abastecimento_id != null
        ? await buscarResumoAbastecimento(supabase, existente.abastecimento_id, true)
        : existente.abastecimento_externo_id != null
          ? await buscarResumoAbastecimento(supabase, existente.abastecimento_externo_id, false)
          : null;
    return { status: "duplicada", notaId: existente.id, abastecimento };
  }

  let abastecimentoId: number | null = abastecimentoForcadoRaw ? Number(abastecimentoForcadoRaw) : null;
  if (abastecimentoForcadoRaw && !Number.isFinite(abastecimentoId)) {
    abastecimentoId = null;
  }
  let provedor: string | null = typeof provedorForcadoRaw === "string" && provedorForcadoRaw ? provedorForcadoRaw : null;

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
      const empresaPostoId = await resolverPostoPorCnpj(supabase, nfe.cnpjEmitente);
      if (empresaPostoId) {
        await registrarPendenciaBestEffort(supabase, empresaPostoId, {
          abastecimentoId: null,
          provedor: null,
          motivo: "sem_correspondencia",
          nfe,
          nomeArquivo: arquivo.name,
        });
      }
      return { status: "sem_correspondencia", extraido: nfe };
    }

    if (candidatos.length > 1) {
      return {
        status: "ambiguo",
        extraido: nfe,
        candidatos: candidatos.map((c) => ({
          abastecimentoId: c.abastecimento_id,
          provedor: c.provedor,
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
    provedor = candidatos[0].provedor;
  }

  if (!provedor) {
    return { status: "erro", mensagem: "Meio de pagamento do abastecimento não informado." };
  }

  const { data: resultadoRpc, error: erroRpc } = await supabase.rpc("inserir_nota_fiscal_abastecimento", {
    p_abastecimento_id: abastecimentoId,
    p_provedor: provedor,
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
    p_xml_storage_path: `${provedor}-${abastecimentoId}/${nfe.chaveAcesso}.xml`,
  });

  if (erroRpc) {
    return { status: "erro", mensagem: `Falha ao gravar a NF-e: ${erroRpc.message}` };
  }

  const resultado = resultadoRpc as { ok: boolean; motivo?: string; nota_id?: string };
  if (!resultado.ok) {
    if (resultado.motivo === "chave_duplicada") {
      const abastecimento = await buscarResumoAbastecimento(supabase, abastecimentoId, provedor === "profrotas");
      return { status: "duplicada", notaId: null, abastecimento };
    }
    const empresaPostoId = await resolverPostoPorCnpj(supabase, nfe.cnpjEmitente);
    if (empresaPostoId) {
      await registrarPendenciaBestEffort(supabase, empresaPostoId, {
        abastecimentoId,
        provedor,
        motivo: resultado.motivo ?? "erro_desconhecido",
        nfe,
        nomeArquivo: arquivo.name,
      });
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
    .upload(`${provedor}-${abastecimentoId}/${nfe.chaveAcesso}.xml`, texto, { contentType: "text/xml" });
  if (erroUpload) {
    avisoArquivo = "NF-e validada e vinculada, mas não foi possível guardar uma cópia do arquivo XML original.";
  }

  const abastecimento = await buscarResumoAbastecimento(supabase, abastecimentoId, provedor === "profrotas");
  revalidatePath("/notas-fiscais");
  return { status: "sucesso", notaId: resultado.nota_id!, abastecimento, avisoArquivo };
}
