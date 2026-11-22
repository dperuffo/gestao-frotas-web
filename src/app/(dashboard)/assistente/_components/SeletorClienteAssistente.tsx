"use client";

import { useRouter } from "next/navigation";

// Seletor de cliente do Assistente (usuário com mais de uma empresa no grupo).
// Trocar o cliente recarrega a página com ?empresa=<id> e reinicia a conversa.
export function SeletorClienteAssistente({
  empresas,
  empresaSelecionadaId,
}: {
  empresas: { id: string; nome: string }[];
  empresaSelecionadaId: string | null;
}) {
  const router = useRouter();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label htmlFor="cliente-assistente" className="text-xs font-medium text-slate-500 dark:text-slate-400">
        Cliente
      </label>
      <select
        id="cliente-assistente"
        className="input max-w-xs text-sm"
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
      {!empresaSelecionadaId && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Escolha um cliente para usar preços negociados e dados de uma empresa específica.
        </span>
      )}
    </div>
  );
}
