import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ChamadoForm } from "../_components/ChamadoForm";

export default async function NovoChamadoPage() {
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Chamado</h1>
      <ChamadoForm empresas={empresas} empresaSelecionadaInicial={empresaSelecionada} />
    </div>
  );
}
