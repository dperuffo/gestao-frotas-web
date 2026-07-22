"use client";

import { useState, useTransition } from "react";
import { enviarCertificadoAcao, testarConexaoAcao } from "../actions";

// Fase P0.1 — envio do certificado A1 + teste de conexão. O arquivo .pfx é
// repassado direto ao provedor pela Server Action — nunca fica no FNI.
// No provedor SIMULADO, dois valores especiais disparam os caminhos de erro
// pra QA: senha "senha-errada" e arquivo menor que 100 bytes.

export function FormularioCertificado({
  empresaId,
  certificadoVencimento,
  statusConexao,
  statusConexaoEm,
}: {
  empresaId: string;
  certificadoVencimento: string | null;
  statusConexao: string | null;
  statusConexaoEm: string | null;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [ok, setOk] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTesting] = useTransition();

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-slate-900">Certificado digital A1</h2>
      <p className="mb-4 mt-1 text-xs text-slate-500">
        O arquivo (.pfx/.p12) e a senha são enviados diretamente ao provedor fiscal — o FNI não guarda o
        certificado, só o vencimento, para avisar quando estiver perto de expirar.
        {certificadoVencimento && (
          <span className="ml-1 font-medium text-slate-700">Certificado atual vence em {certificadoVencimento.split("-").reverse().join("/")}.</span>
        )}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErro(undefined);
          setOk(undefined);
          const formData = new FormData(e.currentTarget);
          formData.set("empresa_id", empresaId);
          startTransition(async () => {
            const resultado = await enviarCertificadoAcao(formData);
            if (resultado?.erro) setErro(resultado.erro);
            else setOk(resultado?.ok ?? "Certificado enviado.");
          });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Arquivo (.pfx / .p12)</label>
          <input type="file" name="certificado" accept=".pfx,.p12" required className="input w-64 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Senha do certificado</label>
          <input type="password" name="senha" required className="input w-44 text-sm" />
        </div>
        <button type="submit" disabled={isPending} className="btn-primary text-sm">
          {isPending ? "Enviando..." : "Enviar ao provedor"}
        </button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isTesting}
            className="btn-secondary text-sm"
            onClick={() => {
              setErro(undefined);
              setOk(undefined);
              const formData = new FormData();
              formData.set("empresa_id", empresaId);
              startTesting(async () => {
                const resultado = await testarConexaoAcao(formData);
                if (resultado?.erro) setErro(resultado.erro);
                else setOk(resultado?.ok ?? "Conexão OK.");
              });
            }}
          >
            {isTesting ? "Testando..." : "Testar conexão com o provedor"}
          </button>
          {statusConexao && (
            <span className={`text-xs ${statusConexao.startsWith("OK") ? "text-green-700" : "text-red-600"}`}>
              Último teste{statusConexaoEm ? ` (${new Date(statusConexaoEm).toLocaleString("pt-BR")})` : ""}: {statusConexao}
            </span>
          )}
        </div>
      </div>

      {erro && <p className="mt-3 text-xs text-red-600">{erro}</p>}
      {ok && <p className="mt-3 text-xs text-green-700">{ok}</p>}
    </div>
  );
}
