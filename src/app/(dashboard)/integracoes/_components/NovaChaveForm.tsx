"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { salvarChaveAcao, validarTokenAcao } from "../actions";

export function NovaChaveForm() {
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const [token, setToken] = useState("");
  const [validacao, setValidacao] = useState<{ ok: boolean; mensagem: string } | undefined>();
  const [isValidando, startValidacao] = useTransition();

  function handleValidar() {
    setValidacao(undefined);
    startValidacao(async () => {
      const resultado = await validarTokenAcao(token);
      setValidacao(resultado);
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(undefined);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const resultado = await salvarChaveAcao(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      if (resultado?.sucesso) {
        setSucesso(resultado.sucesso);
        form.reset();
        setToken("");
        setValidacao(undefined);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <h2 className="text-sm font-semibold text-slate-900">Cadastrar chave de acesso do cliente</h2>
      <p className="text-xs text-slate-500">
        Informe o token JWT obtido no portal <strong>portal.profrotas.com.br</strong>. O CNPJ precisa
        corresponder a um cliente já cadastrado em{" "}
        <Link href="/clientes" className="text-frota-600 hover:underline">
          /clientes
        </Link>
        .
      </p>

      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{sucesso}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            CNPJ da Frota <span className="text-red-500">*</span>
          </label>
          <input name="cnpj_frota" placeholder="00.000.000/0001-00" className="input" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Nome da Empresa <span className="text-red-500">*</span>
          </label>
          <input name="nome_empresa" placeholder="Ex: Lenarge Transportes Ltda" className="input" required />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Token JWT <span className="text-red-500">*</span>
        </label>
        <textarea
          name="token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
          rows={3}
          className="input font-mono text-xs"
          required
        />
      </div>

      {validacao && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${validacao.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          {validacao.ok ? "✅" : "❌"} {validacao.mensagem}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleValidar}
          disabled={isValidando || !token.trim()}
          className="btn-secondary"
        >
          {isValidando ? "Validando..." : "Validar"}
        </button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
