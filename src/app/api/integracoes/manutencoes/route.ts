import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_MANUTENCOES_WRITE } from "@/lib/apiKeys";

// API pública pra redes de oficina/manutenção credenciadas lançarem
// manutenções realizadas direto na FNI (Fase 25 — Hub de Integrações).
// Reaproveita a tabela manutencoes_realizadas que já existe desde a Fase 9
// (usada pelo módulo de Manutenção Preditiva) — só ganhou a coluna `origem`
// pra distinguir lançamento manual de lançamento via API.
export const runtime = "nodejs";

type CorpoRequisicao = {
  placa?: string;
  data_manutencao?: string;
  hodometro?: number;
  tecnico?: string;
  oficina?: string;
  custo_total?: number;
  itens_realizados?: string[];
  obs_gerais?: string;
};

export async function POST(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_MANUTENCOES_WRITE);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  let corpo: CorpoRequisicao;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição precisa ser um JSON válido." }, { status: 400 });
  }

  const placa = corpo.placa?.trim().toUpperCase();
  if (!placa) {
    return NextResponse.json({ erro: '"placa" é obrigatória.' }, { status: 400 });
  }

  const dataManutencao = corpo.data_manutencao ? new Date(corpo.data_manutencao) : null;
  if (!dataManutencao || Number.isNaN(dataManutencao.getTime())) {
    return NextResponse.json(
      { erro: '"data_manutencao" precisa ser uma data válida (ex: "2026-07-03").' },
      { status: 400 }
    );
  }

  if (corpo.itens_realizados != null && !Array.isArray(corpo.itens_realizados)) {
    return NextResponse.json({ erro: '"itens_realizados", quando informado, precisa ser uma lista de textos.' }, { status: 400 });
  }

  // manutencoes_realizadas usa cnpj_frota (não empresa_id direto) como
  // vínculo principal — mesmo padrão de cadastro_veiculos. Busca o CNPJ da
  // empresa dona da chave pra preencher.
  const { data: empresa } = await supabase.from("empresas").select("cnpj").eq("id", chave.empresaId).maybeSingle();
  if (!empresa?.cnpj) {
    return NextResponse.json(
      { erro: "A empresa dona desta chave não tem CNPJ cadastrado — não é possível vincular a manutenção." },
      { status: 422 }
    );
  }

  const { data: registro, error: erroInsert } = await supabase
    .from("manutencoes_realizadas")
    .insert({
      empresa_id: chave.empresaId,
      cnpj_frota: empresa.cnpj,
      placa,
      data_manutencao: dataManutencao.toISOString().slice(0, 10),
      hodometro: corpo.hodometro != null ? Number(corpo.hodometro) : null,
      tecnico: corpo.tecnico?.trim() || null,
      oficina: corpo.oficina?.trim() || null,
      custo_total: corpo.custo_total != null ? Number(corpo.custo_total) : null,
      itens_realizados: corpo.itens_realizados ?? null,
      obs_gerais: corpo.obs_gerais?.trim() || null,
      origem: "api",
    })
    .select("id")
    .single();

  if (erroInsert) {
    return NextResponse.json({ erro: `Não foi possível salvar: ${erroInsert.message}` }, { status: 500 });
  }

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ id: registro.id, status: "criado" }, { status: 201 });
}
