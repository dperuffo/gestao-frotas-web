"use client";

import { useRef, useState, useTransition } from "react";
import { importarMotoristas, type ResultadoImportacao } from "../actions";
import { calcularPaginacao } from "@/components/Paginacao";

// Fase Corrige-Timeout-Import-Grande (12/08/2026, pedido do Daniel: cliente
// com mais de 2500 registros na base) -- mesma paginação client-side
// aplicada em veiculos/importar/_components/ImportForm.tsx, reaproveitando
// `calcularPaginacao` (o mesmo helper usado em /veiculos, /motoristas,
// /abastecimentos etc.) em vez de uma lógica nova só pra esta tela.
const POR_PAGINA = 50;

export function ImportForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const [pagina, setPagina] = useState(1);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resposta = await importarMotoristas(undefined, formData);
      setResultado(resposta);
      setPagina(1);
    });
  }

  const linhas = resultado && "linhas" in resultado ? resultado.linhas : [];
  const { paginaAtual, totalPaginas } = calcularPaginacao(linhas.length, POR_PAGINA, String(pagina));
  const linhasPagina = linhas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={handleSubmit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Arquivo Excel (.xlsx)</label>
          <input type="file" name="arquivo" accept=".xlsx" required className="input" />
          <p className="mt-1 text-xs text-slate-500">
            Baixe o modelo acima, preencha uma linha por motorista e envie o arquivo aqui.
          </p>
        </div>
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Importando..." : "Importar motoristas"}
        </button>
      </form>

      {resultado && "erro" in resultado && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{resultado.erro}</div>
      )}

      {resultado && "linhas" in resultado && (
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
                    <span className={l.status === "ok" ? "badge-ativo" : "badge-inativo"}>
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
// só que dirigido por estado local (onClick) em vez de Link/URL -- ver
// comentário no topo do arquivo sobre por que não dá pra reaproveitar aquele
// componente diretamente aqui.
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
      [1, totalPaginas, paginaAtual - PAGINAS_VIZINHAS, paginaAtual, paginaAtual + PAGINAS_VIZINHAS].filter(
        (p) => p >= 1 && p <= totalPaginas
      )
    )
  ).sort((a, b) => a - b);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
      <p className="text-slate-500">
        Mostrando <span className="font-medium text-slate-700">{inicio}–{fim}</span> de{" "}
        <span className="font-medium text-slate-700">{totalRegistros}</span> linhas
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
            {i > 0 && p - paginasVisiveis[i - 1] > 1 && <span className="px-1.5 text-slate-300">…</span>}
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
