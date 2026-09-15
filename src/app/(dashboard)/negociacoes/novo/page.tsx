import { redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { FormularioNovaNegociacao } from "../_components/FormularioNovaNegociacao";

type SearchParams = { empresa?: string; cnpj?: string };

// Fase Plano-Metricas-Fidelidade (15/09/2026) — "cnpj" opcional na URL:
// alimentado pelo CTA "Negociar com este posto" da lista de postos externos
// recorrentes em /negociacoes (ver AderenciaRede.tsx), pré-preenche o campo
// de CNPJ do posto-alvo pra não obrigar o cliente a redigitar um CNPJ que o
// sistema já sabe (veio de abastecimentos_unificado). Reaproveita o mesmo
// formulário/fluxo de sempre — não é um caminho novo de criação.
export default async function NovaNegociacaoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaId, cnpj } = await searchParams;
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
      <FormularioNovaNegociacao empresaAtualId={empresaId} souPosto={souPosto} cnpjInicial={cnpj} />
    </div>
  );
}
