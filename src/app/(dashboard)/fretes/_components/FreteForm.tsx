"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarFrete } from "../actions";
import { CampoLocalFrete } from "./CampoLocalFrete";
import { CampoEnderecoCompleto } from "./CampoEnderecoCompleto";
import { GRUPOS_VEICULO, CARROCERIAS_FRETE } from "@/lib/fretesVeiculos";

type MotoristaOpcao = { id: string; nome: string; origem: "proprio" | "grupo" | "parceiro"; empresaNome?: string };

export function FreteForm({ empresaId, motoristas }: { empresaId: string; motoristas: MotoristaOpcao[] }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [modo, setModo] = useState<"mercado" | "direto">("mercado");
  // Fase Fretes-Público-Alvo (23/07/26) — pedido do Daniel: ao publicar no
  // mercado aberto, o cliente DECIDE se a solicitação vai pra motoristas de
  // fora da base (rede/parceiros) ou da própria base (motoristas próprios).
  const [publicoAlvo, setPublicoAlvo] = useState<"fora_base" | "base">("fora_base");
  const [motoristaId, setMotoristaId] = useState("");
  const [tipoSaldoCombustivel, setTipoSaldoCombustivel] = useState<"" | "Valor" | "Volume">("");

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
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Veículo e carroceria</h2>
        <p className="mb-4 text-xs text-slate-500">
          Opcional — se não marcar nada, o frete aparece pra qualquer motorista. Marcando, só motoristas com veículo
          compatível veem esse frete na busca deles.
        </p>
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Veículos aceitos</p>
          {GRUPOS_VEICULO.map((g) => (
            <div key={g.grupo} className="mb-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">{g.grupo}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {g.opcoes.map((v) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" name="veiculos_aceitos" value={v} className="h-4 w-4 rounded border-slate-300" />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">Carrocerias aceitas</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {CARROCERIAS_FRETE.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input type="checkbox" name="carrocerias_aceitas" value={c} className="h-4 w-4 rounded border-slate-300" />
                {c}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Adiantamento e combustível</h2>
        <p className="mb-4 text-xs text-slate-500">
          Condições financeiras do frete — pagamento em duas parcelas e, se quiser, uma reserva de combustível pro
          motorista abastecer durante o frete (consumida antes da cota normal do veículo).
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Adiantamento na aceitação (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              name="percentual_adiantamento"
              defaultValue={30}
              className="input"
            />
            <p className="mt-1 text-xs text-slate-500">
              O motorista aceita o frete → você paga esse % de entrada. O restante fica pra pagar na conclusão.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reserva de combustível</label>
            <select
              name="saldo_combustivel_tipo"
              value={tipoSaldoCombustivel}
              onChange={(e) => setTipoSaldoCombustivel(e.target.value as "" | "Valor" | "Volume")}
              className="input"
            >
              <option value="">Sem reserva de combustível</option>
              <option value="Valor">Em R$</option>
              <option value="Volume">Em litros</option>
            </select>
            {tipoSaldoCombustivel && (
              <input
                type="number"
                min="0.01"
                step="0.01"
                name="saldo_combustivel_alocado"
                required
                placeholder={tipoSaldoCombustivel === "Valor" ? "Ex.: 500 (R$)" : "Ex.: 100 (litros)"}
                className="input mt-2"
              />
            )}
          </div>
        </div>
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

        {modo === "mercado" && (
          <div className="mb-4 rounded-lg bg-slate-50 p-4">
            <p className="mb-2 text-sm font-medium text-slate-700">
              Enviar a solicitação para<span className="text-red-500"> *</span>
            </p>
            <input type="hidden" name="publico_alvo" value={publicoAlvo} />
            <label className="mb-2 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="publico_alvo_opcao"
                checked={publicoAlvo === "fora_base"}
                onChange={() => setPublicoAlvo("fora_base")}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-medium">Motoristas de fora da base</span>
                <span className="block text-xs text-slate-500">
                  Rede e parceiros — seus motoristas próprios não veem esta solicitação. Se ninguém pegar (ou você
                  recusar as propostas), dá pra recolocar depois pra sua base.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="publico_alvo_opcao"
                checked={publicoAlvo === "base"}
                onChange={() => setPublicoAlvo("base")}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-medium">Motoristas da minha base</span>
                <span className="block text-xs text-slate-500">
                  Só os motoristas próprios da sua empresa veem e podem aceitar/propor valor.
                </span>
              </span>
            </label>
          </div>
        )}

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
              {motoristas.filter((m) => m.origem === "grupo").length > 0 && (
                <optgroup label="Motoristas do grupo econômico">
                  {motoristas
                    .filter((m) => m.origem === "grupo")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} — {m.empresaNome}
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
