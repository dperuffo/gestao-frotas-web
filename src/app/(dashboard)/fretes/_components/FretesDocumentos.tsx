"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { enviarCteAcao, registrarCiotAcao } from "../documentosActions";
import { AcoesCteEmitido, CteEmissaoForm, type ParceiroSalvo } from "./CteEmissaoForm";

// Fase Fretes-CIOT-CTe (18/07) — pedido do Daniel: registrar CIOT e CT-e
// por frete. Este app nunca EMITE nenhum dos dois (ver comentário em
// src/lib/cte.ts) — só guarda o que já foi emitido em outro lugar. CT-e
// entra por upload de XML (validado estruturalmente); CIOT é cadastro
// manual (número de 12 dígitos gerado pela integradora credenciada na
// ANTT) com anexo opcional do comprovante.

export type CteRow = {
  id: string;
  numero_cte: string | null;
  serie: string | null;
  protocolo_autorizacao: string | null;
  valor_prestacao: number | null;
  data_emissao: string | null;
  xmlUrl: string | null;
  // Fase P0.2 — distingue o caminho de upload (origem/status sempre
  // 'upload'/'autorizado') do caminho de emissão pela plataforma.
  origem: string;
  status: string;
  motivoRejeicao: string | null;
};

export type CiotRow = {
  id: string;
  numero_ciot: string;
  rntrc: string | null;
  placa_veiculo: string | null;
  valor_frete: number | null;
  data_emissao: string | null;
  observacao: string | null;
  anexoUrl: string | null;
};

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_CTE_BADGE: Record<string, { texto: string; classe: string }> = {
  autorizado: { texto: "Autorizado", classe: "bg-emerald-50 text-emerald-700" },
  enviando: { texto: "Enviando...", classe: "bg-amber-50 text-amber-700" },
  rascunho: { texto: "Rascunho (falhou o envio)", classe: "bg-amber-50 text-amber-700" },
  rejeitado: { texto: "Rejeitado pela SEFAZ", classe: "bg-red-50 text-red-700" },
  cancelado: { texto: "Cancelado", classe: "bg-slate-100 text-slate-500" },
};

export function FretesDocumentos({
  freteId,
  empresaId,
  ctes,
  ciots,
  fiscalConfigurado,
  municipioInicioPadrao,
  ufInicioPadrao,
  municipioFimPadrao,
  ufFimPadrao,
  parceiros,
  chavesNfePadrao,
}: {
  freteId: string;
  empresaId: string;
  ctes: CteRow[];
  ciots: CiotRow[];
  fiscalConfigurado: boolean;
  municipioInicioPadrao: string;
  ufInicioPadrao: string;
  municipioFimPadrao: string;
  ufFimPadrao: string;
  parceiros: ParceiroSalvo[];
  chavesNfePadrao: string;
}) {
  return (
    <div className="card mb-6 p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">📄 Documentos do frete (CT-e / CIOT)</h2>
      <p className="mb-4 text-xs text-slate-500">
        Emitidos fora da plataforma (SEFAZ / integradora credenciada na ANTT) — aqui é só o registro e a
        conferência de status.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">CT-e</h3>
          <div className="mb-3 space-y-2">
            {ctes.map((c) => {
              const badge = STATUS_CTE_BADGE[c.status] ?? { texto: c.status, classe: "bg-slate-100 text-slate-500" };
              return (
                <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">Nº {c.numero_cte ?? "—"} / série {c.serie ?? "—"}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.classe}`}>{badge.texto}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {c.valor_prestacao != null ? formatoMoeda.format(c.valor_prestacao) : "—"} · protocolo{" "}
                    {c.protocolo_autorizacao ?? "—"}
                    {c.data_emissao ? ` · ${new Date(c.data_emissao).toLocaleDateString("pt-BR")}` : ""}
                    {c.origem === "emitido" ? " · emitido pelo FNI" : " · upload"}
                  </p>
                  {c.motivoRejeicao && <p className="mt-1 text-xs text-red-600">{c.motivoRejeicao}</p>}
                  {c.xmlUrl && (
                    <a href={c.xmlUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-frota-600 hover:underline">
                      Ver XML
                    </a>
                  )}
                  {c.origem === "emitido" && c.status === "autorizado" && <AcoesCteEmitido cteId={c.id} empresaId={empresaId} />}
                </div>
              );
            })}
            {ctes.length === 0 && <p className="text-xs text-slate-400">Nenhum CT-e registrado ainda.</p>}
          </div>
          <div className="space-y-2">
            <FormCte freteId={freteId} empresaId={empresaId} />
            <CteEmissaoForm
              freteId={freteId}
              empresaId={empresaId}
              fiscalConfigurado={fiscalConfigurado}
              municipioInicioPadrao={municipioInicioPadrao}
              ufInicioPadrao={ufInicioPadrao}
              municipioFimPadrao={municipioFimPadrao}
              ufFimPadrao={ufFimPadrao}
              parceiros={parceiros}
              chavesNfePadrao={chavesNfePadrao}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">CIOT</h3>
          <div className="mb-3 space-y-2">
            {ciots.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900 font-mono">{c.numero_ciot}</span>
                  {c.anexoUrl && (
                    <a href={c.anexoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-frota-600 hover:underline">
                      Ver anexo
                    </a>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {c.placa_veiculo ?? "—"} · RNTRC {c.rntrc ?? "—"} ·{" "}
                  {c.valor_frete != null ? formatoMoeda.format(c.valor_frete) : "—"}
                  {c.data_emissao ? ` · ${new Date(c.data_emissao).toLocaleDateString("pt-BR")}` : ""}
                </p>
                {c.observacao && <p className="mt-1 text-xs text-slate-500">{c.observacao}</p>}
              </div>
            ))}
            {ciots.length === 0 && <p className="text-xs text-slate-400">Nenhum CIOT registrado ainda.</p>}
          </div>
          <FormCiot freteId={freteId} empresaId={empresaId} />
        </div>
      </div>
    </div>
  );
}

function FormCte({ freteId, empresaId }: { freteId: string; empresaId: string }) {
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | undefined>();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await enviarCteAcao(freteId, empresaId, formData);
      if (resultado.erro) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
      } else if (resultado.sucesso) {
        setMensagem({ tipo: "sucesso", texto: `CT-e nº ${resultado.sucesso.numeroCte} registrado.` });
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
      <input type="file" name="arquivo" accept=".xml" required className="input text-xs" />
      <button type="submit" disabled={isPending} className="btn-secondary w-full text-xs">
        {isPending ? "Validando..." : "Enviar XML do CT-e"}
      </button>
      {mensagem && (
        <p className={`text-xs font-medium ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>
          {mensagem.texto}
        </p>
      )}
    </form>
  );
}

function FormCiot({ freteId, empresaId }: { freteId: string; empresaId: string }) {
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | undefined>();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await registrarCiotAcao(freteId, empresaId, formData);
      if (resultado.erro) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
      } else if (resultado.sucesso) {
        setMensagem({ tipo: "sucesso", texto: `CIOT ${resultado.sucesso.numeroCiot} registrado.` });
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        name="numero_ciot"
        placeholder="Número do CIOT (12 dígitos)"
        required
        maxLength={14}
        className="input text-xs font-mono"
      />
      <div className="grid grid-cols-2 gap-2">
        <input type="text" name="rntrc" placeholder="RNTRC" className="input text-xs" />
        <input type="text" name="placa_veiculo" placeholder="Placa" className="input text-xs uppercase" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" step="0.01" name="valor_frete" placeholder="Valor do frete" className="input text-xs" />
        <input type="date" name="data_emissao" className="input text-xs" />
      </div>
      <input type="text" name="observacao" placeholder="Observação (opcional)" className="input text-xs" />
      <input type="file" name="anexo" accept=".pdf,.jpg,.jpeg,.png" className="input text-xs" />
      <button type="submit" disabled={isPending} className="btn-secondary w-full text-xs">
        {isPending ? "Registrando..." : "Registrar CIOT"}
      </button>
      {mensagem && (
        <p className={`text-xs font-medium ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>
          {mensagem.texto}
        </p>
      )}
    </form>
  );
}
