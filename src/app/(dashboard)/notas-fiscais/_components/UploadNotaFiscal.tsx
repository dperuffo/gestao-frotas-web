"use client";

import { useRef, useState } from "react";
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
// o abastecimento que foi impactado (ou o motivo da pendência).
//
// Fase 27.98 — correção: a 1ª versão tentava abrir um seletor de PASTA via
// `webkitdirectory` num `<input type="file">`. Daniel testou e o diálogo
// nativo abriu como um seletor de ARQUIVO comum (deixa entrar na pasta, mas
// não deixa "escolher a pasta inteira" — só arquivo por arquivo), sinal de
// que esse atributo não é respeitado no navegador/ambiente dele. Trocado
// pelo mecanismo mais confiável entre navegadores: ARRASTAR a pasta (ou os
// arquivos) do Finder/Explorer direto pra tela — usa a File System Entry
// API (`DataTransferItem.webkitGetAsEntry`), que lê o conteúdo da pasta
// recursivamente sem depender do seletor nativo do sistema operacional.
// Selecionar arquivos manualmente (clique, com Ctrl/Cmd+A pra pegar todos
// de uma vez dentro da pasta) continua disponível como alternativa.
type ItemLote = {
  nome: string;
  arquivo: File;
  status: "aguardando" | "processando" | "concluido";
  resultado?: ResultadoEnvioNotaFiscal;
};

// Lê recursivamente uma pasta arrastada (FileSystemDirectoryEntry) — os
// itens de um `DataTransfer` só são válidos SINCRONAMENTE dentro do evento
// de drop, por isso `webkitGetAsEntry()` é chamado ANTES de qualquer
// `await` (em `handleDrop`) — só a leitura dos arquivos em si (que já
// devolve objetos `FileSystemEntry` estáveis) é assíncrona.
async function lerEntradas(entradas: FileSystemEntry[]): Promise<File[]> {
  const resultado: File[] = [];

  async function lerEntry(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const arquivo = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      resultado.push(arquivo);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const filhos = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      for (const filho of filhos) {
        await lerEntry(filho);
      }
    }
  }

  for (const entrada of entradas) {
    await lerEntry(entrada);
  }
  return resultado;
}

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
  const [arrastandoSobre, setArrastandoSobre] = useState(false);
  const arquivosInputRef = useRef<HTMLInputElement>(null);

  function carregarArquivosLista(arquivosBrutos: File[]) {
    if (arquivosBrutos.length === 0) return;
    const xmls = arquivosBrutos
      .filter((f) => f.name.toLowerCase().endsWith(".xml"))
      .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));
    setIgnorados(arquivosBrutos.length - xmls.length);
    setItens(xmls.map((f) => ({ nome: f.webkitRelativePath || f.name, arquivo: f, status: "aguardando" })));
  }

  function handleInputChange(fileList: FileList | null) {
    if (!fileList) return;
    carregarArquivosLista(Array.from(fileList));
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastandoSobre(false);
    const dataTransfer = e.dataTransfer;
    // `webkitGetAsEntry()` precisa ser chamado JÁ (síncrono, dentro do
    // handler) — depois de um `await` os itens do DataTransfer deixam de
    // ser válidos no navegador.
    const entradas: FileSystemEntry[] = [];
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const entry = dataTransfer.items[i]?.webkitGetAsEntry?.();
      if (entry) entradas.push(entry);
    }
    const arquivos = entradas.length > 0 ? await lerEntradas(entradas) : Array.from(dataTransfer.files);
    carregarArquivosLista(arquivos);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastandoSobre(true);
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
        Arraste a pasta com os XMLs das NF-e (ou os arquivos individuais) pra área abaixo — o sistema processa todos e mostra,
        pra cada um, se foi vinculado com sucesso e a qual abastecimento, ou qual pendência precisa ser corrigida.
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setArrastandoSobre(false)}
        onClick={() => arquivosInputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          arrastandoSobre ? "border-frota-500 bg-frota-50" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <p className="text-sm font-medium text-slate-600">Arraste aqui a pasta (ou os arquivos) com os XMLs</p>
        <p className="mt-1 text-xs text-slate-400">
          ou clique pra selecionar manualmente — dentro da pasta, use Ctrl+A (ou Cmd+A no Mac) pra marcar todos de uma vez
        </p>
        <input
          ref={arquivosInputRef}
          type="file"
          multiple
          accept=".xml,text/xml"
          className="hidden"
          onChange={(e) => handleInputChange(e.target.files)}
        />
      </div>

      {itens.length > 0 && (
        <div className="mt-3">
          <button type="button" disabled={processando} onClick={processarTodos} className="btn-primary">
            {processando ? "Processando..." : `Processar ${itens.length} arquivo${itens.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

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
