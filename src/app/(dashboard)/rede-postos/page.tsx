import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
// Fase Redesign-Telas-Densas / Backlog-Visao-Posto (13/08/2026) — mesmo
// toque visual já aplicado nas telas do lado cliente.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Network, CheckCircle2 } from "lucide-react";

// Fase 27.87 — pedido do Daniel: "Criar a mesma mecanica de grupo economico
// para postos, só que em postos deve ser denominado de 'Rede de Postos' e
// o nome que leva a Rede" + "agrupamento de postos na mesma Rede para
// visao pelos usarios cadastrados na Rede".
//
// Espelha /grupo-economico/page.tsx (mesma tabela grupos_economicos,
// filtrada aqui por segmento='Revenda' — ver src/lib/gruposEconomicos.ts).
// Um posto vinculado à mesma Rede que outro passa a enxergar as empresas
// irmãs em qualquer tela que já use resolverEmpresaAtual()/
// empresas_do_usuario() — isso já vem de graça da RPC do banco, não precisa
// de nenhum código novo além desta tela de administração.
export default async function RedePostosPage() {
  const supabase = await createClient();

  const { data: redes, error } = await supabase
    .from("grupos_economicos")
    .select("id, nome, cnpj_matriz, ativo, grupos_economicos_empresas(count)")
    .eq("segmento", "Revenda")
    .order("nome");

  const totalRedes = redes?.length ?? 0;
  const totalAtivas = redes?.filter((r) => r.ativo).length ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            Rede de Postos <AjudaIcon chave="rede_postos.pagina" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Agrupamento de postos revendedores sob a mesma Rede — usuários vinculados a um posto da Rede
            passam a ver os postos irmãos nas telas do sistema.
          </p>
        </div>
        <Link href="/rede-postos/novo" className="btn-primary">
          + Nova Rede
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <IndicadorColorido cor="sky" icon={Network} label="Total de redes" valor={String(totalRedes)} />
        <IndicadorColorido cor="green" icon={CheckCircle2} label="Ativas" valor={String(totalAtivas)} />
      </div>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar redes: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome da Rede</th>
              <th className="px-4 py-3">CNPJ Matriz</th>
              <th className="px-4 py-3">Postos vinculados</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {redes?.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-frota-50/60">
                <td className="px-4 py-3">
                  <Link href={`/rede-postos/${r.id}`} className="font-medium text-frota-600 hover:underline">
                    {r.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.cnpj_matriz ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(r.grupos_economicos_empresas as unknown as { count: number }[])?.[0]?.count ?? 0}
                </td>
                <td className="px-4 py-3">
                  <span className={r.ativo ? "badge-ativo" : "badge-inativo"}>
                    {r.ativo ? "Ativa" : "Inativa"}
                  </span>
                </td>
              </tr>
            ))}
            {redes?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma Rede de Postos cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
