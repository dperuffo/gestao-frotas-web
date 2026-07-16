"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarRegraAntifraude, atualizarRegraAntifraude } from "../actions";

type CondicoesRaw = {
  litros_max_dia?: number;
  valor_max_abastecimento?: number;
  intervalo_minimo_horas?: number;
  horario_permitido?: { inicio?: string | null; fim?: string | null };
  postos_permitidos_cnpj?: string[];
  distancia_maxima_km_da_rota?: number;
};

type RegraExistente = {
  id: string;
  nome: string;
  tipo: string;
  escopo: string;
  escopo_referencia: string | null;
  condicoes: CondicoesRaw;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  status: string;
};
type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null };
type MotoristaOpcao = { id: string; nome_completo: string; cpf: string };

const TIPOS = [
  { valor: "limite_valor_quantidade", label: "Limite de valor/quantidade" },
  { valor: "janela_tempo_frequencia", label: "Janela de tempo/frequência" },
  { valor: "localizacao_posto", label: "Localização/posto" },
] as const;

export function RegraAntifraudeForm({
  regra,
  empresaId,
  veiculos,
  motoristas,
}: {
  regra?: RegraExistente;
  empresaId: string;
  veiculos: VeiculoOpcao[];
  motoristas: MotoristaOpcao[];
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState(regra?.tipo ?? "limite_valor_quantidade");
  // "motorista_id" quando escopo=motorista guarda o id (uuid); quando
  // escopo=veiculo, escopo_referencia já É a placa direto — não precisa de
  // um id separado, então o <select> de escopo_referencia muda de opções
  // conforme o escopo selecionado.
  const [escopo, setEscopo] = useState(regra?.escopo ?? "empresa");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = regra
        ? await atualizarRegraAntifraude(regra.id, undefined, formData)
        : await criarRegraAntifraude(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {!regra && <input type="hidden" name="empresa_id" value={empresaId} />}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Dados da regra</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nome" required>
            <input
              type="text"
              name="nome"
              required
              defaultValue={regra?.nome ?? ""}
              placeholder='Ex.: "Limite diário motorista João"'
              className="input"
            />
          </Campo>
          <Campo label="Tipo de regra" required>
            <select
              name="tipo"
              required
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="input"
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Escopo" required>
            <select
              name="escopo"
              required
              value={escopo}
              onChange={(e) => setEscopo(e.target.value)}
              className="input"
            >
              <option value="empresa">Empresa toda</option>
              <option value="motorista">Um motorista específico</option>
              <option value="veiculo">Um veículo específico</option>
            </select>
          </Campo>
          {escopo === "motorista" && (
            <Campo label="Motorista" required>
              <select name="escopo_referencia" required defaultValue={regra?.escopo_referencia ?? ""} className="input">
                <option value="" disabled>
                  Selecione o motorista...
                </option>
                {motoristas.map((m) => (
                  <option key={m.id} value={m.cpf}>
                    {m.nome_completo} — {m.cpf}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          {escopo === "veiculo" && (
            <Campo label="Veículo (placa)" required>
              <select name="escopo_referencia" required defaultValue={regra?.escopo_referencia ?? ""} className="input">
                <option value="" disabled>
                  Selecione o veículo...
                </option>
                {veiculos.map((v) => (
                  <option key={v.placa} value={v.placa}>
                    {v.placa} {v.marca ? `— ${v.marca} ${v.modelo ?? ""}` : ""}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo label="Vigência — início" required>
            <input
              type="date"
              name="vigencia_inicio"
              required
              defaultValue={regra?.vigencia_inicio ?? new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </Campo>
          <Campo label="Vigência — fim (em branco = sem prazo)">
            <input type="date" name="vigencia_fim" defaultValue={regra?.vigencia_fim ?? ""} className="input" />
          </Campo>
        </div>

        {regra && (
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={regra.status === "Ativo"}
              className="h-4 w-4 rounded border-slate-300"
            />
            Regra ativa
          </label>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Condições</h2>

        {tipo === "limite_valor_quantidade" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Litros máximos por dia">
              <input
                type="number"
                step="0.01"
                min="0"
                name="litros_max_dia"
                defaultValue={regra?.condicoes.litros_max_dia ?? ""}
                className="input"
              />
            </Campo>
            <Campo label="Valor máximo por abastecimento (R$)">
              <input
                type="number"
                step="0.01"
                min="0"
                name="valor_max_abastecimento"
                defaultValue={regra?.condicoes.valor_max_abastecimento ?? ""}
                className="input"
              />
            </Campo>
            <p className="sm:col-span-2 text-xs text-slate-500">Preencha ao menos um dos dois campos acima.</p>
          </div>
        )}

        {tipo === "janela_tempo_frequencia" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Campo label="Intervalo mínimo entre abastecimentos (horas)">
              <input
                type="number"
                step="0.5"
                min="0"
                name="intervalo_minimo_horas"
                defaultValue={regra?.condicoes.intervalo_minimo_horas ?? ""}
                className="input"
              />
            </Campo>
            <Campo label="Horário permitido — início">
              <input
                type="time"
                name="horario_inicio"
                defaultValue={regra?.condicoes.horario_permitido?.inicio ?? ""}
                className="input"
              />
            </Campo>
            <Campo label="Horário permitido — fim">
              <input
                type="time"
                name="horario_fim"
                defaultValue={regra?.condicoes.horario_permitido?.fim ?? ""}
                className="input"
              />
            </Campo>
            <p className="sm:col-span-3 text-xs text-slate-500">
              Preencha o intervalo mínimo, o horário permitido, ou os dois.
            </p>
          </div>
        )}

        {tipo === "localizacao_posto" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="CNPJs de postos permitidos (separados por vírgula)">
              <textarea
                name="postos_permitidos_cnpj"
                rows={2}
                defaultValue={(regra?.condicoes.postos_permitidos_cnpj ?? []).join(", ")}
                placeholder="12345678000100, 98765432000100"
                className="input"
              />
            </Campo>
            <Campo label="Distância máxima da rota planejada (km)">
              <input
                type="number"
                step="0.1"
                min="0"
                name="distancia_maxima_km_da_rota"
                defaultValue={regra?.condicoes.distancia_maxima_km_da_rota ?? ""}
                className="input"
              />
            </Campo>
            <p className="sm:col-span-2 text-xs text-slate-500">Preencha ao menos um dos dois campos acima.</p>
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : regra ? "Salvar alterações" : "Salvar regra"}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
