"use client";

import { useState, useTransition } from "react";
import type { ResultadoImportacaoPrecosAnp } from "@/app/api/inteligencia-rede/importar-precos-anp/route";

export function ImportForm() {
  const [resultado, setResultado] = useState<ResultadoImportacaoPrecosAnp | undefined>(undefined);
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
      const resposta = await fetch("/api/inteligencia-rede/importar-precos-anp", { method: "POST", body: formData }).then((r) =>
        r.json()
      );
      setResultado(resposta);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Arquivo precos_anp.xlsx
          </label>
          <input type="file" name="arquivo" accept=".xlsx" required className="input" />
        </div>
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Importando..." : "Importar preços oficiais"}
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
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-slate-600">
            {Object.entries(resultado.porNivel).map(([nivel, qtd]) => (
              <span key={nivel}>
                {nivel}: <strong>{qtd}</strong>
              </span>
            ))}
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
