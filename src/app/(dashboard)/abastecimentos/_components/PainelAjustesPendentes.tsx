import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHoraBr } from "@/lib/utils";

// 06/10/2026 (pedido do Daniel) — o badge do menu "Abastecimentos" só dizia
// "1", sem mostrar QUAL abastecimento esperava resposta. Este painel lista, no
// topo da tela, cada pedido de ajuste que cabe ao usuário responder, com o
// abastecimento identificado (ID, data, placa, valor) e link direto pro
// detalhe. Mesma regra da contagem do badge (contarAjustesAbastecimentosPendentesAcao):
// posto responde "pendente_posto"; os demais, "pendente_cliente".
export async function PainelAjustesPendentes() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const ehPosto = perfil === "posto";

  const { data: ajustes } = await supabase
    .from("ajustes_abastecimentos")
    .select("id, abastecimento_id, abastecimento_externo_id, empresa_cliente_id, empresa_posto_id, origem, valor_original, criado_em")
    .eq("status", ehPosto ? "pendente_posto" : "pendente_cliente")
    .order("criado_em", { ascending: false })
    .limit(20);
  if (!ajustes || ajustes.length === 0) return null;

  const idsPf = ajustes.map((a) => a.abastecimento_id).filter((v): v is number => v != null);
  const idsEx = ajustes.map((a) => a.abastecimento_externo_id).filter((v): v is number => v != null);

  const [pf, ex] = await Promise.all([
    idsPf.length
      ? supabase.from("profrotas_abastecimentos").select("id, codigo_abastecimento, data_abastecimento, motorista_nome").in("id", idsPf)
      : Promise.resolve({ data: [] as { id: number; codigo_abastecimento: string | null; data_abastecimento: string | null; motorista_nome: string | null }[] }),
    idsEx.length
      ? supabase
          .from("abastecimentos_externos")
          .select("id, codigo_abastecimento, data_abastecimento, placa, motorista_nome")
          .in("id", idsEx)
      : Promise.resolve({ data: [] as { id: number; codigo_abastecimento: string | null; data_abastecimento: string | null; placa: string | null; motorista_nome: string | null }[] }),
  ]);
  const mapaPf = new Map((pf.data ?? []).map((r) => [r.id, r]));
  const mapaEx = new Map((ex.data ?? []).map((r) => [r.id, r]));

  const idsContraparte = Array.from(
    new Set(ajustes.map((a) => (ehPosto ? a.empresa_cliente_id : a.empresa_posto_id)).filter((v): v is string => !!v)),
  );
  const nomes = new Map<string, string>();
  await Promise.all(
    idsContraparte.map(async (id) => {
      const { data } = await supabase.rpc("nome_empresa_publico", { p_empresa_id: id });
      if (data) nomes.set(id, data as string);
    }),
  );

  return (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
        <AlertCircle className="h-4 w-4" />
        {ajustes.length === 1
          ? "1 pedido de ajuste aguardando a sua resposta"
          : `${ajustes.length} pedidos de ajuste aguardando a sua resposta`}
      </div>
      <ul className="space-y-2">
        {ajustes.map((a) => {
          const externo = a.abastecimento_externo_id != null;
          const id = (externo ? a.abastecimento_externo_id : a.abastecimento_id) as number;
          const reg = externo ? mapaEx.get(id) : mapaPf.get(id);
          const placa = externo ? (reg as { placa?: string | null } | undefined)?.placa : null;
          const contraparte = nomes.get((ehPosto ? a.empresa_cliente_id : a.empresa_posto_id) ?? "");
          const href = externo ? `/abastecimentos/externo/${id}` : `/abastecimentos/${id}`;
          return (
            <li key={a.id}>
              <Link
                href={href}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <span className="text-slate-700 dark:text-slate-200">
                  <strong>ID {reg?.codigo_abastecimento ?? id}</strong>
                  {reg?.data_abastecimento ? ` · ${formatarDataHoraBr(reg.data_abastecimento)}` : ""}
                  {placa ? ` · ${placa}` : ""}
                  {reg?.motorista_nome ? ` · ${reg.motorista_nome}` : ""}
                  {contraparte ? ` · ${ehPosto ? "Cliente" : "Posto"}: ${contraparte}` : ""}
                </span>
                <span className="whitespace-nowrap font-medium text-red-600 dark:text-red-300">
                  {a.valor_original != null
                    ? `${Number(a.valor_original).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · `
                    : ""}
                  Responder →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
