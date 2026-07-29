import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { NovaMultaForm } from "../_components/NovaMultaForm";

export default async function NovaMultaPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, empresas } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente em <Link href="/multas" className="underline">Multas</Link> antes de registrar uma nova multa.
        </p>
      </div>
    );
  }

  // cadastro_veiculos não tem empresa_id (vínculo é por cnpj_frota) — usa a
  // RPC veiculos_da_empresa, mesmo padrão de /veiculos.
  const { data: veiculosDaEmpresa } = await supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresaSelecionada });
  const placas = (veiculosDaEmpresa ?? []).map((v) => v.placa).filter((p): p is string => Boolean(p)).sort();

  return (
    <div>
      <div className="mb-6">
        <Link href={`/multas?empresa=${empresaSelecionada}`} className="text-sm text-frota-600 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Nova Multa</h1>
      </div>
      <NovaMultaForm empresaId={empresaSelecionada} placas={placas} />
    </div>
  );
}
