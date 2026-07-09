"use client";

import { useRef, useState, useTransition } from "react";
import { enviarNotaFiscalAcao, type ResultadoEnvioNotaFiscal } from "../actions";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";

// Fase 27.94 — pedido do Daniel: upload do XML da NF-e pelo posto, com o
// SISTEMA tentando descobrir sozinho a qual abastecimento ela corresponde
// (decisão tomada via AskUserQuestion — não é o posto quem escolhe antes).
// Por isso o upload é um único formulário genérico (não por linha da
// tabela) — o resultado é que muda: sucesso, duplicada, sem correspondência
// (mostra os dados extraídos do XML pra conferência manual), ou ambíguo
// (lista os candidatos pro posto escolher, reenviando o MESMO arquivo com
// o abastecimento certo marcado).
export function UploadNotaFiscal() {
  const [resultado, setResultado] = useState<ResultadoEnvioNotaFiscal | null>(null);
  const [arquivoAtual, setArquivoAtual] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function enviar(arquivo: File, abastecimentoIdForcado?: number) {
    const formData = new FormData();
    formData.set("arquivo", arquivo);
    if (abastecimentoIdForcado) formData.set("abastecimento_id_forcado", String(abastecimentoIdForcado));
    startTransition(async () => {
      const r = await enviarNotaFiscalAcao(formData);
      setResultado(r);
      if (r.status === "sucesso") {
        setArquivoAtual(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const arquivo = inputRef.current?.files?.[0];
    if (!arquivo) return;
    setArquivoAtual(arquivo);
    enviar(arquivo);
  }

  return (
    <div className="mb-6 card p-4">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">Enviar NF-e (XML)</h3>
      <p className="mb-3 text-xs text-slate-500">
        Envie o XML completo da NF-e (com o protocolo de autorização da SEFAZ) — o sistema procura sozinho o
        abastecimento correspondente.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" name="arquivo" accept=".xml,text/xml" required className="input" />
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Validando..." : "Enviar"}
        </button>
      </form>

      {resultado && (
        <div className="mt-4">
          {resultado.status === "sucesso" && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
              NF-e validada e vinculada com sucesso.
              {resultado.avisoArquivo && <p className="mt-1 text-xs text-amber-700">{resultado.avisoArquivo}</p>}
            </div>
          )}

          {resultado.status === "duplicada" && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Esta NF-e já foi cadastrada anteriormente — nada foi alterado.
            </div>
          )}

          {resultado.status === "sem_correspondencia" && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-medium">Nenhum abastecimento correspondente foi encontrado.</p>
              <p className="mt-1 text-xs text-red-700">
                Confira: CNPJ emitente {resultado.extraido.cnpjEmitente}, CNPJ destinatário{" "}
                {resultado.extraido.cnpjDestinatario}, {resultado.extraido.quantidade} L,{" "}
                {formatarMoeda(resultado.extraido.valorTotal)}, emitida em{" "}
                {formatarDataBr(resultado.extraido.dataEmissao)}.
              </p>
            </div>
          )}

          {resultado.status === "ambiguo" && (
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <p className="mb-2 font-medium">Mais de um abastecimento corresponde a esta NF-e — escolha o certo:</p>
              <div className="space-y-1.5">
                {resultado.candidatos.map((c) => (
                  <button
                    key={c.abastecimentoId}
                    type="button"
                    disabled={isPending}
                    onClick={() => arquivoAtual && enviar(arquivoAtual, c.abastecimentoId)}
                    className="block w-full rounded border border-blue-200 bg-white px-3 py-2 text-left text-xs text-slate-700 hover:bg-blue-100"
                  >
                    {formatarDataBr(c.dataAbastecimento)} · {c.itemNome ?? "—"} · {c.itemQuantidade} L ·{" "}
                    {formatarMoeda(c.itemValorTotal)}
                    {c.veiculoPlaca && ` · Placa ${c.veiculoPlaca}`}
                    {c.motoristaNome && ` · ${c.motoristaNome}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {resultado.status === "erro" && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{resultado.mensagem}</div>
          )}
        </div>
      )}
    </div>
  );
}
