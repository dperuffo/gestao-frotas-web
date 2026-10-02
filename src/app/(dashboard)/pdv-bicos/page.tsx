import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { CatalogoBicosPdv } from "./_components/CatalogoBicosPdv";

type SearchParams = { empresa?: string };

// Fase 4 PDV (02/10/2026, pedido do Daniel) — tela ADMIN pra configurar o
// catálogo fixo de bombas/bicos/combustíveis (pdv_bicos_catalogo, Fase 4)
// de qualquer revenda (segmento "Revenda"). Mesmo catálogo que alimenta a
// tela de seleção de leitura no pdv-fni e o robô de teste
// (robo_teste_pdv_gerar_lote_leituras) — sem bico cadastrado, o robô não
// tem o que sortear. O posto também gerencia o próprio catálogo direto no
// pdv-fni (/bicos); essa tela aqui é pro admin configurar em nome de
// qualquer revenda (ex.: onboarding de um piloto novo).
export default async function PdvBicosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas: todasEmpresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(
    supabase,
    empresaParam
  );

  // Só revendas (postos) têm bomba/bico — mesmo filtro usado em
  // rede-postos/novo e rede-postos/[id] pra listar postos.
  let revendas = todasEmpresas;
  if (todasEmpresas.length > 0) {
    const { data: comSegmento } = await supabase
      .from("empresas")
      .select("id, segmento")
      .in(
        "id",
        todasEmpresas.map((e) => e.id)
      );
    const idsRevenda = new Set((comSegmento ?? []).filter((e) => e.segmento === "Revenda").map((e) => e.id));
    revendas = todasEmpresas.filter((e) => idsRevenda.has(e.id));
  }

  const revendaValida = revendas.some((e) => e.id === empresaSelecionada) ? empresaSelecionada : null;
  const semRevendaEscolhida = revendas.length > 1 && !revendaValida;

  let bicosIniciais: {
    id: string;
    bomba: number;
    lado: string;
    posicao: number;
    numero_bico: number;
    codigo_combustivel: string;
    combustivel: string;
    preco_litro_base: number;
    ativo: boolean;
  }[] = [];
  if (revendaValida) {
    const { data } = await supabase
      .from("pdv_bicos_catalogo")
      .select("id, bomba, lado, posicao, numero_bico, codigo_combustivel, combustivel, preco_litro_base, ativo")
      .eq("revenda_empresa_id", revendaValida)
      .order("bomba")
      .order("numero_bico");
    bicosIniciais = data ?? [];
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Bombas, Bicos e Combustíveis (PDV)"
        descricao={`Catálogo fixo de bicos que alimenta a seleção de leitura no PDV${nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.`}
      />

      {revendas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Revenda</label>
            <select name="empresa" defaultValue={revendaValida ?? ""} className="input text-sm">
              <option value="">Selecione uma revenda...</option>
              {revendas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      {revendas.length === 0 ? (
        <p className="card p-6 text-sm text-slate-500 dark:text-slate-400">
          Nenhuma revenda (posto) encontrada.
        </p>
      ) : semRevendaEscolhida || !revendaValida ? (
        <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Selecione uma revenda acima para configurar.</p>
      ) : (
        <CatalogoBicosPdv revendaEmpresaId={revendaValida} bicosIniciais={bicosIniciais} />
      )}
    </div>
  );
}
