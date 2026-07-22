import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./_components/ImportForm";
import { BotaoExcluirPiso } from "./_components/BotaoExcluirPiso";

// Fase P0.5 (plano FNI_Plano_Implementacao_P0.md) — piso mínimo de frete
// (Res. ANTT 5.867/2020). Tabela NACIONAL (não é por tenant, ver migração
// fase_p0_5_pisos_antt) — tela exclusiva do time interno (perfil admin),
// mesmo padrão de /administracao/central-conteudo. O simulador de /cotacoes
// usa esses valores pra alertar quando o frete proposto fica abaixo do piso.
export default async function PisosAnttPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta tela é exclusiva do time interno (perfil administrador).
        </p>
      </div>
    );
  }

  const { data: pisos } = await supabase
    .from("pisos_antt")
    .select("id, tipo_carga, numero_eixos, coeficiente_deslocamento, coeficiente_carga_descarga, vigencia_inicio")
    .order("tipo_carga", { ascending: true })
    .order("numero_eixos", { ascending: true });

  const porTipo = new Map<string, typeof pisos>();
  for (const p of pisos ?? []) {
    const lista = porTipo.get(p.tipo_carga) ?? [];
    lista.push(p);
    porTipo.set(p.tipo_carga, lista);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Piso Mínimo ANTT</h1>
          <p className="mt-1 text-sm text-slate-500">
            Res. ANTT 5.867/2020 — piso = distância (km) × coeficiente de deslocamento + coeficiente de
            carga/descarga, por tipo de carga e nº de eixos.
          </p>
        </div>
        <a href="/administracao/pisos-antt/modelo" className="btn-secondary text-sm">
          Baixar modelo .xlsx
        </a>
      </div>

      <div className="mb-6">
        <ImportForm />
      </div>

      {Array.from(porTipo.entries()).map(([tipo, linhas]) => (
        <div key={tipo} className="card mb-6 overflow-x-auto p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">{tipo}</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nº de eixos</th>
                <th className="px-4 py-3">Coef. deslocamento (R$/km)</th>
                <th className="px-4 py-3">Coef. carga/descarga (R$)</th>
                <th className="px-4 py-3">Vigência</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(linhas ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-600">{p.numero_eixos}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.coeficiente_deslocamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td className="px-4 py-3 text-slate-600">{p.coeficiente_carga_descarga.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(`${p.vigencia_inicio}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <BotaoExcluirPiso id={p.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {(pisos ?? []).length === 0 && (
        <div className="card p-6 text-center text-sm text-slate-400">
          Nenhum piso ANTT cadastrado ainda — importe a planilha acima.
        </div>
      )}

      <div className="mt-2">
        <Link href="/cotacoes" className="text-sm text-frota-600 hover:underline">
          ← Ir para Cotações
        </Link>
      </div>
    </div>
  );
}
