"use client";

import { useState, useTransition } from "react";
import { revogarChaveApiAcao } from "../actionsApiKeys";
import { CATALOGO_ESCOPOS } from "@/lib/apiKeys";

export type ChaveCustosFixos = {
  id: string;
  nome: string;
  empresa_nome: string | null;
  ativa: boolean | null;
  criada_em: string | null;
  ultimo_uso: string | null;
  escopos: string[];
};

function formatarDataHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function labelEscopo(escopo: string): string {
  return CATALOGO_ESCOPOS.find((e) => e.escopo === escopo)?.label ?? escopo;
}

export function ListaChavesCustosFixos({ chaves }: { chaves: ChaveCustosFixos[] }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleRevogar(id: string, nome: string) {
    if (!confirm(`Revogar a chave "${nome}"? Sistemas externos que usam ela param de conseguir enviar/ler dados.`)) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await revogarChaveApiAcao(id);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="card mt-4 overflow-x-auto">
      <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">Chaves de API</h2>
      {erro && <p className="mx-4 mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <table className="mt-2 w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Permissões</th>
            <th className="px-4 py-3">Criada em</th>
            <th className="px-4 py-3">Último uso</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {chaves.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-700">{c.empresa_nome ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{c.nome}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {c.escopos.map((e) => (
                    <span key={e} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {labelEscopo(e)}
                    </span>
                  ))}
                  {c.escopos.length === 0 && "—"}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">{formatarDataHora(c.criada_em)}</td>
              <td className="px-4 py-3 text-slate-600">{formatarDataHora(c.ultimo_uso)}</td>
              <td className="px-4 py-3">
                <span className={c.ativa ? "badge-ativo" : "badge-inativo"}>{c.ativa ? "Ativa" : "Revogada"}</span>
              </td>
              <td className="px-4 py-3">
                {c.ativa && (
                  <button
                    type="button"
                    onClick={() => handleRevogar(c.id, c.nome)}
                    disabled={isPending}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    Revogar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {chaves.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                Nenhuma chave gerada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
