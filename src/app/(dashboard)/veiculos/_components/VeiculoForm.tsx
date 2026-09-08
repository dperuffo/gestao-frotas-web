"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Check } from "lucide-react";
import { criarVeiculo, atualizarVeiculo } from "../actions";
import { CLASSIFICACAO, TIPOS_VEICULO, TIPO_PORTE_VEICULO, CICLOS_COMBUSTIVEL } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type Veiculo = Database["public"]["Tables"]["cadastro_veiculos"]["Row"];
type EmpresaOpcao = { id: string; nome: string };
type CentroCustoOpcao = { id: string; nome: string };

// Fase Auditoria-UX (08/09/2026, pedido do Daniel: ajustes recomendados numa
// auditoria de UX — "cadastro de veículo tem 21 campos numa tela só, sem
// dividir em etapas") — as 4 seções que já existiam (Identificação,
// Especificações técnicas, TCO/Aquisição/Patrimônio, Localização e centro de
// custo) viram 4 "passos" de um wizard, sem mudar NADA da submissão em si:
// continua um <form> único, um POST só, no fim — só a APRESENTAÇÃO virou
// progressiva (mostra 1 seção por vez + Avançar/Voltar), com um indicador de
// progresso no topo. Escolhido de propósito em vez de dividir em várias
// telas/rotas: menos risco de regressão (a Server Action e toda a validação
// de VeiculoForm.tsx continuam exatamente iguais), e o usuário não perde
// nada se voltar uma etapa (os valores continuam no DOM, só ficam ocultos).
//
// Único cuidado: campos `required` (Placa sempre; Cliente só ao criar) ficam
// todos no passo 1 — um input dentro de uma seção com `hidden` (display:none)
// é isento da validação nativa do HTML5 ("barred from constraint
// validation" quando não está sendo renderizado), então o navegador não
// bloquearia sozinho um "Avançar" com a Placa vazia. Por isso `avancarPasso`
// valida esses campos manualmente antes de deixar sair do passo 1.
const ETAPAS = ["Identificação", "Especificações técnicas", "TCO / Aquisição / Patrimônio", "Localização e centro de custo"];

export function VeiculoForm({
  veiculo,
  empresas,
  centrosCusto,
  nomeEmpresaAtual,
}: {
  veiculo?: Veiculo;
  empresas: EmpresaOpcao[];
  centrosCusto: CentroCustoOpcao[];
  nomeEmpresaAtual?: string;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [passo, setPasso] = useState(0);
  const [passoMaisAlto, setPassoMaisAlto] = useState(0);
  const placaRef = useRef<HTMLInputElement>(null);
  const empresaRef = useRef<HTMLSelectElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = veiculo
        ? await atualizarVeiculo(veiculo.id, undefined, formData)
        : await criarVeiculo(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  function irParaPasso(destino: number) {
    setPasso(destino);
    setPassoMaisAlto((atual) => Math.max(atual, destino));
  }

  function avancarPasso() {
    // Únicos campos `required` do form inteiro — os dois moram no passo 1
    // (Identificação). `reportValidity()` mostra o balão de erro nativo do
    // navegador embaixo do campo, igual a um submit normal barrado.
    if (passo === 0) {
      if (placaRef.current && !placaRef.current.reportValidity()) return;
      if (empresaRef.current && !empresaRef.current.reportValidity()) return;
    }
    irParaPasso(Math.min(passo + 1, ETAPAS.length - 1));
  }

  function voltarPasso() {
    irParaPasso(Math.max(passo - 1, 0));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      {/* Indicador de progresso — clicável só pra passos já visitados (não
          deixa "pular" pra frente sem passar pela validação do Avançar). */}
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {ETAPAS.map((titulo, i) => {
          const ativo = i === passo;
          const concluido = i < passoMaisAlto;
          const alcancavel = i <= passoMaisAlto;
          return (
            <li key={titulo} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!alcancavel}
                onClick={() => alcancavel && irParaPasso(i)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition ${
                  ativo
                    ? "bg-frota-500 text-white"
                    : alcancavel
                      ? "bg-frota-50 text-frota-600 hover:bg-frota-100"
                      : "cursor-not-allowed bg-slate-100 text-slate-400"
                }`}
              >
                {concluido && !ativo ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}.</span>}
                {titulo}
              </button>
              {i < ETAPAS.length - 1 && <span className="text-slate-300">→</span>}
            </li>
          );
        })}
      </ol>

      <section className={`card p-6 ${passo === 0 ? "" : "hidden"}`}>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Identificação</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Placa" required>
            <input ref={placaRef} name="placa" required defaultValue={veiculo?.placa ?? ""} className="input" />
          </Campo>
          <Campo label="Marca">
            <input name="marca" defaultValue={veiculo?.marca ?? ""} className="input" />
          </Campo>
          <Campo label="Modelo">
            <input name="modelo" defaultValue={veiculo?.modelo ?? ""} className="input" />
          </Campo>
          <Campo label="Chassi">
            <input name="chassi" defaultValue={veiculo?.chassi ?? ""} className="input" />
          </Campo>
          <Campo label="Renavam">
            <input name="renavam" defaultValue={veiculo?.renavam ?? ""} className="input" />
          </Campo>
          <Campo label="Cor">
            <input name="cor" defaultValue={veiculo?.cor ?? ""} className="input" />
          </Campo>
          <Campo label="Tipo de veículo">
            <select name="tipo_veiculo" defaultValue={veiculo?.tipo_veiculo ?? ""} className="input">
              <option value="">Selecione...</option>
              {TIPOS_VEICULO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Classificação">
            <select name="classificacao" defaultValue={veiculo?.classificacao ?? "Próprio"} className="input">
              {CLASSIFICACAO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Campo>
          {/* Fase 27.124 — porte do veículo (Leve/Pesado), usado como filtro em
              Parâmetros de Uso (ex: variação de hodômetro por porte). */}
          <Campo label="Tipo">
            <select name="tipo" defaultValue={veiculo?.tipo ?? ""} className="input">
              <option value="">Selecione...</option>
              {TIPO_PORTE_VEICULO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>
          {!veiculo && (
            <Campo label="Cliente" required>
              <select ref={empresaRef} name="empresa_id" required defaultValue="" className="input">
                <option value="" disabled>
                  Selecione o cliente...
                </option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
      </section>

      <section className={`card p-6 ${passo === 1 ? "" : "hidden"}`}>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Especificações técnicas</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Motor">
            <input name="motor" defaultValue={veiculo?.motor ?? ""} className="input" />
          </Campo>
          <Campo label="Ano modelo">
            <input type="number" name="ano_modelo" defaultValue={veiculo?.ano_modelo ?? ""} className="input" />
          </Campo>
          <Campo label="Ano fabricação">
            <input
              type="number"
              name="ano_fabricacao"
              defaultValue={veiculo?.ano_fabricacao ?? ""}
              className="input"
            />
          </Campo>
          <Campo label="Combustível">
            <select name="combustivel" defaultValue={veiculo?.combustivel ?? ""} className="input">
              <option value="">Selecione...</option>
              {CICLOS_COMBUSTIVEL.map((c) => (
                <option key={c.key} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Tanque (litros)">
            <input type="number" step="0.01" name="tanque" defaultValue={veiculo?.tanque ?? ""} className="input" />
          </Campo>
          <Campo label="Autonomia (km/l)">
            <input
              type="number"
              step="0.01"
              name="autonomia"
              defaultValue={veiculo?.autonomia ?? ""}
              className="input"
            />
          </Campo>
          <Campo label="Hodômetro atual (km)">
            <input
              type="number"
              name="hodometro_atual"
              defaultValue={veiculo?.hodometro_atual ?? ""}
              className="input"
            />
          </Campo>
          <Campo label="Número de eixos">
            <input type="number" name="numero_eixos" defaultValue={veiculo?.numero_eixos ?? ""} className="input" />
          </Campo>
          {/* Fase KPIs-Operacionais (02/08/2026) — capacidade de carga útil,
              usada só pro KPI de Ocupação de Carga (peso do frete /
              capacidade do veículo) em Indicadores da Frota. Opcional. */}
          <Campo label="Capacidade de carga (kg)">
            <input
              type="number"
              step="0.01"
              name="capacidade_kg"
              defaultValue={veiculo?.capacidade_kg ?? ""}
              className="input"
            />
          </Campo>
        </div>
      </section>

      <section className={`card p-6 ${passo === 2 ? "" : "hidden"}`}>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">TCO / Aquisição / Patrimônio</h2>
        <p className="mb-4 text-xs text-slate-500">
          Opcional — usado pra calcular o TCO (custo total de propriedade) em{" "}
          <span className="font-medium">TCO / Custo por Veículo</span> e a depreciação contábil em{" "}
          <span className="font-medium">Patrimônio</span>. Sem esses dados, o TCO ainda é calculado (sem
          depreciação) e o veículo não entra no Patrimônio.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Campo label="Valor de aquisição (R$)">
            <input
              type="number"
              step="0.01"
              name="valor_aquisicao"
              defaultValue={veiculo?.valor_aquisicao ?? ""}
              className="input"
            />
          </Campo>
          <Campo label="Data de aquisição">
            <input
              type="date"
              name="data_aquisicao"
              defaultValue={veiculo?.data_aquisicao ?? ""}
              className="input"
            />
          </Campo>
          <Campo label="Valor residual estimado (R$)">
            <input
              type="number"
              step="0.01"
              name="valor_residual_estimado"
              defaultValue={veiculo?.valor_residual_estimado ?? ""}
              className="input"
            />
          </Campo>
          {/* Fase Grupo 2 (Rodopar, item 6, 03/08/2026) — vida útil contábil,
              usada só pelo módulo de Patrimônio (depreciação linha reta).
              Padrão 5 anos se deixado em branco. */}
          <Campo label="Vida útil contábil (anos)">
            <input
              type="number"
              step="1"
              min="1"
              name="vida_util_anos"
              placeholder="5"
              defaultValue={veiculo?.vida_util_anos ?? ""}
              className="input"
            />
          </Campo>
        </div>
      </section>

      <section className={`card p-6 ${passo === 3 ? "" : "hidden"}`}>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Localização e centro de custo</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Município">
            <input name="municipio" defaultValue={veiculo?.municipio ?? ""} className="input" />
          </Campo>
          <Campo label="UF">
            <input name="uf_veiculo" maxLength={2} defaultValue={veiculo?.uf_veiculo ?? ""} className="input" />
          </Campo>
          <Campo label="Centro de custo">
            <select name="centro_custo_id" defaultValue={veiculo?.centro_custo_id ?? ""} className="input">
              <option value="">Nenhum</option>
              {centrosCusto.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        {veiculo && (
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={veiculo.ativo ?? true}
              className="h-4 w-4 rounded border-slate-300"
            />
            Veículo ativo
          </label>
        )}

        {veiculo && nomeEmpresaAtual && (
          <p className="mt-4 text-xs text-slate-500">Cliente: {nomeEmpresaAtual} (não pode ser alterado aqui).</p>
        )}
      </section>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={voltarPasso}
          disabled={passo === 0}
          className={`btn-secondary ${passo === 0 ? "invisible" : ""}`}
        >
          ← Voltar
        </button>

        {passo < ETAPAS.length - 1 ? (
          <button type="button" onClick={avancarPasso} className="btn-primary">
            Avançar →
          </button>
        ) : (
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Salvando..." : veiculo ? "Salvar alterações" : "Cadastrar Veículo"}
          </button>
        )}
      </div>
    </form>
  );
}

function Campo({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
