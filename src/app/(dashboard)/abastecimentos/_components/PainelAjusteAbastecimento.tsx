"use client";

import { useState, useTransition } from "react";
import { decidirAjusteAcao, cancelarAjusteAcao } from "../actions";
import {
  STATUS_AJUSTE_LABEL,
  LABEL_CAMPO_AJUSTE,
  type AutorAjuste,
  type CamposAjuste,
  type StatusAjuste,
  type IdentificadorAbastecimento,
} from "@/lib/ajustesAbastecimentos";
import { FormularioSolicitarAjuste } from "./FormularioSolicitarAjuste";
import { formatarDataHoraBr } from "@/lib/utils";

type ValoresAjuste = {
  data_abastecimento: string | null;
  hodometro: number | null;
  item_nome: string | null;
  item_quantidade: number | null;
  item_valor_unitario: number | null;
  item_valor_total: number | null;
};

type Rodada = {
  numero_rodada: number;
  autor: string;
  data_abastecimento: string | null;
  hodometro: number | null;
  item_nome: string | null;
  item_quantidade: number | null;
  item_valor_unitario: number | null;
  item_valor_total: number | null;
  motivo: string | null;
  decisao: string;
  criado_em: string;
};

const CAMPOS_ORDEM: (keyof CamposAjuste)[] = [
  "data_abastecimento",
  "hodometro",
  "item_nome",
  "item_quantidade",
  "item_valor_unitario",
  "item_valor_total",
];

function formatarValorCampo(campo: keyof CamposAjuste, valor: string | number | null): string {
  if (valor == null) return "";
  if (campo === "data_abastecimento") return formatarDataHoraBr(String(valor));
  if (campo === "item_valor_unitario" || campo === "item_valor_total") {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (campo === "item_quantidade") return `${Number(valor).toLocaleString("pt-BR")} L`;
  if (campo === "hodometro") return `${Number(valor).toLocaleString("pt-BR")} km`;
  return String(valor);
}

// Fase 27.65 — painel de ajuste dentro de /abastecimentos/[id]: mostra a
// solicitação em aberto (se houver, com o histórico de rodadas) ou o botão
// pra abrir uma nova. Só é renderizado quando o abastecimento TEM
// contraparte identificada (ver resolverContraparteAjuste na page.tsx) —
// sem isso, a tela continua usando a edição direta de sempre.
export function PainelAjusteAbastecimento({
  identificador,
  empresaClienteId,
  empresaPostoId,
  meuLado,
  ajusteAberto,
  rodadas,
  valoresAtuais,
}: {
  identificador: IdentificadorAbastecimento;
  empresaClienteId: string;
  empresaPostoId: string;
  meuLado: AutorAjuste;
  ajusteAberto: { id: string; status: string } | null;
  rodadas: Rodada[];
  valoresAtuais: ValoresAjuste;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [contrapropondo, setContrapropondo] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!ajusteAberto) {
    return (
      <div className="card p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Ajuste de registro</h2>
        <p className="mb-4 text-xs text-slate-500">
          Encontrou um erro neste abastecimento? Solicite um ajuste — a outra parte (cliente ou posto)
          recebe uma notificação para aprovar ou recusar antes de qualquer mudança valer.
        </p>
        <FormularioSolicitarAjuste
          identificador={identificador}
          empresaClienteId={empresaClienteId}
          empresaPostoId={empresaPostoId}
          autor={meuLado}
          valoresAtuais={valoresAtuais}
        />
      </div>
    );
  }

  const minhaVezDeResponder =
    (meuLado === "cliente" && ajusteAberto.status === "pendente_cliente") ||
    (meuLado === "posto" && ajusteAberto.status === "pendente_posto");

  function handleDecisao(decisao: "aceita" | "recusada") {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await decidirAjusteAcao(ajusteAberto!.id, identificador, decisao);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  function handleCancelar() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await cancelarAjusteAcao(ajusteAberto!.id, identificador);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Ajuste de registro</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {STATUS_AJUSTE_LABEL[ajusteAberto.status as StatusAjuste] ?? ajusteAberto.status}
        </span>
      </div>

      <div className="mb-4 space-y-3">
        {rodadas.map((r) => (
          <div key={r.numero_rodada} className="rounded-lg border border-slate-100 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>
                Rodada #{r.numero_rodada} — proposta {r.autor === "cliente" ? "do cliente" : "do posto"}
              </span>
              <span>{formatarDataHoraBr(r.criado_em)}</span>
            </div>
            <ul className="space-y-1 text-slate-700">
              {CAMPOS_ORDEM.map((campo) => {
                const valor = r[campo];
                if (valor == null) return null;
                return (
                  <li key={campo}>
                    <span className="text-slate-400">{LABEL_CAMPO_AJUSTE[campo]}:</span>{" "}
                    {formatarValorCampo(campo, valor)}
                  </li>
                );
              })}
            </ul>
            {r.motivo && <p className="mt-1 text-xs italic text-slate-500">&ldquo;{r.motivo}&rdquo;</p>}
          </div>
        ))}
      </div>

      {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}

      {minhaVezDeResponder ? (
        contrapropondo ? (
          <FormularioSolicitarAjuste
            identificador={identificador}
            empresaClienteId={empresaClienteId}
            empresaPostoId={empresaPostoId}
            autor={meuLado}
            valoresAtuais={valoresAtuais}
            ajusteIdParaContraproposta={ajusteAberto.id}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={isPending} onClick={() => handleDecisao("aceita")} className="btn-primary">
              Aprovar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleDecisao("recusada")}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Recusar
            </button>
            <button type="button" onClick={() => setContrapropondo(true)} className="btn-secondary">
              Enviar contraproposta
            </button>
          </div>
        )
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Aguardando resposta {meuLado === "cliente" ? "do posto" : "do cliente"}.
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <button type="button" disabled={isPending} onClick={handleCancelar} className="text-xs text-slate-500 hover:underline">
          Cancelar solicitação
        </button>
      </div>
    </div>
  );
}
