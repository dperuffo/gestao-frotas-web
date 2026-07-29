"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listarMarcasFipeAcao,
  listarModelosFipeAcao,
  listarAnosFipeAcao,
  vincularFipeAcao,
  atualizarFipeAgoraAcao,
} from "../fipeActions";
import { TIPOS_VEICULO_FIPE, type TipoVeiculoFipe, type FipeMarca, type FipeModelo, type FipeAno } from "@/lib/fipe";
import type { Database } from "@/types/database.types";

type Veiculo = Database["public"]["Tables"]["cadastro_veiculos"]["Row"];

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fase TCO 2 (29/07/2026) — vínculo do veículo a um código FIPE, alimentando
// valor_fipe/codigo_fipe (já existiam) + fipe_tipo_veiculo/fipe_ano_codigo
// (novos) e o histórico mensal (cadastro_veiculos_fipe_historico), pra dar
// ao TCO uma curva de depreciação real em vez do heurístico linear.
export function VincularFipe({ veiculo }: { veiculo: Veiculo }) {
  const jaVinculado = Boolean(veiculo.codigo_fipe && veiculo.fipe_tipo_veiculo && veiculo.fipe_ano_codigo);
  const [editando, setEditando] = useState(!jaVinculado);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const [tipo, setTipo] = useState<TipoVeiculoFipe>((veiculo.fipe_tipo_veiculo as TipoVeiculoFipe) ?? "cars");
  const [marcas, setMarcas] = useState<FipeMarca[]>([]);
  const [marcaCode, setMarcaCode] = useState("");
  const [modelos, setModelos] = useState<FipeModelo[]>([]);
  const [modeloCode, setModeloCode] = useState("");
  const [anos, setAnos] = useState<FipeAno[]>([]);
  const [anoCode, setAnoCode] = useState("");
  const [carregando, setCarregando] = useState<"marcas" | "modelos" | "anos" | null>(null);

  useEffect(() => {
    if (!editando) return;
    setMarcas([]);
    setMarcaCode("");
    setModelos([]);
    setModeloCode("");
    setAnos([]);
    setAnoCode("");
    setCarregando("marcas");
    listarMarcasFipeAcao(tipo).then((r) => {
      setCarregando(null);
      if (r?.erro) setErro(r.erro);
      else setMarcas(r?.dados ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, editando]);

  useEffect(() => {
    if (!marcaCode) return;
    setModelos([]);
    setModeloCode("");
    setAnos([]);
    setAnoCode("");
    setCarregando("modelos");
    listarModelosFipeAcao(tipo, marcaCode).then((r) => {
      setCarregando(null);
      if (r?.erro) setErro(r.erro);
      else setModelos(r?.dados ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcaCode]);

  useEffect(() => {
    if (!modeloCode) return;
    setAnos([]);
    setAnoCode("");
    setCarregando("anos");
    listarAnosFipeAcao(tipo, marcaCode, modeloCode).then((r) => {
      setCarregando(null);
      if (r?.erro) setErro(r.erro);
      else setAnos(r?.dados ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeloCode]);

  function handleVincular() {
    if (!marcaCode || !modeloCode || !anoCode) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await vincularFipeAcao(veiculo.id, tipo, marcaCode, modeloCode, anoCode);
      if (resultado?.erro) setErro(resultado.erro);
      else setEditando(false);
    });
  }

  function handleAtualizarAgora() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await atualizarFipeAgoraAcao(veiculo.id);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <section className="card p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Vínculo FIPE</h2>
      <p className="mb-4 text-xs text-slate-500">
        Opcional — vincula o veículo à tabela FIPE pra usar a curva de depreciação real (mês a mês) no TCO, em vez da
        estimativa linear. Salva pra editar depois se preferir.
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      {jaVinculado && !editando && (
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              Código FIPE: <strong className="text-slate-900">{veiculo.codigo_fipe}</strong>
            </div>
            <div>
              Valor atual:{" "}
              <strong className="text-slate-900">
                {veiculo.valor_fipe != null ? formatarMoeda(Number(veiculo.valor_fipe)) : "—"}
              </strong>
            </div>
            <div>
              Referência: <strong className="text-slate-900">{veiculo.mes_referencia ?? "—"}</strong>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleAtualizarAgora} disabled={isPending} className="btn-secondary">
              {isPending ? "Atualizando..." : "Atualizar agora"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(true)}
              disabled={isPending}
              className="text-xs font-medium text-frota-600 hover:underline"
            >
              Trocar vínculo
            </button>
          </div>
        </div>
      )}

      {editando && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoVeiculoFipe)}
                className="input"
                disabled={isPending}
              >
                {TIPOS_VEICULO_FIPE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Marca</label>
              <select
                value={marcaCode}
                onChange={(e) => setMarcaCode(e.target.value)}
                className="input"
                disabled={isPending || carregando === "marcas"}
              >
                <option value="">{carregando === "marcas" ? "Carregando..." : "Selecione..."}</option>
                {marcas.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Modelo</label>
              <select
                value={modeloCode}
                onChange={(e) => setModeloCode(e.target.value)}
                className="input"
                disabled={isPending || !marcaCode || carregando === "modelos"}
              >
                <option value="">{carregando === "modelos" ? "Carregando..." : "Selecione..."}</option>
                {modelos.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Ano/combustível</label>
              <select
                value={anoCode}
                onChange={(e) => setAnoCode(e.target.value)}
                className="input"
                disabled={isPending || !modeloCode || carregando === "anos"}
              >
                <option value="">{carregando === "anos" ? "Carregando..." : "Selecione..."}</option>
                {anos.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleVincular}
              disabled={isPending || !anoCode}
              className="btn-primary"
            >
              {isPending ? "Vinculando..." : "Vincular"}
            </button>
            {jaVinculado && (
              <button
                type="button"
                onClick={() => setEditando(false)}
                disabled={isPending}
                className="text-xs font-medium text-slate-500 hover:underline"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
