"use client";

import { useState, useTransition } from "react";
import type { ResultadoImportacaoPrecos } from "@/app/api/postos/importar-precos/route";

export function ImportForm() {
  const [resultado, setResultado] = useState<ResultadoImportacaoPrecos | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  // Fase corrige-bloqueio-cloudflare-waf — antes chamava a Server Action
  // direto; agora manda um POST comum (fetch + FormData) pra rota de API,
  // porque o protocolo de Server Actions bate na regra do WAF gerenciado da
  // Cloudflare (CVE-2025-55183) mesmo o app já estando corrigido, e o plano
  // gratuito não deixa criar exceção pra liberar só essa rota.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resposta = await fetch("/api/postos/importar-precos", { method: "POST", body: formData }).then((r) => r.json());
      setResultado(resposta);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Arquivo preco_posto.xlsx
          </label>
          <input type="file" name="arquivo" accept=".xlsx" required className="input" />
          <p className="mt-1 text-xs text-slate-500">
            Planilha grande (~14 mil linhas) — a importação pode levar alguns instantes.
          </p>
        </div>
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Importando..." : "Importar preços"}
        </button>
      </form>

      {resultado && "erro" in resultado && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{resultado.erro}</div>
      )}

      {resultado && "sucesso" in resultado && (
        <div className="card p-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <span>
              Total processado: <strong>{resultado.total}</strong>
            </span>
            <span className="text-status-ativo">
              Sucesso: <strong>{resultado.sucesso}</strong>
            </span>
            <span className="text-red-600">
              Erros: <strong>{resultado.erros}</strong>
            </span>
            {resultado.duplicadas > 0 && (
              <span className="text-amber-700">
                Repetidas na planilha (só a última valeu): <strong>{resultado.duplicadas}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
