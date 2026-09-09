import { redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
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
      <CabecalhoPagina
        titulo="Nova negociação"
        descricao={
          souPosto
            ? "Envie uma proposta de fornecimento para um cliente."
            : "Envie uma proposta de fornecimento para um posto parceiro."
        }
      />
      <FormularioNovaNegociacao empresaAtualId={empresaId} souPosto={souPosto} />
    </div>
  );
}
