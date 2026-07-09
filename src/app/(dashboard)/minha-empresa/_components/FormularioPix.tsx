"use client";

import { useState, useTransition } from "react";
import { atualizarPixChaveAcao } from "../actions";

// Fase 27.92 — self-service: o posto cadastra a própria chave PIX (CPF,
// CNPJ, e-mail, telefone ou chave aleatória — todos são só texto pro padrão
// PIX, sem validação de formato aqui).
export function FormularioPix({ empresaId, pixChaveAtual }: { empresaId: string; pixChaveAtual: string | null }) {
  const [valor, setValor] = useState(pixChaveAtual ?? "");
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function salvar() {
    setMensagem(null);
    startTransition(async () => {
      try {
        await atualizarPixChaveAcao(empresaId, valor);
        setMensagem({ tipo: "sucesso", texto: "Chave PIX salva." });
      } catch (e) {
        setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao salvar." });
      }
    });
  }

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-slate-900">Chave PIX para recebimento</h2>
      <p className="mt-1 text-xs text-slate-500">
        Usada no QR Code de pagamento do boleto/documento de cobrança enviado aos clientes ao fechar
        cada ciclo de abastecimento. Pode ser CPF, CNPJ, e-mail, telefone ou chave aleatória.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Sua chave PIX"
          className="input max-w-sm"
        />
        <button type="button" onClick={salvar} disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
      {mensagem && (
        <p className={`mt-2 text-sm ${mensagem.tipo === "sucesso" ? "text-green-700" : "text-red-600"}`}>
          {mensagem.texto}
        </p>
      )}
      {!pixChaveAtual && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Sem chave PIX cadastrada, o boleto sai sem QR Code de pagamento — só com os dados pra
          transferência manual.
        </p>
      )}
    </div>
  );
}
