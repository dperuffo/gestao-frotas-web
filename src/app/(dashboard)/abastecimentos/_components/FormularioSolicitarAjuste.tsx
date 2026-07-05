"use client";

import { useState, useTransition, type FormEvent } from "react";
import { solicitarAjusteAcao, contrapropostaAjusteAcao } from "../actions";
import { PRODUTOS_POSTO } from "@/lib/constants";
import type { AutorAjuste } from "@/lib/ajustesAbastecimentos";

type ValoresAjuste = {
  data_abastecimento: string | null;
  hodometro: number | null;
  item_nome: string | null;
  item_quantidade: number | null;
  item_valor_unitario: number | null;
  item_valor_total: number | null;
};

// Converte um timestamptz (ISO, UTC) pro formato que o input datetime-local
// espera (YYYY-MM-DDTHH:mm), já no fuso local do navegador.
function paraDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function numeroParaCampo(valor: number | null): string {
  return valor != null ? String(valor) : "";
}

// Compara o valor atual do campo (número) com o texto do input — usado só
// pra saber se o usuário realmente MUDOU o campo (ver handleSubmit).
function numeroMudou(atual: number | null, textoForm: string, casasTolerancia: number): boolean {
  if (atual == null) return textoForm !== "";
  if (textoForm === "") return true;
  const numeroForm = Number(textoForm.replace(",", "."));
  if (!Number.isFinite(numeroForm)) return true;
  return Math.abs(atual - numeroForm) >= 1 / 10 ** (casasTolerancia + 1);
}

// Fase 27.65 — formulário de solicitação de ajuste (ou contraproposta,
// quando `ajusteId` é passado).
//
// Fase 27.67 — Daniel pediu pra inverter a lógica original: em vez de vir
// tudo em branco (com o valor atual só como legenda ao lado), os campos
// agora vêm PREENCHIDOS com o valor atual — o usuário edita só o que
// precisa corrigir, em vez de redigitar tudo do zero. Litros e preço por
// litro recalculam o valor total automaticamente (o usuário ainda pode
// sobrescrever o total na mão, se quiser um valor diferente do produto
// exato — útil pra taxas/arredondamentos). Como o formulário só ENVIA pro
// servidor os campos que de fato mudaram em relação ao valor atual (ver
// handleSubmit — compara e limpa quem ficou igual), o resto da lógica
// (validarCamposAjuste, a rodada só grava o que foi alterado) continua
// funcionando sem mudança nenhuma.
export function FormularioSolicitarAjuste({
  abastecimentoId,
  empresaClienteId,
  empresaPostoId,
  autor,
  valoresAtuais,
  ajusteIdParaContraproposta,
}: {
  abastecimentoId: number;
  empresaClienteId: string;
  empresaPostoId: string;
  autor: AutorAjuste;
  valoresAtuais: ValoresAjuste;
  ajusteIdParaContraproposta?: string;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [aberto, setAberto] = useState(!!ajusteIdParaContraproposta);
  const [isPending, startTransition] = useTransition();

  const [dataHora, setDataHora] = useState(() => paraDatetimeLocal(valoresAtuais.data_abastecimento));
  const [hodometro, setHodometro] = useState(() => numeroParaCampo(valoresAtuais.hodometro));
  const [combustivel, setCombustivel] = useState(valoresAtuais.item_nome ?? "");
  const [litros, setLitros] = useState(() => numeroParaCampo(valoresAtuais.item_quantidade));
  const [precoUnitario, setPrecoUnitario] = useState(() => numeroParaCampo(valoresAtuais.item_valor_unitario));
  const [valorTotal, setValorTotal] = useState(() => numeroParaCampo(valoresAtuais.item_valor_total));

  // Recalcula o valor total sempre que litros ou preço por litro mudam —
  // só quando os dois têm número válido preenchido.
  function recalcularTotal(novosLitros: string, novoPreco: string) {
    const l = Number(novosLitros.replace(",", "."));
    const p = Number(novoPreco.replace(",", "."));
    if (novosLitros !== "" && novoPreco !== "" && Number.isFinite(l) && Number.isFinite(p)) {
      setValorTotal((l * p).toFixed(2));
    }
  }

  function handleLitrosChange(valor: string) {
    setLitros(valor);
    recalcularTotal(valor, precoUnitario);
  }

  function handlePrecoChange(valor: string) {
    setPrecoUnitario(valor);
    recalcularTotal(litros, valor);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);

    // Só propõe de fato o que MUDOU em relação ao valor atual — os campos
    // vêm preenchidos só pra facilitar a edição, não pra "reafirmar" tudo
    // que já estava certo (ver comentário da Fase 27.67 acima).
    if (paraDatetimeLocal(valoresAtuais.data_abastecimento) === dataHora) formData.set("data_abastecimento", "");
    if (!numeroMudou(valoresAtuais.hodometro, hodometro, 0)) formData.set("hodometro", "");
    if ((valoresAtuais.item_nome ?? "") === combustivel) formData.set("item_nome", "");
    if (!numeroMudou(valoresAtuais.item_quantidade, litros, 3)) formData.set("item_quantidade", "");
    if (!numeroMudou(valoresAtuais.item_valor_unitario, precoUnitario, 4)) formData.set("item_valor_unitario", "");
    if (!numeroMudou(valoresAtuais.item_valor_total, valorTotal, 2)) formData.set("item_valor_total", "");

    startTransition(async () => {
      const resultado = ajusteIdParaContraproposta
        ? await contrapropostaAjusteAcao(ajusteIdParaContraproposta, abastecimentoId, autor, undefined, formData)
        : await solicitarAjusteAcao(abastecimentoId, empresaClienteId, empresaPostoId, autor, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else if (!ajusteIdParaContraproposta) setAberto(false);
    });
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="btn-secondary">
        Solicitar ajuste
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <h2 className="text-sm font-semibold text-slate-900">
        {ajusteIdParaContraproposta ? "Enviar contraproposta" : "Solicitar ajuste"}
      </h2>
      <p className="text-xs text-slate-500">
        Os campos já vêm com os valores atuais — edite só o que precisa corrigir. A outra parte
        (cliente ou posto) vai receber uma notificação para aprovar ou recusar.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo label="Data e hora">
          <input
            type="datetime-local"
            name="data_abastecimento"
            value={dataHora}
            onChange={(e) => setDataHora(e.target.value)}
            className="input"
          />
        </Campo>
        <Campo label="Hodômetro (km)">
          <input
            type="number"
            name="hodometro"
            value={hodometro}
            onChange={(e) => setHodometro(e.target.value)}
            className="input"
          />
        </Campo>
        <Campo label="Combustível">
          <select name="item_nome" value={combustivel} onChange={(e) => setCombustivel(e.target.value)} className="input">
            <option value="">Sem alteração</option>
            {PRODUTOS_POSTO.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Litros">
          <input
            type="number"
            step="0.001"
            name="item_quantidade"
            value={litros}
            onChange={(e) => handleLitrosChange(e.target.value)}
            className="input"
          />
        </Campo>
        <Campo label="Preço por litro (R$)">
          <input
            type="number"
            step="0.01"
            name="item_valor_unitario"
            value={precoUnitario}
            onChange={(e) => handlePrecoChange(e.target.value)}
            className="input"
          />
        </Campo>
        <Campo label="Valor total (R$)">
          <input
            type="number"
            step="0.01"
            name="item_valor_total"
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
            className="input"
          />
        </Campo>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Motivo (opcional)</label>
        <textarea name="motivo" rows={2} className="input" placeholder="Ex: litros digitados errado, deveria ser 45L" />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex justify-end gap-2">
        {!ajusteIdParaContraproposta && (
          <button type="button" onClick={() => setAberto(false)} className="btn-secondary">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Enviando..." : ajusteIdParaContraproposta ? "Enviar contraproposta" : "Enviar solicitação"}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
