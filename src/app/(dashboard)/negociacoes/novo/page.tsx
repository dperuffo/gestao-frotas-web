import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormularioNovaNegociacao } from "../_components/FormularioNovaNegociacao";

type SearchParams = { empresa?: string };

export default async function NovaNegociacaoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaId } = await searchParams;
  if (!empresaId) redirect("/negociacoes");

  const supabase = await createClient();
  const { data: empresa } = await supabase.from("empresas").select("segmento").eq("id", empresaId).maybeSingle();
  const souPosto = empresa?.segmento === "Revenda";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Nova negociação</h1>
        <p className="mt-1 text-sm text-slate-500">
          {souPosto
            ? "Envie uma proposta de fornecimento para um cliente."
            : "Envie uma proposta de fornecimento para um posto parceiro."}
        </p>
      </div>
      <FormularioNovaNegociacao empresaAtualId={empresaId} souPosto={souPosto} />
    </div>
  );
}
