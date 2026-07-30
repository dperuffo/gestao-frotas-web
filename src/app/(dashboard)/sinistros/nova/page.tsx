import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { NovoSinistroForm } from "../_components/NovoSinistroForm";

export default async function NovoSinistroPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, empresas } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente em <Link href="/sinistros" className="underline">Sinistros</Link> antes de registrar um novo sinistro.
        </p>
      </div>
    );
  }

  const { data: veiculosDaEmpresa } = await supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresaSelecionada });
  const placas = (veiculosDaEmpresa ?? []).map((v) => v.placa).filter((p): p is string => Boolean(p)).sort();

  return (
    <div>
      <div className="mb-6">
        <Link href={`/sinistros?empresa=${empresaSelecionada}`} className="text-sm text-frota-600 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Novo Sinistro</h1>
      </div>
      <NovoSinistroForm empresaId={empresaSelecionada} placas={placas} />
    </div>
  );
}
