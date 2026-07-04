import { NextResponse } from "next/server";
import { autenticarRequisicaoApi, marcarUsoChaveApi } from "@/lib/apiAuth";
import { ESCOPO_VEICULOS_READ } from "@/lib/apiKeys";
import { lerPaginacao } from "@/lib/apiPaginacao";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";

// API de leitura da frota cadastrada (Fase 25 — Hub de Integrações), pra um
// ERP, sistema de telemetria ou de RH do cliente consumir sem precisar de
// acesso ao painel. cadastro_veiculos não tem empresa_id direto (o vínculo
// é por cnpj_frota) — reaproveita a RPC veiculos_da_empresa(), a mesma usada
// no Dashboard/telas internas, que já resolve a normalização de CNPJ certa.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autenticarRequisicaoApi(request, ESCOPO_VEICULOS_READ);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.erro }, { status: auth.status });
  }
  const { chave, supabase } = auth;

  const { limit, offset } = lerPaginacao(new URL(request.url));

  // Fase 27.38 — a RPC veiculos_da_empresa sozinha cai no limite padrão de
  // 1000 linhas por resposta do Supabase/PostgREST (db-max-rows): clientes
  // com mais de 1000 veículos recebiam um `total` errado e a página pedida
  // podia vir vazia/incompleta. buscarTodosVeiculosDaEmpresa pagina em lotes
  // de 1000 até esgotar os resultados antes de aplicar o limit/offset
  // próprios desta API.
  const { data, error: erroBusca } = await buscarTodosVeiculosDaEmpresa(supabase, chave.empresaId);
  if (erroBusca) {
    return NextResponse.json({ erro: `Erro ao consultar veículos: ${erroBusca}` }, { status: 500 });
  }

  const pagina = (data ?? []).slice(offset, offset + limit).map((v) => ({
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    ano_modelo: v.ano_modelo,
    tipo_veiculo: v.tipo_veiculo,
    classificacao: v.classificacao,
    combustivel: v.combustivel,
    centro_custo_nome: v.centro_custo_nome,
    ativo: v.ativo,
  }));

  await marcarUsoChaveApi(supabase, chave.id);

  return NextResponse.json({ total: (data ?? []).length, limit, offset, dados: pagina });
}
