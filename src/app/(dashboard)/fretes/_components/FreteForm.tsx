"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarFrete } from "../actions";
import { CampoLocalFrete } from "./CampoLocalFrete";
import { CampoEnderecoCompleto } from "./CampoEnderecoCompleto";

type MotoristaOpcao = { id: string; nome: string; origem: "proprio" | "parceiro" };

export function FreteForm({ empresaId, motoristas }: { empresaId: string; motoristas: MotoristaOpcao[] }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [modo, setModo] = useState<"mercado" | "direto">("mercado");
  const [motoristaId, setMotoristaId] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    if (modo === "mercado") formData.delete("motorista_id");
    startTransition(async () => {
      const resultado = await criarFrete(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Dados do frete</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Título<span className="text-red-500"> *</span>
            </label>
            <input type="text" name="titulo" required placeholder='Ex.: "Carga seca Porto Alegre → São Paulo"' className="input" />
          </div>

          <div className="sm:col-span-2">
            <p className="mb-1 text-xs text-slate-500">
              Origem e destino abaixo são só a cidade, pra calcular km e mostrar no mapa — os endereços completos de
              coleta e entrega (rua, número, horário) você preenche mais abaixo.
            </p>
          </div>
          <CampoLocalFrete label="Origem (cidade)" prefixo="origem" />
          <CampoLocalFrete label="Destino (cidade)" prefixo="destino" />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de carga</label>
            <input type="text" name="tipo_carga" placeholder="Ex.: carga seca, granel, refrigerado..." className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Peso da carga (kg)</label>
            <input type="number" min="1" step="0.1" name="peso_carga_kg" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Comprimento (m)</label>
            <input type="number" min="0.1" step="0.01" name="carga_comprimento_m" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Largura (m)</label>
            <input type="number" min="0.1" step="0.01" name="carga_largura_m" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Altura (m)</label>
            <input type="number" min="0.1" step="0.01" name="carga_altura_m" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Km estimado (opcional)</label>
            <input type="number" min="1" step="0.1" name="km_estimado" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Valor do frete (R$){modo === "mercado" ? " — valor de partida" : ""}
              <span className="text-red-500"> *</span>
            </label>
            <input type="number" min="0.01" step="0.01" name="valor_oferecido" required className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
            <textarea name="descricao" rows={3} className="input" />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Endereços completos</h2>
          <p className="text-xs text-slate-500">
            Essas informações aparecem pro motorista antes de aceitar o frete — quanto mais completas, mais fácil
            pra ele avaliar se topa (inclusive a distância até o ponto de coleta).
          </p>
        </div>
        <CampoEnderecoCompleto titulo="📍 Coleta" prefixo="coleta" />
        <CampoEnderecoCompleto titulo="📍 Entrega" prefixo="entrega" />
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Quem vai dirigir?</h2>
        <p className="mb-4 text-xs text-slate-500">
          Se você já sabe quem vai fazer o frete (motorista próprio ou parceiro), atribua direto — ele só confirma ou
          recusa, sem negociação. Se deixar em aberto, qualquer motorista da rede pode ver e propor um valor.
        </p>

        <div className="mb-4 flex gap-3">
          <button
            type="button"
            onClick={() => setModo("mercado")}
            className={modo === "mercado" ? "btn-primary text-sm" : "btn-secondary text-sm"}
          >
            Mercado aberto (rede toda)
          </button>
          <button
            type="button"
            onClick={() => setModo("direto")}
            className={modo === "direto" ? "btn-primary text-sm" : "btn-secondary text-sm"}
          >
            Atribuir a um motorista
          </button>
        </div>

        {modo === "direto" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Motorista</label>
            <select
              name="motorista_id"
              value={motoristaId}
              onChange={(e) => setMotoristaId(e.target.value)}
              required={modo === "direto"}
              className="input"
            >
              <option value="">Selecione...</option>
              {motoristas.filter((m) => m.origem === "proprio").length > 0 && (
                <optgroup label="Motoristas próprios">
                  {motoristas
                    .filter((m) => m.origem === "proprio")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                </optgroup>
              )}
              {motoristas.filter((m) => m.origem === "parceiro").length > 0 && (
                <optgroup label="Parceiros (agregados/terceiros)">
                  {motoristas
                    .filter((m) => m.origem === "parceiro")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
            {motoristas.length === 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Nenhum motorista próprio ou parceiro ativo ainda. Cadastre motoristas ou convide parceiros em{" "}
                <span className="font-medium">Motoristas Parceiros</span>.
              </p>
            )}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Publicando..." : "Publicar frete"}
        </button>
      </div>
    </form>
  );
}
