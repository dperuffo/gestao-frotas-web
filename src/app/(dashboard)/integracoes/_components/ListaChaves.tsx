"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { alternarAtivoAcao, removerChaveAcao, sincronizarAgoraAcao } from "../actions";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

export type ChaveProfrotas = {
  id: number;
  cnpj_frota: string;
  nome_empresa: string;
  ativo: boolean;
  ultimo_sync: string | null;
  registros_sync: number | null;
  data_inicio_sync: string;
  // Fase 27.41 — quando preenchido, a frota real do cliente já ultrapassou
  // o limite do plano atual; a sincronização fica bloqueada nas actions
  // (ver integracoes/actions.ts) até o cliente fazer upgrade.
  avisoLimite?: string;
};

// Mesma máscara de sempre (00.000.000/0001-00), mas usando [0-9A-Z] em vez
// de \d — a partir de 2026 a Receita Federal emite CNPJs alfanuméricos, e o
// formato de exibição continua igual, só os caracteres é que podem ser letra.
function formatarCnpj(cnpj: string) {
  if (cnpj.length !== 14) return cnpj;
  return cnpj.replace(/([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})([0-9A-Z]{2})/, "$1.$2.$3/$4-$5");
}

function formatarDataHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ListaChaves({ chaves }: { chaves: ChaveProfrotas[] }) {
  const [erro, setErro] = useState<string | undefined>();
  const [mensagens, setMensagens] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [sincronizando, setSincronizando] = useState<string | undefined>();

  function handleSincronizar(cnpj: string) {
    setErro(undefined);
    setSincronizando(cnpj);
    startTransition(async () => {
      try {
        const resultado = await sincronizarAgoraAcao(cnpj);
        const resumo = resultado.erro
          ? `⚠️ ${resultado.salvos} registro(s) salvo(s), com erros: ${resultado.erro}`
          : `✅ ${resultado.salvos} registro(s) salvo(s) (${resultado.paginas} página(s), ${resultado.totalApi} na API).`;
        setMensagens((m) => ({ ...m, [cnpj]: resumo }));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao sincronizar.");
      } finally {
        setSincronizando(undefined);
      }
    });
  }

  function handleAlternarAtivo(id: number, ativo: boolean) {
    setErro(undefined);
    startTransition(async () => {
      try {
        await alternarAtivoAcao(id, !ativo);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao atualizar.");
      }
    });
  }

  function handleRemover(id: number, nome: string) {
    if (!confirm(`Remover a chave de "${nome}"? A sincronização automática para esse cliente vai parar.`)) return;
    setErro(undefined);
    startTransition(async () => {
      try {
        await removerChaveAcao(id);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao remover.");
      }
    });
  }

  return (
    <div className="card overflow-x-auto">
      <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">Chaves cadastradas</h2>
      {erro && <p className="mx-4 mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <table className="mt-2 w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">CNPJ da frota</th>
            <th className="px-4 py-3">Último sync</th>
            <th className="px-4 py-3">Registros</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"><span className="inline-flex items-center gap-1">Ações <AjudaIcon chave="integracoes.sync_manual" /></span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {chaves.map((c) => (
            <tr key={c.id} className="align-top transition-colors hover:bg-frota-50/60">
              <td className="px-4 py-3 font-medium text-slate-700">
                {c.nome_empresa}
                {c.avisoLimite && (
                  <p className="mt-1 max-w-xs text-xs font-normal text-red-700">
                    ⚠️ {c.avisoLimite}{" "}
                    <Link href="/assinatura" className="underline">
                      Ver planos
                    </Link>
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">{formatarCnpj(c.cnpj_frota)}</td>
              <td className="px-4 py-3 text-slate-600">
                {formatarDataHora(c.ultimo_sync)}
                {mensagens[c.cnpj_frota] && <p className="mt-1 text-xs text-slate-500">{mensagens[c.cnpj_frota]}</p>}
              </td>
              <td className="px-4 py-3 text-slate-600">{(c.registros_sync ?? 0).toLocaleString("pt-BR")}</td>
              <td className="px-4 py-3">
                <span className={c.ativo ? "badge-ativo" : "badge-inativo"}>{c.ativo ? "Ativo" : "Inativo"}</span>
                {c.avisoLimite && <span className="ml-1 badge-inativo">Limite excedido</span>}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-3 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => handleSincronizar(c.cnpj_frota)}
                    disabled={isPending || sincronizando === c.cnpj_frota}
                    className="text-frota-600 hover:underline disabled:opacity-50"
                  >
                    {sincronizando === c.cnpj_frota ? "Sincronizando..." : "Sincronizar agora"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAlternarAtivo(c.id, c.ativo)}
                    disabled={isPending}
                    className="text-slate-600 hover:underline disabled:opacity-50"
                  >
                    {c.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemover(c.id, c.nome_empresa)}
                    disabled={isPending}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {chaves.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                Nenhuma chave cadastrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
