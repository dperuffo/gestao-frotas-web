import Link from "next/link";

// Componente de paginação reutilizável — usado nas telas de listagem com
// muitos registros (Abastecimentos, Veículos, Motoristas, Chamados; ver
// Fase 27.12 no README). Server Component puro: os links são calculados
// durante o próprio render (sem estado/client), preservando os filtros já
// ativos na URL (busca, datas, cliente etc.) via `paramsAtuais`.
//
// `calcularPaginacao` fica no mesmo arquivo por conveniência — cada página
// chama essa função logo depois de ler o `searchParams.page`, pra decidir o
// offset/range da consulta e, depois de saber o total de registros, a
// página "atual" já dentro dos limites (evita `page=999` quebrar a tela).
export function calcularPaginacao(totalRegistros: number, porPagina: number, paginaParam?: string) {
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / porPagina));
  const paginaSolicitada = Math.max(1, parseInt(paginaParam ?? "1", 10) || 1);
  const paginaAtual = Math.min(paginaSolicitada, totalPaginas);
  const offset = (paginaAtual - 1) * porPagina;
  return { paginaAtual, totalPaginas, offset };
}

// Só usada pra decidir o offset/range ANTES de saber o total de registros
// (as duas consultas — contagem e página — rodam em paralelo). Não precisa
// clampar contra o total: um range fora dos limites simplesmente volta
// vazio, sem erro.
export function offsetDaPagina(porPagina: number, paginaParam?: string) {
  const pagina = Math.max(1, parseInt(paginaParam ?? "1", 10) || 1);
  return (pagina - 1) * porPagina;
}

const PAGINAS_VIZINHAS = 1;

export function Paginacao({
  paginaAtual,
  totalPaginas,
  totalRegistros,
  porPagina,
  basePath,
  paramsAtuais,
}: {
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  porPagina: number;
  basePath: string;
  paramsAtuais: Record<string, string | undefined>;
}) {
  if (totalPaginas <= 1) return null;

  function href(pagina: number) {
    const sp = new URLSearchParams();
    for (const [chave, valor] of Object.entries(paramsAtuais)) {
      if (valor) sp.set(chave, valor);
    }
    if (pagina > 1) sp.set("page", String(pagina));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const inicio = totalRegistros === 0 ? 0 : (paginaAtual - 1) * porPagina + 1;
  const fim = Math.min(paginaAtual * porPagina, totalRegistros);

  const paginasVisiveis = Array.from(
    new Set(
      [1, totalPaginas, paginaAtual - PAGINAS_VIZINHAS, paginaAtual, paginaAtual + PAGINAS_VIZINHAS].filter(
        (p) => p >= 1 && p <= totalPaginas
      )
    )
  ).sort((a, b) => a - b);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
      <p className="text-slate-500">
        Mostrando <span className="font-medium text-slate-700">{inicio}–{fim}</span> de{" "}
        <span className="font-medium text-slate-700">{totalRegistros}</span> registros
      </p>
      <nav className="flex items-center gap-1" aria-label="Paginação">
        {paginaAtual > 1 ? (
          <Link href={href(paginaAtual - 1)} className="rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100">
            ‹ Anterior
          </Link>
        ) : (
          <span className="rounded-md px-2.5 py-1.5 text-slate-300">‹ Anterior</span>
        )}
        {paginasVisiveis.map((p, i) => (
          <span key={p} className="flex items-center">
            {i > 0 && p - paginasVisiveis[i - 1] > 1 && <span className="px-1.5 text-slate-300">…</span>}
            {p === paginaAtual ? (
              <span className="min-w-[2rem] rounded-md bg-frota-600 px-2.5 py-1.5 text-center font-medium text-white">
                {p}
              </span>
            ) : (
              <Link href={href(p)} className="min-w-[2rem] rounded-md px-2.5 py-1.5 text-center text-slate-600 hover:bg-slate-100">
                {p}
              </Link>
            )}
          </span>
        ))}
        {paginaAtual < totalPaginas ? (
          <Link href={href(paginaAtual + 1)} className="rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100">
            Próxima ›
          </Link>
        ) : (
          <span className="rounded-md px-2.5 py-1.5 text-slate-300">Próxima ›</span>
        )}
      </nav>
    </div>
  );
}
