import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { verificarAcessoFretes, mensagemAcessoFretesBloqueado } from "@/lib/limitePlano";
import { FreteForm } from "../_components/FreteForm";

export default async function NovoFretePage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <p className="p-4 text-sm text-slate-500">
          Selecione uma empresa em <Link href="/fretes" className="text-frota-600 hover:underline">Fretes</Link> antes de
          publicar.
        </p>
      </div>
    );
  }

  // Gestão de Fretes é liberada a partir do Profissional (até 30/mês) ou
  // Enterprise (ilimitado), com exceção do período de trial — pedido do
  // Daniel (18/07, ajustado na calibração TMS/ERP de 23/07). Bloqueia aqui
  // além de em criarFrete (actions.ts) pra nem mostrar o formulário à toa.
  const acesso = await verificarAcessoFretes(supabase, empresaSelecionada);
  if (!acesso.ok) {
    return (
      <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {mensagemAcessoFretesBloqueado(acesso)}{" "}
        <Link href={`/assinatura?empresa=${empresaSelecionada}`} className="font-medium underline">
          Ver planos
        </Link>
        .
      </div>
    );
  }

  const [{ data: proprios }, { data: parceiros }] = await Promise.all([
    supabase.from("motoristas").select("id, nome_completo").eq("empresa_id", empresaSelecionada).eq("status", "Ativo"),
    supabase.rpc("meus_parceiros_empresa", { p_empresa_id: empresaSelecionada }),
  ]);

  const motoristas = [
    ...(proprios ?? []).map((m) => ({ id: m.id, nome: m.nome_completo, origem: "proprio" as const })),
    ...(parceiros ?? [])
      .filter((p) => (p as { status: string }).status === "ativo")
      .map((p) => ({
        id: (p as { motorista_id: string }).motorista_id,
        nome: (p as { nome_completo: string }).nome_completo,
        origem: "parceiro" as const,
      })),
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">🚚 Publicar frete</h1>
        <p className="mt-1 text-sm text-slate-500">{nomeEmpresaSelecionada}</p>
      </div>
      <FreteForm empresaId={empresaSelecionada} motoristas={motoristas} />
    </div>
  );
}
