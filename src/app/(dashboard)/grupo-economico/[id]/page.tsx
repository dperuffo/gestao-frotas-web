import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GrupoForm } from "../_components/GrupoForm";
import { VincularEmpresaForm } from "../_components/VincularEmpresaForm";
import { BotaoVoltar } from "../../_components/BotaoVoltar";
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { formatarMoeda } from "@/lib/financeiro";
import { Wallet, Droplet, Truck, ShieldAlert } from "lucide-react";

// Fase Gestao-Controles (27/08/2026, pedido do Daniel: "gestao e controles
// mais diretos" / item do roadmap "Painel executivo do Grupo Econômico") —
// até aqui esta tela era só cadastro (nome, CNPJ, empresas vinculadas).
// "Grupo Econômico" hoje é mais config/billing do que visão consolidada —
// achado real da varredura de roadmap. Este tipo é o formato devolvido pela
// RPC grupo_economico_painel_executivo (ver migração
// grupo_economico_painel_executivo), que soma gasto/litros dos últimos 6
// meses, veículos ativos e sinistros de TODAS as empresas do grupo — sem
// precisar abrir empresa por empresa.
type PainelExecutivoGrupo = {
  resumo: {
    totalEmpresas: number;
    totalVeiculos: number;
    totalSinistros: number;
    totalGasto6m: number;
    totalLitros6m: number;
  };
  porEmpresa: {
    empresaId: string;
    empresaNome: string;
    veiculos: number;
    sinistros: number;
    gasto6m: number;
    litros6m: number;
  }[];
};

export default async function EditarGrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: grupo } = await supabase.from("grupos_economicos").select("*").eq("id", id).single();
  // Fase 27.87 — a mesma tabela também guarda Rede de Postos
  // (segmento='Revenda'); se alguém abrir aqui o id de uma Rede (link
  // direto, favorito antigo etc.), trata como não encontrado nesta tela —
  // o lugar certo é /rede-postos/[id].
  if (!grupo || grupo.segmento !== "Frota") notFound();

  const { data: vinculosRaw } = await supabase
    .from("grupos_economicos_empresas")
    .select("id, empresa:empresas(id, nome)")
    .eq("grupo_economico_id", id);

  const vinculos = (vinculosRaw ?? []).map((v) => ({
    id: v.id,
    empresa: v.empresa as unknown as { id: string; nome: string } | null,
  }));

  const idsVinculados = new Set(vinculos.map((v) => v.empresa?.id).filter(Boolean));

  const { data: todasEmpresas } = await supabase
    .from("empresas")
    .select("id, nome")
    .eq("segmento", "Frota")
    .order("nome");
  const empresasDisponiveis = (todasEmpresas ?? []).filter((e) => !idsVinculados.has(e.id));

  // Falha silenciosa de propósito (mesmo padrão de buscarPaineisOcultosAcao)
  // — se a RPC falhar (ex.: grupo sem nenhuma empresa vinculada ainda), a
  // tela de cadastro continua funcionando normalmente, só sem o painel.
  let painel: PainelExecutivoGrupo | null = null;
  if (vinculos.length > 0) {
    const { data: painelRaw, error: painelError } = await supabase.rpc("grupo_economico_painel_executivo", {
      p_grupo_id: id,
    });
    if (!painelError && painelRaw) painel = painelRaw as unknown as PainelExecutivoGrupo;
  }

  return (
    <div className="space-y-6">
      <BotaoVoltar href="/grupo-economico" />
      <h1 className="text-xl font-semibold text-slate-900">Editar Grupo Econômico — {grupo.nome}</h1>

      {painel && (
        <div className="card p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Painel executivo</h2>
          <p className="mb-3 text-xs text-slate-500">
            Soma das {painel.resumo.totalEmpresas} empresas vinculadas — gasto e litros dos últimos 6 meses.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <IndicadorColorido
              cor="green"
              icon={Wallet}
              label="Gasto (6 meses)"
              valor={formatarMoeda(painel.resumo.totalGasto6m)}
            />
            <IndicadorColorido
              cor="sky"
              icon={Droplet}
              label="Litros (6 meses)"
              valor={painel.resumo.totalLitros6m.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            />
            <IndicadorColorido cor="violet" icon={Truck} label="Veículos ativos" valor={String(painel.resumo.totalVeiculos)} />
            <IndicadorColorido cor="amber" icon={ShieldAlert} label="Sinistros" valor={String(painel.resumo.totalSinistros)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Empresa</th>
                  <th className="py-2">Gasto (6m)</th>
                  <th className="py-2">Litros (6m)</th>
                  <th className="py-2">Veículos</th>
                  <th className="py-2">Sinistros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {painel.porEmpresa.map((e) => (
                  <tr key={e.empresaId}>
                    <td className="py-2 text-slate-700">{e.empresaNome}</td>
                    <td className="py-2 text-slate-700">{formatarMoeda(e.gasto6m)}</td>
                    <td className="py-2 text-slate-700">
                      {e.litros6m.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 text-slate-700">{e.veiculos}</td>
                    <td className="py-2 text-slate-700">{e.sinistros}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <GrupoForm grupo={grupo} />
      <VincularEmpresaForm grupoId={id} empresasDisponiveis={empresasDisponiveis} vinculos={vinculos} />
    </div>
  );
}
