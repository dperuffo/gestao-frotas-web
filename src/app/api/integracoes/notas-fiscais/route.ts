import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_NOTAS_FISCAIS_WRITE } from "@/lib/apiKeys";
import { parsearXmlNfe, mensagemMotivoPendencia } from "@/lib/nfe";

// Fase 27.94 — pedido do Daniel: "ERPs de automação de postos, que emitem
// notas fiscais de produtos, podem se integrar com a aplicação para upload
// automático das notas fiscais". Mesmo padrão do Hub de Integrações (Fase
// 25/27.50): autenticação por chave própria (Authorization: Bearer
// <chave>), gerada pelo POSTO na tela /integracoes dele, escopo
// "notas_fiscais:write". O corpo da requisição é o XML BRUTO da NF-e (não
// JSON) — o ERP manda exatamente o arquivo que a SEFAZ autorizou.
//
// Autenticação aqui usa o client admin/service-role (sem JWT de usuário —
// não existe "sessão" numa chamada de API-key), então as RPCs de
// matching/inserção são chamadas no OVERLOAD "confiável" (que recebe
// empresa_posto_id já validado pela chave em vez de resolver por e-mail).
// Esse overload só pode ser executado pelo service_role (REVOKE de
// anon/authenticated na migration) — não dá pra chamar isso do navegador.
//
// Fase 27.136 — pedido do Daniel: NF-e também pra abastecimentos de outros
// meios de pagamento (Valecard, RedeFrota, TicketLog, Veloe...), não só
// PróFrotas. Quando o candidato é ambíguo, quem reenvia com
// "?abastecimento_id=" agora também precisa mandar "?provedor=" (as duas
// fontes usam sequências de id independentes — sem o provedor junto, o id
// sozinho pode apontar pra linha errada). "profrotas" continua sendo o
// padrão quando "?provedor=" não é enviado, pra não quebrar integrações
// de ERP já existentes que só conhecem PróFrotas.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_NOTAS_FISCAIS_WRITE);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  const texto = await request.text();
  if (!texto || texto.length > 2 * 1024 * 1024) {
    return NextResponse.json(
      { erro: "Envie o XML da NF-e como corpo bruto da requisição (máximo 2 MB)." },
      { status: 400 }
    );
  }

  const parse = parsearXmlNfe(texto);
  if (!parse.ok) {
    return NextResponse.json({ erro: parse.erro }, { status: 422 });
  }
  const nfe = parse.nfe;

  const { data: existente } = await supabase
    .from("notas_fiscais_abastecimento")
    .select("id")
    .eq("chave_acesso", nfe.chaveAcesso)
    .maybeSingle();
  if (existente) {
    return NextResponse.json({ erro: "Esta NF-e já foi cadastrada anteriormente.", nota_id: existente.id }, { status: 409 });
  }

  const url = new URL(request.url);
  const abastecimentoForcadoRaw = url.searchParams.get("abastecimento_id");
  let abastecimentoId: number | null = abastecimentoForcadoRaw ? Number(abastecimentoForcadoRaw) : null;
  if (abastecimentoForcadoRaw && !Number.isFinite(abastecimentoId)) {
    return NextResponse.json({ erro: '"abastecimento_id" precisa ser um número.' }, { status: 400 });
  }
  let provedor: string | null = url.searchParams.get("provedor");

  if (!abastecimentoId) {
    const { data: candidatos, error: erroBusca } = await supabase.rpc("buscar_abastecimentos_candidatos_nota_fiscal", {
      p_cnpj_emitente: nfe.cnpjEmitente,
      p_cnpj_destinatario: nfe.cnpjDestinatario,
      p_data_emissao: nfe.dataEmissao,
      p_quantidade: nfe.quantidade,
      p_valor_total: nfe.valorTotal,
      p_empresa_posto_id_confiavel: chave.empresaId,
    });

    if (erroBusca) {
      return NextResponse.json({ erro: `Não foi possível buscar o abastecimento correspondente: ${erroBusca.message}` }, { status: 500 });
    }

    if (!candidatos || candidatos.length === 0) {
      return NextResponse.json(
        {
          erro: "Nenhum abastecimento correspondente encontrado (confira CNPJ emitente/destinatário, data, quantidade e valor).",
          extraido_do_xml: nfe,
        },
        { status: 422 }
      );
    }

    if (candidatos.length > 1) {
      return NextResponse.json(
        {
          erro:
            'Mais de um abastecimento corresponde a esta NF-e — reenvie com "?abastecimento_id=<id>&provedor=<provedor>" indicando qual é o certo.',
          candidatos: candidatos.map((c) => ({
            abastecimento_id: c.abastecimento_id,
            provedor: c.provedor,
            data_abastecimento: c.data_abastecimento,
            veiculo_placa: c.veiculo_placa,
            motorista_nome: c.motorista_nome,
            item_nome: c.item_nome,
            item_quantidade: c.item_quantidade,
            item_valor_total: c.item_valor_total,
          })),
        },
        { status: 409 }
      );
    }

    abastecimentoId = candidatos[0].abastecimento_id;
    provedor = candidatos[0].provedor;
  }

  if (!provedor) {
    // Compat: integrações de ERP anteriores a esta fase só conheciam
    // PróFrotas e nunca mandavam "?provedor=".
    provedor = "profrotas";
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
    p_empresa_posto_id_confiavel: chave.empresaId,
    p_enviado_por: `api:${chave.id}`,
  });

  if (erroRpc) {
    return NextResponse.json({ erro: `Falha ao gravar a NF-e: ${erroRpc.message}` }, { status: 500 });
  }

  const resultado = resultadoRpc as { ok: boolean; motivo?: string; nota_id?: string };
  if (!resultado.ok) {
    const status = resultado.motivo === "chave_duplicada" ? 409 : 422;
    return NextResponse.json({ erro: mensagemMotivoPendencia(resultado.motivo), motivo: resultado.motivo }, { status });
  }

  let avisoArquivo: string | undefined;
  const { error: erroUpload } = await supabase.storage
    .from("notas-fiscais-xml")
    .upload(`${provedor}-${abastecimentoId}/${nfe.chaveAcesso}.xml`, texto, { contentType: "text/xml" });
  if (erroUpload) {
    avisoArquivo = "NF-e validada e vinculada, mas não foi possível guardar uma cópia do arquivo XML original.";
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json(
    { status: "vinculada", nota_id: resultado.nota_id, abastecimento_id: abastecimentoId, provedor, aviso: avisoArquivo },
    { status: 201 }
  );
}
