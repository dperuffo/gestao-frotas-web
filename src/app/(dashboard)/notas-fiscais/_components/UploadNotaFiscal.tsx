"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { enviarNotaFiscalAcao, type ResultadoEnvioNotaFiscal } from "../actions";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";

// Fase 27.94 — pedido do Daniel: upload do XML da NF-e pelo posto, com o
// SISTEMA tentando descobrir sozinho a qual abastecimento ela corresponde.
//
// Fase 27.97 — correção pedida pelo Daniel: em vez de escolher 1 XML por
// vez, o posto escolhe a PASTA inteira onde estão os XMLs (ou vários
// arquivos de uma vez) e a aplicação processa todos, mostrando pra cada um
// o abastecimento que foi impactado (ou o motivo da pendência), sem
// precisar entrar em cada NF-e uma por uma pra descobrir o que aconteceu.
// "Selecionar pasta" usa o atributo não-padrão `webkitdirectory` (suportado
// por Chrome/Edge/Safari; navegadores sem suporte simplesmente abrem o
// seletor de arquivo normal) — como o TypeScript/JSX não reconhece esse
// atributo, ele é definido via ref + setAttribute (evita `any`/cast).
type ItemLote = {
  nome: string;
  arquivo: File;
  status: "aguardando" | "processando" | "concluido";
  resultado?: ResultadoEnvioNotaFiscal;
};

function corLinha(resultado?: ResultadoEnvioNotaFiscal): string {
  if (!resultado) return "bg-white";
  switch (resultado.status) {
    case "sucesso":
      return "bg-green-50";
    case "duplicada":
      return "bg-amber-50";
    case "ambiguo":
      return "bg-blue-50";
    default:
      return "bg-red-50";
  }
}

function RotuloResultado({ resultado }: { resultado: ResultadoEnvioNotaFiscal }) {
  if (resultado.status === "sucesso") {
    return (
      <div>
        <p className="text-xs font-medium text-green-800">NF-e vinculada com sucesso.</p>
        {resultado.abastecimento && (
          <p className="mt-0.5 text-xs text-green-700">
            {formatarDataBr(resultado.abastecimento.dataAbastecimento)} · {resultado.abastecimento.itemNome ?? "—"} ·{" "}
            {resultado.abastecimento.itemQuantidade ?? "—"} L ·{" "}
            {resultado.abastecimento.itemValorTotal !== null ? formatarMoeda(resultado.abastecimento.itemValorTotal) : "—"}
            {resultado.abastecimento.veiculoPlaca && ` · Placa ${resultado.abastecimento.veiculoPlaca}`}
            {resultado.abastecimento.motoristaNome && ` · ${resultado.abastecimento.motoristaNome}`}
          </p>
        )}
        {resultado.avisoArquivo && <p className="mt-0.5 text-xs text-amber-700">{resultado.avisoArquivo}</p>}
        <Link href={`/notas-fiscais/${resultado.notaId}`} className="mt-0.5 inline-block text-xs text-frota-600 hover:underline">
          Ver NF-e →
        </Link>
      </div>
    );
  }

  if (resultado.status === "duplicada") {
    return (
      <div>
        <p className="text-xs font-medium text-amber-800">Esta NF-e já tinha sido cadastrada antes — nada foi alterado.</p>
        {resultado.abastecimento && (
          <p className="mt-0.5 text-xs text-amber-700">
            Abastecimento já vinculado: {formatarDataBr(resultado.abastecimento.dataAbastecimento)} ·{" "}
            {resultado.abastecimento.itemNome ?? "—"} · {resultado.abastecimento.itemQuantidade ?? "—"} L
            {resultado.abastecimento.veiculoPlaca && ` · Placa ${resultado.abastecimento.veiculoPlaca}`}
          </p>
        )}
        {resultado.notaId && (
          <Link href={`/notas-fiscais/${resultado.notaId}`} className="mt-0.5 inline-block text-xs text-frota-600 hover:underline">
            Ver NF-e →
          </Link>
        )}
      </div>
    );
  }

  if (resultado.status === "sem_correspondencia") {
    return (
      <div>
        <p className="text-xs font-medium text-red-800">Nenhum abastecimento correspondente foi encontrado.</p>
        <p className="mt-0.5 text-xs text-red-700">
          CNPJ emitente {resultado.extraido.cnpjEmitente}, CNPJ destinatário {resultado.extraido.cnpjDestinatario},{" "}
          {resultado.extraido.quantidade} L, {formatarMoeda(resultado.extraido.valorTotal)}, emitida em{" "}
          {formatarDataBr(resultado.extraido.dataEmissao)}.
        </p>
      </div>
    );
  }

  if (resultado.status === "erro") {
    return <p className="text-xs font-medium text-red-800">{resultado.mensagem}</p>;
  }

  return null; // "ambiguo" é tratado à parte (precisa do índice da linha pra resolver)
}

export function UploadNotaFiscal() {
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [ignorados, setIgnorados] = useState(0);
  const [processando, setProcessando] = useState(false);
  const pastaInputRef = useRef<HTMLInputElement>(null);
  const arquivosInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // `webkitdirectory`/`directory` não existem no HTMLInputElement padrão
    // do TypeScript — setados via DOM direto, é o único jeito sem `any`.
    pastaInputRef.current?.setAttribute("webkitdirectory", "");
    pastaInputRef.current?.setAttribute("directory", "");
  }, []);

  function carregarArquivos(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const todos = Array.from(fileList);
    const xmls = todos
      .filter((f) => f.name.toLowerCase().endsWith(".xml"))
      .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));
    setIgnorados(todos.length - xmls.length);
    setItens(xmls.map((f) => ({ nome: f.webkitRelativePath || f.name, arquivo: f, status: "aguardando" })));
  }

  async function processarUm(index: number, arquivo: File, abastecimentoIdForcado?: number) {
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, status: "processando" } : it)));
    const formData = new FormData();
    formData.set("arquivo", arquivo);
    if (abastecimentoIdForcado) formData.set("abastecimento_id_forcado", String(abastecimentoIdForcado));
    const resultado = await enviarNotaFiscalAcao(formData);
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, status: "concluido", resultado } : it)));
  }

  async function processarTodos() {
    setProcessando(true);
    for (let i = 0; i < itens.length; i++) {
      if (itens[i].status === "concluido") continue;
      await processarUm(i, itens[i].arquivo);
    }
    setProcessando(false);
  }

  const concluidos = itens.filter((it) => it.status === "concluido");
  const resumo = {
    sucesso: concluidos.filter((it) => it.resultado?.status === "sucesso").length,
    duplicada: concluidos.filter((it) => it.resultado?.status === "duplicada").length,
    pendencia: concluidos.filter((it) => it.resultado?.status === "sem_correspondencia" || it.resultado?.status === "erro").length,
    ambiguo: concluidos.filter((it) => it.resultado?.status === "ambiguo").length,
  };

  return (
    <div className="mb-6 card p-4">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">Enviar NF-e (XML)</h3>
      <p className="mb-3 text-xs text-slate-500">
        Escolha a pasta onde estão os XMLs das NF-e (ou selecione vários arquivos de uma vez) — o sistema processa todos e mostra,
        pra cada um, se foi vinculado com sucesso e a qual abastecimento, ou qual pendência precisa ser corrigida.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-secondary cursor-pointer">
          Selecionar pasta
          <input ref={pastaInputRef} type="file" multiple className="hidden" onChange={(e) => carregarArquivos(e.target.files)} />
        </label>
        <label className="btn-secondary cursor-pointer">
          Selecionar arquivo(s)
          <input
            ref={arquivosInputRef}
            type="file"
            multiple
            accept=".xml,text/xml"
            className="hidden"
            onChange={(e) => carregarArquivos(e.target.files)}
          />
        </label>
        {itens.length > 0 && (
          <button type="button" disabled={processando} onClick={processarTodos} className="btn-primary">
            {processando ? "Processando..." : `Processar ${itens.length} arquivo${itens.length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      {ignorados > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {ignorados} arquivo{ignorados === 1 ? "" : "s"} ignorado{ignorados === 1 ? "" : "s"} (não {ignorados === 1 ? "é" : "são"} .xml).
        </p>
      )}

      {itens.length > 0 && (
        <div className="mt-4">
          {concluidos.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-3 text-xs">
              <span className="text-green-700">✓ {resumo.sucesso} vinculada{resumo.sucesso === 1 ? "" : "s"}</span>
              <span className="text-amber-700">↺ {resumo.duplicada} já cadastrada{resumo.duplicada === 1 ? "" : "s"}</span>
              <span className="text-blue-700">? {resumo.ambiguo} ambígua{resumo.ambiguo === 1 ? "" : "s"}</span>
              <span className="text-red-700">✕ {resumo.pendencia} com pendência</span>
              <span className="text-slate-400">
                {concluidos.length} de {itens.length} processado{itens.length === 1 ? "" : "s"}
              </span>
            </div>
          )}

          <div className="space-y-2">
            {itens.map((item, index) => (
              <div key={item.nome + index} className={`rounded-lg border border-slate-100 px-3 py-2 ${corLinha(item.resultado)}`}>
                <p className="mb-1 truncate text-xs font-medium text-slate-500" title={item.nome}>
                  {item.nome}
                </p>

                {item.status === "aguardando" && <p className="text-xs text-slate-400">Aguardando...</p>}
                {item.status === "processando" && <p className="text-xs text-slate-500">Validando...</p>}

                {item.status === "concluido" && item.resultado && item.resultado.status !== "ambiguo" && (
                  <RotuloResultado resultado={item.resultado} />
                )}

                {item.status === "concluido" && item.resultado?.status === "ambiguo" && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-blue-800">
                      Mais de um abastecimento corresponde a esta NF-e — escolha o certo:
                    </p>
                    <div className="space-y-1">
                      {item.resultado.candidatos.map((c) => (
                        <button
                          key={c.abastecimentoId}
                          type="button"
                          disabled={processando}
                          onClick={() => processarUm(index, item.arquivo, c.abastecimentoId)}
                          className="block w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-100"
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
