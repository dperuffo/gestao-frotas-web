import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { RotogramaForm } from "../_components/RotogramaForm";
import type { RotogramaParada } from "../tipos";

type PrefillRoteirizacao = {
  origem?: string;
  destino?: string;
  placa?: string;
  paradas?: RotogramaParada[];
};

// Vem do botão "Gerar Rotograma" na aba Resumo da Roteirização — o resultado
// calculado (origem/destino/placa/paradas sugeridas de abastecimento) chega
// como JSON na query string em vez de gravar em rotas_salvas, porque
// rotas_salvas não guarda as paradas sugeridas pelo otimizador (só os
// waypoints digitados pelo usuário), e não queríamos perder essa informação
// no meio do caminho.
function parsePrefill(bruto: string | undefined): PrefillRoteirizacao | undefined {
  if (!bruto) return undefined;
  try {
    const dados = JSON.parse(bruto) as PrefillRoteirizacao;
    return dados && typeof dados === "object" ? dados : undefined;
  } catch {
    return undefined;
  }
}

export default async function NovoRotogramaPage({
  searchParams,
}: {
  searchParams: Promise<{ prefill?: string }>;
}) {
  const { prefill: prefillBruto } = await searchParams;
  const prefill = parsePrefill(prefillBruto);

  const supabase = await createClient();
  const { empresas } = await resolverEmpresaAtual(supabase);

  const { data: rotasSalvas } = await supabase
    .from("rotas_salvas")
    .select("id, nome")
    .eq("tipo", "roteirizacao")
    .order("criado_em", { ascending: false })
    .limit(50);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Rotograma</h1>
      {prefill && (
        <p className="mb-4 rounded-lg bg-frota-50 px-3 py-2 text-sm text-frota-700">
          Origem, destino{prefill.placa ? ", placa" : ""} e paradas sugeridas preenchidos a partir da rota
          calculada na Roteirização. Revise e ajuste o que precisar antes de salvar.
        </p>
      )}
      <RotogramaForm empresas={empresas} rotasSalvas={rotasSalvas ?? []} prefill={prefill} />
    </div>
  );
}
