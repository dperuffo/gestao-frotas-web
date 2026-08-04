"use client";

import { useTransition } from "react";
import { alternarAtivoAvisoEmpresaAcao, excluirAvisoEmpresaAcao, type AvisoDaMinhaEmpresa } from "../actions";
import { formatarDataHoraBr } from "@/lib/utils";

const TIPO_LABEL: Record<string, string> = {
  aviso_geral: "📣 Aviso geral",
  novidade: "🆕 Novidade",
  correcao: "🐛 Correção",
  manutencao: "🔧 Manutenção",
};

// Fase Central-Avisos-Por-Empresa (04/08/2026) — lista dos avisos que a
// própria empresa do usuário já publicou (inclusive inativos, diferente do
// histórico público em /central-avisos, que só mostra ativo=true pra
// não-admin). Toggle/excluir chamam as RPCs ownership-checadas
// (alternar_ativo_aviso_empresa/excluir_aviso_empresa) — mesmo padrão de
// ToggleAtivoAviso/BotaoExcluirAviso do painel admin.
export function ListaAvisosEmpresa({ avisos }: { avisos: AvisoDaMinhaEmpresa[] }) {
  const [isPending, startTransition] = useTransition();

  if (avisos.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sua empresa ainda não publicou nenhum aviso.</p>;
  }

  return (
    <div className="space-y-3">
      {avisos.map((a) => (
        <div key={a.id} className="card flex items-start justify-between gap-4 p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{TIPO_LABEL[a.tipo] ?? a.tipo}</span>
              {!a.ativo && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Inativo</span>
              )}
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">{a.titulo}</p>
            <p className="mt-0.5 text-sm text-slate-600">{a.resumo}</p>
            <p className="mt-1 text-xs text-slate-400">Publicado em {formatarDataHoraBr(a.data_publicacao)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => alternarAtivoAvisoEmpresaAcao(a.id, !a.ativo))}
              className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
            >
              {a.ativo ? "Desativar" : "Ativar"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (confirm("Excluir este aviso? Não tem como desfazer.")) {
                  startTransition(() => excluirAvisoEmpresaAcao(a.id));
                }
              }}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
