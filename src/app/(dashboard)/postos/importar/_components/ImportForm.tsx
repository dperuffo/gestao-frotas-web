"use client";

import { useState, useTransition } from "react";
import type { ResultadoImportacaoPostosGf } from "@/app/api/postos/importar/route";

type EmpresaOpcao = { id: string; nome: string };

export function ImportForm({ empresas }: { empresas: EmpresaOpcao[] }) {
  const [resultado, setResultado] = useState<ResultadoImportacaoPostosGf | undefined>(undefined);
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
      const resposta = await fetch("/api/postos/importar", { method: "POST", body: formData }).then((r) => r.json());
      setResultado(resposta);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Cliente</label>
          <select name="empresa_id" required defaultValue="" className="input">
            <option value="" disabled>
              Selecione o cliente dono desta rede...
            </option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Arquivo postos_gf.xlsx
          </label>
          <input type="file" name="arquivo" accept=".xlsx" required className="input" />
        </div>
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Importando..." : "Importar postos"}
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
                CNPJ duplicado na planilha (só a última linha valeu): <strong>{resultado.duplicadas}</strong>
              </span>
            )}
            {resultado.conflitantes > 0 && (
              <span className="text-amber-700">
                Já pertencem a outro cliente (não importados): <strong>{resultado.conflitantes}</strong>
              </span>
            )}
          </div>
          {resultado.conflitantes > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Esses postos já foram ativados na rede de outro cliente e não podem ser reatribuídos por
              importação. Se isso for um engano, ajuste o dono do posto manualmente antes de reenviar a
              planilha.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
