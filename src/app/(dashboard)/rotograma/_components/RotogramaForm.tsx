"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import {
  criarRotogramaAcao,
  atualizarRotogramaAcao,
  buscarRotaSalvaParaRotogramaAcao,
  listarMotoristasEVeiculosAcao,
  type OpcaoMotoristaRotograma,
  type OpcaoVeiculoRotograma,
} from "../actions";
import { CATEGORIAS_RISCO, CATEGORIAS_PARADA, type RotogramaRisco, type RotogramaParada } from "../tipos";
import type { Database } from "@/types/database.types";

type Rotograma = Database["public"]["Tables"]["rotogramas"]["Row"];
type EmpresaOpcao = { id: string; nome: string };
type RotaSalvaOpcao = { id: string; nome: string };

let proximoId = 0;
function novoId() {
  proximoId += 1;
  return proximoId;
}

type LinhaRisco = RotogramaRisco & { chave: number };
type LinhaParada = RotogramaParada & { chave: number };

export type PrefillRotograma = {
  origem?: string;
  destino?: string;
  placa?: string;
  paradas?: RotogramaParada[];
};

export function RotogramaForm({
  rotograma,
  empresas,
  rotasSalvas,
  nomeEmpresaAtual,
  prefill,
}: {
  rotograma?: Rotograma;
  empresas: EmpresaOpcao[];
  rotasSalvas: RotaSalvaOpcao[];
  nomeEmpresaAtual?: string;
  prefill?: PrefillRotograma;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [importando, setImportando] = useState(false);

  // Vem do botão "Gerar Rotograma" na Roteirização (ver /rotograma/novo) —
  // pré-preenche origem/destino/placa/paradas sugeridas sem precisar do
  // dropdown "Importar de uma rota salva" abaixo.
  const [origem, setOrigem] = useState(rotograma?.origem ?? prefill?.origem ?? "");
  const [destino, setDestino] = useState(rotograma?.destino ?? prefill?.destino ?? "");
  const [placa, setPlaca] = useState(rotograma?.placa ?? prefill?.placa ?? "");
  const [motorista, setMotorista] = useState(rotograma?.motorista ?? "");

  // Motorista e Placa vêm de listas (cadastro de motoristas/veículos do
  // cliente), em vez de digitação livre — dependem do cliente selecionado
  // (no "novo") ou já fixo (na edição, ver rotograma?.empresa_id abaixo).
  const [empresaId, setEmpresaId] = useState(rotograma?.empresa_id ?? "");
  const [motoristasOpcoes, setMotoristasOpcoes] = useState<OpcaoMotoristaRotograma[]>([]);
  const [veiculosOpcoes, setVeiculosOpcoes] = useState<OpcaoVeiculoRotograma[]>([]);
  const [carregandoListas, setCarregandoListas] = useState(false);

  useEffect(() => {
    if (!empresaId) {
      setMotoristasOpcoes([]);
      setVeiculosOpcoes([]);
      return;
    }
    let cancelado = false;
    setCarregandoListas(true);
    listarMotoristasEVeiculosAcao(empresaId)
      .then((res) => {
        if (cancelado) return;
        setMotoristasOpcoes(res.motoristas);
        setVeiculosOpcoes(res.veiculos);
      })
      .finally(() => {
        if (!cancelado) setCarregandoListas(false);
      });
    return () => {
      cancelado = true;
    };
  }, [empresaId]);

  const [riscos, setRiscos] = useState<LinhaRisco[]>(
    ((rotograma?.riscos as RotogramaRisco[] | null) ?? []).map((r) => ({ ...r, chave: novoId() }))
  );
  const [paradas, setParadas] = useState<LinhaParada[]>(
    ((rotograma?.paradas as RotogramaParada[] | null) ?? prefill?.paradas ?? []).map((p) => ({
      ...p,
      chave: novoId(),
    }))
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = rotograma
        ? await atualizarRotogramaAcao(rotograma.id, undefined, formData)
        : await criarRotogramaAcao(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  async function handleImportarRota(rotaSalvaId: string) {
    if (!rotaSalvaId) return;
    setImportando(true);
    try {
      const dados = await buscarRotaSalvaParaRotogramaAcao(rotaSalvaId);
      if (dados) {
        if (dados.origem) setOrigem(dados.origem);
        if (dados.destino) setDestino(dados.destino);
        if (dados.placa) setPlaca(dados.placa);
      }
    } finally {
      setImportando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      {!rotograma && rotasSalvas.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Importar de uma rota salva (opcional)</h2>
          <p className="mb-3 text-xs text-slate-500">
            Preenche origem, destino e placa a partir de uma rota já salva na Roteirização. Você pode ajustar tudo
            depois.
          </p>
          <select
            className="input max-w-md"
            defaultValue=""
            disabled={importando}
            onChange={(e) => handleImportarRota(e.target.value)}
          >
            <option value="">{importando ? "Importando..." : "Selecione uma rota salva..."}</option>
            {rotasSalvas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Dados da viagem</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Origem" required>
            <input
              name="origem"
              required
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              placeholder="Ex.: São Paulo/SP"
              className="input"
            />
          </Campo>
          <Campo label="Destino" required>
            <input
              name="destino"
              required
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Ex.: Belo Horizonte/MG"
              className="input"
            />
          </Campo>
          <Campo label="Motorista">
            <select name="motorista" value={motorista} onChange={(e) => setMotorista(e.target.value)} className="input">
              <option value="">
                {!empresaId ? "Selecione o cliente primeiro" : carregandoListas ? "Carregando..." : "Selecione..."}
              </option>
              {motorista && !motoristasOpcoes.some((m) => m.nome === motorista) && (
                <option value={motorista}>{motorista}</option>
              )}
              {motoristasOpcoes.map((m) => (
                <option key={m.id} value={m.nome}>
                  {m.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Veículo">
            <input
              name="veiculo"
              defaultValue={rotograma?.veiculo ?? ""}
              placeholder="Ex.: Caminhão baú"
              className="input"
            />
          </Campo>
          <Campo label="Placa">
            <select name="placa" value={placa} onChange={(e) => setPlaca(e.target.value)} className="input">
              <option value="">
                {!empresaId ? "Selecione o cliente primeiro" : carregandoListas ? "Carregando..." : "Selecione..."}
              </option>
              {placa && !veiculosOpcoes.some((v) => v.placa === placa) && <option value={placa}>{placa}</option>}
              {veiculosOpcoes.map((v) => (
                <option key={v.id} value={v.placa}>
                  {v.placa}
                  {v.descricao ? ` — ${v.descricao}` : ""}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Data da viagem">
            <input type="date" name="data_viagem" defaultValue={rotograma?.data_viagem ?? ""} className="input" />
          </Campo>
          <Campo label="Carga">
            <input name="carga" defaultValue={rotograma?.carga ?? ""} className="input" />
          </Campo>
          {!rotograma && (
            <Campo label="Cliente" required>
              <select
                name="empresa_id"
                required
                value={empresaId}
                onChange={(e) => {
                  setEmpresaId(e.target.value);
                  setMotorista("");
                  setPlaca("");
                }}
                className="input"
              >
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
        <div className="mt-4">
          <Campo label="Observações">
            <textarea name="observacoes" rows={2} defaultValue={rotograma?.observacoes ?? ""} className="input" />
          </Campo>
        </div>
        {rotograma && nomeEmpresaAtual && (
          <p className="mt-4 text-xs text-slate-500">Cliente: {nomeEmpresaAtual} (não pode ser alterado aqui).</p>
        )}
      </section>

      <ListaRiscos riscos={riscos} setRiscos={setRiscos} />
      <ListaParadas paradas={paradas} setParadas={setParadas} />

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : rotograma ? "Salvar alterações" : "Criar Rotograma"}
        </button>
      </div>
    </form>
  );
}

function ListaRiscos({
  riscos,
  setRiscos,
}: {
  riscos: LinhaRisco[];
  setRiscos: React.Dispatch<React.SetStateAction<LinhaRisco[]>>;
}) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">⚠️ Pontos de risco</h2>
          <p className="text-xs text-slate-500">Trechos perigosos, zonas de crime, radares e lombadas na rota.</p>
        </div>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => setRiscos((atual) => [...atual, { local: "", categoria: "perigo", descricao: "", chave: novoId() }])}
        >
          + Adicionar ponto de risco
        </button>
      </div>

      {riscos.length === 0 && <p className="text-sm text-slate-400">Nenhum ponto de risco adicionado.</p>}

      <div className="space-y-3">
        {riscos.map((r, i) => (
          <div key={r.chave} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Km</label>
              <input
                type="number"
                step="0.1"
                min="0"
                name={`riscos[${i}][km]`}
                defaultValue={r.km ?? ""}
                placeholder="Ex.: 120"
                className="input"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Local</label>
              <input
                name={`riscos[${i}][local]`}
                defaultValue={r.local}
                placeholder="Ex.: BR-381 km 120 — Itatiaia/MG"
                className="input"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Categoria</label>
              <select name={`riscos[${i}][categoria]`} defaultValue={r.categoria} className="input">
                {CATEGORIAS_RISCO.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.icone} {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Descrição</label>
              <input
                name={`riscos[${i}][descricao]`}
                defaultValue={r.descricao}
                placeholder="Ex.: Vel. máx 60 km/h"
                className="input"
              />
            </div>
            <div className="sm:col-span-1">
              <button
                type="button"
                onClick={() => setRiscos((atual) => atual.filter((x) => x.chave !== r.chave))}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-red-600 hover:bg-red-50"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        O campo Km posiciona o ponto na linha do tempo da viagem. Se não preenchido, tentamos extrair do
        texto do Local (ex.: &quot;km 120&quot;) — senão, distribuímos os pontos igualmente entre origem e destino.
      </p>
    </section>
  );
}

function ListaParadas({
  paradas,
  setParadas,
}: {
  paradas: LinhaParada[];
  setParadas: React.Dispatch<React.SetStateAction<LinhaParada[]>>;
}) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">📍 Pontos de parada</h2>
          <p className="text-xs text-slate-500">Postos, restaurantes e locais seguros para pernoite na rota.</p>
        </div>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() =>
            setParadas((atual) => [...atual, { local: "", categoria: "abastecimento", descricao: "", chave: novoId() }])
          }
        >
          + Adicionar parada
        </button>
      </div>

      {paradas.length === 0 && <p className="text-sm text-slate-400">Nenhuma parada adicionada.</p>}

      <div className="space-y-3">
        {paradas.map((p, i) => (
          <div key={p.chave} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Km</label>
              <input
                type="number"
                step="0.1"
                min="0"
                name={`paradas[${i}][km]`}
                defaultValue={p.km ?? ""}
                placeholder="Ex.: 210"
                className="input"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Local</label>
              <input
                name={`paradas[${i}][local]`}
                defaultValue={p.local}
                placeholder="Ex.: Posto Ipiranga — km 210"
                className="input"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Categoria</label>
              <select name={`paradas[${i}][categoria]`} defaultValue={p.categoria} className="input">
                {CATEGORIAS_PARADA.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.icone} {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Descrição</label>
              <input
                name={`paradas[${i}][descricao]`}
                defaultValue={p.descricao}
                placeholder="Ex.: R$ 6,05/L · Aberto 24h"
                className="input"
              />
            </div>
            <div className="sm:col-span-1">
              <button
                type="button"
                onClick={() => setParadas((atual) => atual.filter((x) => x.chave !== p.chave))}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-red-600 hover:bg-red-50"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
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
