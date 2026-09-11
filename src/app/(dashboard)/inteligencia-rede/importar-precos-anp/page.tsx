import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./_components/ImportForm";

export default async function ImportarPrecosAnpPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          A atualização da série oficial de preços ANP é exclusiva do time interno (perfil
          administrador).
        </p>
      </div>
    );
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Atualizar Preços Oficiais ANP"
        descricao={
          <>
            Envie a planilha <code>precos_anp.xlsx</code> — o relatório semanal &quot;Levantamento de Preços de
            Combustíveis&quot; da ANP, com as abas BRASIL, REGIOES, ESTADOS, MUNICIPIOS e CAPITAIS. Esses dados
            alimentam a comparação de preços na Inteligência de Rede (em vez de uma estimativa fixa).
          </>
        }
      />

      <ImportForm />

      <div className="mt-6">
        <Link href="/inteligencia-rede" className="text-sm text-frota-600 hover:underline">
          ← Voltar para a Inteligência de Rede
        </Link>
      </div>
    </div>
  );
}
