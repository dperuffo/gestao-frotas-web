import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./_components/ImportForm";

export default async function ImportarPrecosAnpPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          A atualização da série oficial de preços ANP é exclusiva do time interno (perfil
          administrador).
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Atualizar Preços Oficiais ANP</h1>
        <p className="mt-1 text-sm text-slate-500">
          Envie a planilha <code>precos_anp.xlsx</code> — o relatório semanal &quot;Levantamento
          de Preços de Combustíveis&quot; da ANP, com as abas BRASIL, REGIOES, ESTADOS,
          MUNICIPIOS e CAPITAIS. Esses dados alimentam a comparação de preços na Inteligência de
          Rede (em vez de uma estimativa fixa).
        </p>
      </div>

      <ImportForm />

      <div className="mt-6">
        <Link href="/inteligencia-rede" className="text-sm text-frota-600 hover:underline">
          ← Voltar para a Inteligência de Rede
        </Link>
      </div>
    </div>
  );
}
