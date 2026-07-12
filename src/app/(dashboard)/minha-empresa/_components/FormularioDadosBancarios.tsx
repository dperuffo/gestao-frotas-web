"use client";

import { useState, useTransition } from "react";
import { atualizarDadosBancariosAcao, type DadosBancarios } from "../actions";

type Props = {
  empresaId: string;
  dadosAtuais: {
    banco_codigo: string | null;
    banco_nome: string | null;
    agencia: string | null;
    agencia_digito: string | null;
    conta: string | null;
    conta_digito: string | null;
    tipo_conta: string | null;
    titular_nome: string | null;
    titular_documento: string | null;
  };
};

// Fase 27.141 — self-service: o posto cadastra os próprios dados bancários.
// Por enquanto isso só alimenta o cadastro — é a base pra, futuramente,
// ajustar o layout do boleto conforme o domicílio bancário do
// estabelecimento (nenhuma lógica de boleto usa esses campos ainda).
export function FormularioDadosBancarios({ empresaId, dadosAtuais }: Props) {
  const [dados, setDados] = useState<DadosBancarios>({
    bancoCodigo: dadosAtuais.banco_codigo ?? "",
    bancoNome: dadosAtuais.banco_nome ?? "",
    agencia: dadosAtuais.agencia ?? "",
    agenciaDigito: dadosAtuais.agencia_digito ?? "",
    conta: dadosAtuais.conta ?? "",
    contaDigito: dadosAtuais.conta_digito ?? "",
    tipoConta: (dadosAtuais.tipo_conta as DadosBancarios["tipoConta"]) ?? "",
    titularNome: dadosAtuais.titular_nome ?? "",
    titularDocumento: dadosAtuais.titular_documento ?? "",
  });
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function campo<K extends keyof DadosBancarios>(chave: K, valor: DadosBancarios[K]) {
    setDados((d) => ({ ...d, [chave]: valor }));
  }

  function salvar() {
    setMensagem(null);
    startTransition(async () => {
      try {
        await atualizarDadosBancariosAcao(empresaId, dados);
        setMensagem({ tipo: "sucesso", texto: "Dados bancários salvos." });
      } catch (e) {
        setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao salvar." });
      }
    });
  }

  const temAlgumDado = Object.values(dadosAtuais).some(Boolean);

  return (
    <div className="card mt-6 p-6">
      <h2 className="text-sm font-semibold text-slate-900">Dados bancários</h2>
      <p className="mt-1 text-xs text-slate-500">
        Conta bancária do posto. Hoje é só cadastro — serve de base para, futuramente, ajustar o
        boleto/documento de cobrança conforme o banco do estabelecimento.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Código do banco</label>
          <input
            type="text"
            value={dados.bancoCodigo}
            onChange={(e) => campo("bancoCodigo", e.target.value)}
            placeholder="Ex: 341"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nome do banco</label>
          <input
            type="text"
            value={dados.bancoNome}
            onChange={(e) => campo("bancoNome", e.target.value)}
            placeholder="Ex: Itaú Unibanco"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Agência</label>
          <input
            type="text"
            value={dados.agencia}
            onChange={(e) => campo("agencia", e.target.value)}
            placeholder="Ex: 1234"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Dígito da agência</label>
          <input
            type="text"
            value={dados.agenciaDigito}
            onChange={(e) => campo("agenciaDigito", e.target.value)}
            placeholder="Opcional"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Conta</label>
          <input
            type="text"
            value={dados.conta}
            onChange={(e) => campo("conta", e.target.value)}
            placeholder="Ex: 56789"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Dígito da conta</label>
          <input
            type="text"
            value={dados.contaDigito}
            onChange={(e) => campo("contaDigito", e.target.value)}
            placeholder="Ex: 0"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tipo de conta</label>
          <select
            value={dados.tipoConta}
            onChange={(e) => campo("tipoConta", e.target.value as DadosBancarios["tipoConta"])}
            className="input"
          >
            <option value="">Selecione...</option>
            <option value="corrente">Corrente</option>
            <option value="poupanca">Poupança</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Nome do titular da conta
          </label>
          <input
            type="text"
            value={dados.titularNome}
            onChange={(e) => campo("titularNome", e.target.value)}
            placeholder="Pode ser diferente da razão social"
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            CPF/CNPJ do titular
          </label>
          <input
            type="text"
            value={dados.titularDocumento}
            onChange={(e) => campo("titularDocumento", e.target.value)}
            placeholder="Opcional"
            className="input"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={salvar} disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {mensagem && (
        <p className={`mt-2 text-sm ${mensagem.tipo === "sucesso" ? "text-green-700" : "text-red-600"}`}>
          {mensagem.texto}
        </p>
      )}
      {!temAlgumDado && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Sem dados bancários cadastrados ainda.
        </p>
      )}
    </div>
  );
}
