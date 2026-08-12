"use client";

import { useRef, useState, useTransition } from "react";
import {
  prepararImportacaoMotoristas,
  processarLoteMotoristas,
  type LinhaResultado,
} from "../actions";
import { calcularPaginacao } from "@/components/Paginacao";

// Fase Indicador-Progresso-Import (12/08/2026) — mesma mudança aplicada em
// veiculos/importar/_components/ImportForm.tsx: a importação acontece em
// duas etapas (ver actions.ts) pra dar pra mostrar progresso real na tela.
const TAMANHO_LOTE = 100;
const POR_PAGINA = 50;

type ResultadoFinal = {
  total: number;
  sucesso: number;
  erros: number;
  linhas: LinhaResultado[];
};
type Progresso = {
  fase: "lendo" | "gravando";
  processadas: number;
  total: number;
};

export function ImportForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoFinal | null>(null);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pagina, setPagina] = useState(1);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setErro(null);
    setResultado(null);
    setPagina(1);

    startTransition(async () => {
      setProgresso({ fase: "lendo", processadas: 0, total: 0 });

      const prep = await prepararImportacaoMotoristas(formData);
      if ("erro" in prep) {
        setErro(prep.erro);
        setProgresso(null);
        return;
      }

      const linhasAcumuladas: LinhaResultado[] = [...prep.errosIniciais];
      const publicar = () => {
        setResultado({
          total: linhasAcumuladas.length,
          sucesso: linhasAcumuladas.filter((l) => l.status === "ok").length,
          erros: linhasAcumuladas.filter((l) => l.status === "erro").length,
          linhas: [...linhasAcumuladas].sort((a, b) => a.linha - b.linha),
        });
      };

      setProgresso({
        fase: "gravando",
        processadas: linhasAcumuladas.length,
        total: prep.totalLinhas,
      });
      if (linhasAcumuladas.length > 0) publicar();

      for (let i = 0; i < prep.preparadas.length; i += TAMANHO_LOTE) {
        const lote = prep.preparadas.slice(i, i + TAMANHO_LOTE);
        const resultadosLote = await processarLoteMotoristas(lote);
        linhasAcumuladas.push(...resultadosLote);
        setProgresso({
          fase: "gravando",
          processadas: linhasAcumuladas.length,
          total: prep.totalLinhas,
        });
        publicar();
      }

      setProgresso(null);
    });
  }

  const linhas = resultado?.linhas ?? [];
  const { paginaAtual, totalPaginas } = calcularPaginacao(
    linhas.length,
    POR_PAGINA,
    String(pagina),
  );
  const linhasPagina = linhas.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA,
  );
  const percentual =
    progresso && progresso.total > 0
      ? Math.round((progresso.processadas / progresso.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="card space-y-4 p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Arquivo Excel (.xlsx)
          </label>
          <input
            type="file"
            name="arquivo"
            accept=".xlsx"
            required
            className="input"
            disabled={isPending}
          />
          <p className="mt-1 text-xs text-slate-500">
            Baixe o modelo acima, preencha uma linha por motorista e envie o
            arquivo aqui. Planilhas grandes (milhares de linhas) são processadas
            em lotes — acompanhe o progresso abaixo.
          </p>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary disabled:opacity-50"
        >
          {isPending ? "Importando..." : "Importar motoristas"}
        </button>
      </form>

      {progresso && (
        <div className="card p-4">
          {progresso.fase === "lendo" ? (
            <p className="text-sm text-slate-600">
              Lendo e validando a planilha...
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>
                  Gravando {progresso.processadas} de {progresso.total}{" "}
                  linhas...
                </span>
                <span className="font-medium">{percentual}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-frota-600 transition-all"
                  style={{ width: `${percentual}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {erro && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {resultado && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap gap-4 border-b border-slate-100 p-4 text-sm">
            <span>
              Total processado: <strong>{resultado.total}</strong>
            </span>
            <span className="text-status-ativo">
              Sucesso: <strong>{resultado.sucesso}</strong>
            </span>
            <span className="text-red-600">
              Erros: <strong>{resultado.erros}</strong>
            </span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Linha</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhasPagina.map((l) => (
                <tr key={l.linha}>
                  <td className="px-4 py-3">{l.linha}</td>
                  <td className="px-4 py-3">{l.identificacao}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        l.status === "ok" ? "badge-ativo" : "badge-inativo"
                      }
                    >
                      {l.status === "ok" ? "OK" : "Erro"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.mensagem}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4">
            <PaginacaoLocal
              paginaAtual={paginaAtual}
              totalPaginas={totalPaginas}
              totalRegistros={linhas.length}
              porPagina={POR_PAGINA}
              aoMudarPagina={setPagina}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Mesma aparência/comportamento do componente <Paginacao> (src/components/Paginacao.tsx),
// só que dirigido por estado local (onClick) em vez de Link/URL -- o
// resultado de um import não tem URL própria pra guardar a página atual.
const PAGINAS_VIZINHAS = 1;

function PaginacaoLocal({
  paginaAtual,
  totalPaginas,
  totalRegistros,
  porPagina,
  aoMudarPagina,
}: {
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  porPagina: number;
  aoMudarPagina: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  const inicio = totalRegistros === 0 ? 0 : (paginaAtual - 1) * porPagina + 1;
  const fim = Math.min(paginaAtual * porPagina, totalRegistros);

  const paginasVisiveis = Array.from(
    new Set(
      [
        1,
        totalPaginas,
        paginaAtual - PAGINAS_VIZINHAS,
        paginaAtual,
        paginaAtual + PAGINAS_VIZINHAS,
      ].filter((p) => p >= 1 && p <= totalPaginas),
    ),
  ).sort((a, b) => a - b);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
      <p className="text-slate-500">
        Mostrando{" "}
        <span className="font-medium text-slate-700">
          {inicio}–{fim}
        </span>{" "}
        de <span className="font-medium text-slate-700">{totalRegistros}</span>{" "}
        linhas
      </p>
      <nav className="flex items-center gap-1" aria-label="Paginação">
        <button
          type="button"
          onClick={() => aoMudarPagina(paginaAtual - 1)}
          disabled={paginaAtual === 1}
          className="rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
        >
          ‹ Anterior
        </button>
        {paginasVisiveis.map((p, i) => (
          <span key={p} className="flex items-center">
            {i > 0 && p - paginasVisiveis[i - 1] > 1 && (
              <span className="px-1.5 text-slate-300">…</span>
            )}
            {p === paginaAtual ? (
              <span className="min-w-[2rem] rounded-md bg-frota-600 px-2.5 py-1.5 text-center font-medium text-white">
                {p}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => aoMudarPagina(p)}
                className="min-w-[2rem] rounded-md px-2.5 py-1.5 text-center text-slate-600 hover:bg-slate-100"
              >
                {p}
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          onClick={() => aoMudarPagina(paginaAtual + 1)}
          disabled={paginaAtual === totalPaginas}
          className="rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
        >
          Próxima ›
        </button>
      </nav>
    </div>
  );
}
