"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mesma chave usada pelo indicador "Último: <cliente>" do menu (IndicadorClienteAtual).
const CHAVE_SESSAO = "fni:cliente-atual";

// Seletor de cliente do Assistente (usuário com mais de uma empresa no grupo).
// Trocar o cliente recarrega a página com ?empresa=<id> e reinicia a conversa.
export function SeletorClienteAssistente({
  empresas,
  empresaSelecionadaId,
  compacto = false,
}: {
  empresas: { id: string; nome: string }[];
  empresaSelecionadaId: string | null;
  compacto?: boolean;
}) {
  const router = useRouter();

  // Sem ?empresa= na URL, usa o último cliente escolhido na sessão (o mesmo que o menu
  // mostra como "Último: ..."), mantendo a pergunta que veio pelo link, se houver.
  // Só vale se o cliente ainda é um dos permitidos para este usuário.
  useEffect(() => {
    try {
      if (empresaSelecionadaId) {
        window.sessionStorage.setItem(CHAVE_SESSAO, empresaSelecionadaId);
        return;
      }
      const guardada = window.sessionStorage.getItem(CHAVE_SESSAO);
      if (guardada && empresas.some((e) => e.id === guardada)) {
        const sp = new URLSearchParams(window.location.search);
        sp.set("empresa", guardada);
        router.replace(`/assistente?${sp.toString()}`);
      }
    } catch {
      // sessionStorage indisponível: o usuário escolhe manualmente.
    }
  }, [empresaSelecionadaId, empresas, router]);
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compacto ? "" : "mb-4"}`}>
      <label htmlFor="cliente-assistente" className="text-xs font-medium text-slate-500 dark:text-slate-400">
        Cliente
      </label>
      <select
        id="cliente-assistente"
        className="input max-w-[16rem] text-sm"
        value={empresaSelecionadaId ?? ""}
        onChange={(e) => router.push(e.target.value ? `/assistente?empresa=${e.target.value}` : "/assistente")}
      >
        <option value="">Selecione um cliente…</option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
      {!empresaSelecionadaId && !compacto && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Escolha um cliente para usar preços negociados e dados de uma empresa específica.
        </span>
      )}
    </div>
  );
}
