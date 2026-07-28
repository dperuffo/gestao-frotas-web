"use client";

import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BuscaLocalInput, type LocalSelecionado } from "./BuscaLocalInput";
import { SalvarConsultaForm } from "./SalvarConsultaForm";
import MapaRotaLazy from "./MapaRotaLazy";
import { calcularRotaEPostosAcao, type ResultadoRotaCalculada } from "../actions";
import { PRODUTOS_POSTO, PRODUTOS_POR_TIPO_VEICULO } from "@/lib/constants";
import { corPorBandeira } from "@/lib/coresBandeira";
import { formatCNPJ, normalizarTexto } from "@/lib/utils";
import { calcularAbastecimentoParaSelecao } from "@/lib/roteirizacaoAlgoritmo";
import { custoPedagioTotal } from "@/lib/pedagio";
import type { VeiculoOpcao } from "./FormRoteirizacao";

const GRADE_COR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700",
  B: "bg-sky-100 text-sky-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-red-100 text-red-700",
};

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fase Seleção-Manual-de-Postos (28/07/2026) — evolução do antigo "Por
// Rota", que era só informativo (mostrava postos no corredor, sem veículo
// nem seleção). A pedido de um gestor de frota: agora esta tela também
// pede o veículo e deixa o próprio gestor CLICAR em quais postos do
// corredor serão as paradas de abastecimento — sem depender do algoritmo
// do Roteirizador Inteligente escolher por ele. Mesma mecânica de cálculo
// (calcularAbastecimentoParaSelecao) e mesmo componente de mapa
// (MapaRota/onTogglePosto) usados lá, só que aqui a seleção começa VAZIA
// (não tem sugestão automática — o gestor monta do zero).
export function FormPorRota({
  empresaId,
  veiculos,
  estadoInicial,
}: {
  empresaId: string | null;
  veiculos: VeiculoOpcao[];
  estadoInicial?: {
    origem: LocalSelecionado;
    destino: LocalSelecionado;
    paradas: LocalSelecionado[];
    raioKm: number;
    placa?: string;
    capacidade?: number;
    autonomia?: number;
    combustivel?: string;
    combustivelInicial?: number;
  } | null;
}) {
  const [origem, setOrigem] = useState<LocalSelecionado | null>(estadoInicial?.origem ?? null);
  const [destino, setDestino] = useState<LocalSelecionado | null>(estadoInicial?.destino ?? null);
  const [paradas, setParadas] = useState<LocalSelecionado[]>(estadoInicial?.paradas ?? []);
  const [raioKm, setRaioKm] = useState(estadoInicial?.raioKm ?? 5);
  const [placa, setPlaca] = useState(estadoInicial?.placa ?? "");
  const [capacidade, setCapacidade] = useState(estadoInicial?.capacidade ?? 80);
  const [autonomia, setAutonomia] = useState(estadoInicial?.autonomia ?? 10);
  const [combustivel, setCombustivel] = useState(estadoInicial?.combustivel ?? "");
  const [opcoesCombustivel, setOpcoesCombustivel] = useState<readonly string[]>(PRODUTOS_POSTO);
  const [avisoCombustivel, setAvisoCombustivel] = useState<string | null>(null);
  const [combustivelInicial, setCombustivelInicial] = useState(estadoInicial?.combustivelInicial ?? 0);
  const [resultado, setResultado] = useState<ResultadoRotaCalculada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Começa vazio — diferente do Roteirizador Inteligente, aqui não existe
  // sugestão automática de nenhum algoritmo: o gestor monta a lista de
  // paradas clicando nos postos que quiser, no mapa ou na tabela.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  // Fase Roteirização-Busca-Genérica (28/07/2026) — filtro livre (nome,
  // CNPJ, cidade ou estado) sobre a tabela de postos do corredor, mesmo
  // padrão usado no Roteirizador Inteligente.
  const [buscaPosto, setBuscaPosto] = useState("");

  function alternarPosto(cnpj: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(cnpj)) novo.delete(cnpj);
      else novo.add(cnpj);
      return novo;
    });
  }

  // Recalcula litros/custo/viabilidade a cada clique — 100% no client
  // (função pura), sem round-trip ao servidor.
  const paradasAtuais = useMemo(() => {
    if (!resultado) return { paradas: [], alertas: [] };
    return calcularAbastecimentoParaSelecao({
      candidatosSelecionados: resultado.candidatos.filter((c) => selecionados.has(c.cnpj)),
      capacidadeTanqueL: capacidade,
      autonomiaKmPorL: autonomia,
      distanciaTotalRotaKm: resultado.distanciaKm,
      combustivelInicialL: combustivelInicial || capacidade,
    });
  }, [resultado, selecionados, capacidade, autonomia, combustivelInicial]);

  const litrosTotalAtual = paradasAtuais.paradas.reduce((s, p) => s + p.litrosSugeridos, 0);
  const custoTotalAtual = Math.round(paradasAtuais.paradas.reduce((s, p) => s + p.custoAbastecimento, 0) * 100) / 100;

  // Fase Roteirização-Colunas-Extra (28/07/2026) — mesmo ajuste do
  // Roteirizador Inteligente: postos já selecionados aparecem primeiro na
  // tabela, sem precisar rolar a lista inteira pra achar o que já está
  // marcado.
  const candidatosOrdenados = useMemo(() => {
    if (!resultado) return [];
    return [...resultado.candidatos].sort((a, b) => {
      const aSel = selecionados.has(a.cnpj);
      const bSel = selecionados.has(b.cnpj);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return a.km - b.km;
    });
  }, [resultado, selecionados]);

  const candidatosFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaPosto);
    if (!termo) return candidatosOrdenados;
    return candidatosOrdenados.filter((c) =>
      normalizarTexto([c.label, c.cnpj, formatCNPJ(c.cnpj), c.municipio, c.uf].filter(Boolean).join(" ")).includes(
        termo
      )
    );
  }, [candidatosOrdenados, buscaPosto]);
  // ResultadoRotaCalculada não traz o custo de pedágio pronto (diferente do
  // Roteirizador Inteligente) — calcula aqui no client com a mesma função
  // pura usada no servidor (custoPedagioTotal, src/lib/pedagio.ts).
  const custoPedagioEstimado = useMemo(
    () => Math.round(custoPedagioTotal(resultado?.pracasPedagio ?? [], "carro") * 100) / 100,
    [resultado]
  );

  function selecionarVeiculo(idPlaca: string) {
    setPlaca(idPlaca);
    const v = veiculos.find((x) => x.placa === idPlaca);
    if (!v) {
      setOpcoesCombustivel(PRODUTOS_POSTO);
      setAvisoCombustivel(null);
      return;
    }
    if (v.tanque) setCapacidade(v.tanque);
    if (v.autonomia) setAutonomia(v.autonomia);

    const chave = (v.combustivel ?? "").trim().toLowerCase();
    const compativeis = PRODUTOS_POR_TIPO_VEICULO[chave];
    if (compativeis && compativeis.length === 1) {
      setOpcoesCombustivel(compativeis);
      setCombustivel(compativeis[0]);
      setAvisoCombustivel(null);
    } else if (compativeis && compativeis.length > 1) {
      setOpcoesCombustivel(compativeis);
      setCombustivel("");
      setAvisoCombustivel(`Veículo ${v.combustivel} — escolha o combustível desta viagem.`);
    } else {
      setOpcoesCombustivel(PRODUTOS_POSTO);
      setCombustivel("");
      setAvisoCombustivel(
        v.combustivel ? `Não reconheço "${v.combustivel}" — escolha o combustível manualmente.` : null
      );
    }
  }

  function calcular() {
    if (!empresaId) {
      setErro("Selecione um cliente antes.");
      return;
    }
    if (!origem || !destino) {
      setErro("Informe origem e destino.");
      return;
    }
    if (!combustivel.trim()) {
      setErro("Informe o combustível do veículo.");
      return;
    }
    if (capacidade <= 0 || autonomia <= 0) {
      setErro("Tanque e autonomia precisam ser maiores que zero.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await calcularRotaEPostosAcao({
        empresaId,
        origem,
        destino,
        paradas: paradas.filter((p) => p.lat !== 0 || p.lon !== 0).map((p) => ({ lat: p.lat, lon: p.lon })),
        combustivel,
        raioKm,
      });
      setResultado(r);
      // Manual: nenhuma parada vem pré-marcada — o gestor escolhe do zero.
      setSelecionados(new Set());
    });
  }

  // Ao restaurar uma consulta salva (via ?rotaId=), já dispara o cálculo
  // automaticamente para não exigir um clique extra do usuário.
  useEffect(() => {
    if (estadoInicial) calcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="card mb-6 space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Origem</label>
            <BuscaLocalInput placeholder="Cidade de origem" valorInicial={origem} onSelecionar={setOrigem} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Destino</label>
            <BuscaLocalInput placeholder="Cidade de destino" valorInicial={destino} onSelecionar={setDestino} />
          </div>
        </div>

        {paradas.map((_, i) => (
          <div key={i}>
            <label className="mb-1 block text-xs font-medium text-slate-500">Parada {i + 1}</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <BuscaLocalInput
                  placeholder="Cidade da parada"
                  valorInicial={paradas[i]}
                  onSelecionar={(local) =>
                    setParadas((atual) => atual.map((p, idx) => (idx === i ? (local ?? p) : p)))
                  }
                />
              </div>
              <button
                type="button"
                className="text-sm text-slate-400 hover:text-red-600"
                onClick={() => setParadas((atual) => atual.filter((_, idx) => idx !== i))}
              >
                remover
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setParadas((atual) => [...atual, { label: "", lat: 0, lon: 0 }])}
        >
          + Adicionar parada
        </button>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-semibold text-slate-900">Veículo</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Veículo cadastrado</label>
              <select value={placa} onChange={(e) => selecionarVeiculo(e.target.value)} className="input">
                <option value="">Manual (preencher abaixo)</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.placa}>
                    {v.placa} {v.modelo ? `— ${v.modelo}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Tanque (L)</label>
              <input
                type="number"
                min={1}
                value={capacidade}
                onChange={(e) => setCapacidade(Number(e.target.value) || 0)}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Autonomia (km/L)</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={autonomia}
                onChange={(e) => setAutonomia(Number(e.target.value) || 0)}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Combustível</label>
              <select value={combustivel} onChange={(e) => setCombustivel(e.target.value)} className="input">
                <option value="" disabled>
                  Selecione...
                </option>
                {opcoesCombustivel.map((produto) => (
                  <option key={produto} value={produto}>
                    {produto}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {avisoCombustivel && <p className="text-xs text-amber-700">{avisoCombustivel}</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-slate-500">Combustível já no tanque (L)</label>
              <input
                type="number"
                min={0}
                value={combustivelInicial}
                onChange={(e) => setCombustivelInicial(Number(e.target.value) || 0)}
                placeholder={`padrão: cheio (${capacidade} L)`}
                className="input"
              />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs font-medium text-slate-500">Raio de busca (km)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={raioKm}
                onChange={(e) => setRaioKm(Number(e.target.value) || 5)}
                className="input"
              />
            </div>
          </div>
        </div>

        <button type="button" disabled={isPending} className="btn-primary disabled:opacity-50" onClick={calcular}>
          {isPending ? "Calculando..." : "Calcular rota"}
        </button>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </div>

      {resultado && origem && destino && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Distância</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{resultado.distanciaKm} km</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Paradas selecionadas</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{paradasAtuais.paradas.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Litros totais</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{litrosTotalAtual} L</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Custo combustível</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatarMoeda(custoTotalAtual)}</p>
            </div>
          </div>

          {paradasAtuais.alertas.length > 0 && (
            <div className="mb-6 space-y-1.5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">⚠️ Verifique a seleção de postos:</p>
              {paradasAtuais.alertas.map((alerta, i) => (
                <p key={i}>• {alerta}</p>
              ))}
            </div>
          )}

          {resultado.linhaReta && (
            <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Não foi possível calcular a rota real pelas estradas agora (serviço OSRM indisponível) — os valores
              acima são uma aproximação em linha reta.
            </p>
          )}

          {resultado.usouFallbackAnp && (
            <p className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Alguns dos postos do corredor (marcados &quot;Base ANP&quot; na tabela abaixo) vêm da base pública
              nacional, com a estimativa oficial de preço da ANP — não um preço negociado.
            </p>
          )}

          <div className="mb-6">
            <p className="mb-2 text-xs text-slate-500">
              Clique num posto no mapa (ou na tabela abaixo) pra marcar/desmarcar como parada de abastecimento.
              Postos em cinza ainda não foram selecionados.
            </p>
            <MapaRotaLazy
              rota={resultado.coordenadas}
              onTogglePosto={alternarPosto}
              marcadores={[
                { lat: origem.lat, lon: origem.lon, label: origem.label, cor: "verde" },
                ...paradas
                  .filter((p) => p.lat && p.lon)
                  .map((p) => ({ lat: p.lat, lon: p.lon, label: p.label, cor: "laranja" as const })),
                { lat: destino.lat, lon: destino.lon, label: destino.label, cor: "vermelho" },
                ...resultado.candidatos.map((c) => {
                  const selecionado = selecionados.has(c.cnpj);
                  const parada = paradasAtuais.paradas.find((p) => p.cnpj === c.cnpj);
                  return {
                    lat: c.lat,
                    lon: c.lon,
                    label: c.label,
                    cnpj: c.cnpj,
                    selecionado,
                    infoExtra: parada
                      ? `${parada.litrosSugeridos} L · ${formatarMoeda(parada.custoAbastecimento)}`
                      : `km ${c.km.toFixed(0)} · R$ ${c.preco.toFixed(3)}/L`,
                    cor: corPorBandeira(c.bandeira),
                    legendaLabel: c.bandeira ?? "Sem bandeira",
                  };
                }),
                ...resultado.pracasPedagio.map((praca) => ({
                  lat: praca.lat,
                  lon: praca.lon,
                  label: praca.nome,
                  pedagio: true as const,
                  popup: [
                    praca.concessionaria,
                    praca.valorCarro != null ? `Carro: ${formatarMoeda(praca.valorCarro)}` : null,
                    praca.valorCaminhaoEixo != null ? `Caminhão: ${formatarMoeda(praca.valorCaminhaoEixo)}/eixo` : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                })),
              ]}
            />
          </div>

          <div className="card mb-6 overflow-x-auto p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Postos no corredor <AjudaIcon chave="roteirizacao.score_posto" />
              </h2>
              <p className="text-xs text-slate-500">Clique numa linha pra marcar/desmarcar como parada.</p>
            </div>
            {resultado.candidatos.length > 0 && (
              <input
                type="search"
                value={buscaPosto}
                onChange={(e) => setBuscaPosto(e.target.value)}
                placeholder="Buscar por nome, CNPJ, cidade ou estado..."
                className="input mb-3 max-w-sm"
              />
            )}
            {resultado.candidatos.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum posto candidato encontrado no corredor da rota.</p>
            ) : candidatosFiltrados.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum posto encontrado para &quot;{buscaPosto}&quot;.</p>
            ) : (
              <table className="w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap py-2 pr-4">Selecionado</th>
                    <th className="py-2 pr-4">Posto</th>
                    <th className="whitespace-nowrap py-2 pr-4">Cidade/UF</th>
                    <th className="whitespace-nowrap py-2 pr-4">Grade</th>
                    <th className="whitespace-nowrap py-2 pr-4">Km</th>
                    <th className="whitespace-nowrap py-2 pr-4">Preço</th>
                    <th className="whitespace-nowrap py-2 pr-4">Chegada</th>
                    <th className="whitespace-nowrap py-2 pr-4">Litros</th>
                    <th className="whitespace-nowrap py-2 pr-4">Custo</th>
                    <th className="whitespace-nowrap py-2">Saída</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidatosFiltrados.map((c) => {
                    const selecionado = selecionados.has(c.cnpj);
                    const parada = paradasAtuais.paradas.find((p) => p.cnpj === c.cnpj);
                    return (
                      <tr
                        key={c.cnpj}
                        onClick={() => alternarPosto(c.cnpj)}
                        className={`cursor-pointer ${selecionado ? "bg-frota-50" : "hover:bg-slate-50"}`}
                      >
                        <td className="py-2.5 pr-4 align-top">
                          <input type="checkbox" checked={selecionado} readOnly className="h-4 w-4" />
                        </td>
                        <td className="py-2.5 pr-4 align-top text-slate-700">
                          {c.label}
                          {c.origem === "anp" && (
                            <span className="ml-1.5 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                              Base ANP
                            </span>
                          )}
                          <p className="mt-0.5 text-xs font-normal text-slate-400">{formatCNPJ(c.cnpj)}</p>
                        </td>
                        <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">
                          {[c.municipio, c.uf].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="py-2.5 pr-4 align-top">
                          {c.grade && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${GRADE_COR[c.grade] ?? ""}`}
                            >
                              {c.grade}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">{c.km.toFixed(0)} km</td>
                        <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">
                          R$ {c.preco.toFixed(3)}
                        </td>
                        <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">
                          {parada ? `${parada.pctChegada.toFixed(0)}% tanque` : "—"}
                        </td>
                        <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">
                          {parada ? `${parada.litrosSugeridos} L` : "—"}
                        </td>
                        <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">
                          {parada ? formatarMoeda(parada.custoAbastecimento) : "—"}
                        </td>
                        <td className="py-2.5 align-top whitespace-nowrap text-slate-600">
                          {parada ? `${parada.pctApos.toFixed(0)}% tanque` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {resultado.pracasPedagio.length > 0 && (
            <div className="card mb-6 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  🎫 {resultado.pracasPedagio.length} praça{resultado.pracasPedagio.length > 1 ? "s" : ""} de pedágio
                  no trajeto
                </p>
                <p className="text-sm text-slate-600">
                  Estimado (carro/utilitário):{" "}
                  <strong className="text-slate-900">{formatarMoeda(custoPedagioEstimado)}</strong>
                </p>
              </div>
            </div>
          )}

          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/planos-viagem/novo?${new URLSearchParams({
                  ...(empresaId ? { empresa: empresaId } : {}),
                  prefill: JSON.stringify({
                    nome: `${origem.label} → ${destino.label}`,
                    placa: placa || undefined,
                    kmEstimado: Math.round(resultado.distanciaKm),
                    consumoKmL: autonomia || undefined,
                    precoCombustivel:
                      litrosTotalAtual > 0 ? Math.round((custoTotalAtual / litrosTotalAtual) * 1000) / 1000 : undefined,
                    pedagios: resultado.pracasPedagio.map((praca) => ({
                      praca_nome: praca.nome,
                      valor: praca.valorCaminhaoEixo ?? praca.valorCarro ?? 0,
                    })),
                    // Fase Pré-Pedido — mesmo padrão do Roteirizador
                    // Inteligente: leva a seleção de paradas até o Plano de
                    // Viagem, pra virar Pré-Pedido automático se a empresa
                    // tiver o parâmetro habilitado.
                    paradas: paradasAtuais.paradas.map((p, i) => ({
                      ordem: i,
                      posto_cnpj: p.cnpj,
                      posto_nome: p.label,
                      km_previsto: Math.round(p.km * 10) / 10,
                      litros_previstos: Math.round(p.litrosSugeridos * 10) / 10,
                      lat: p.lat,
                      lon: p.lon,
                    })),
                  }),
                }).toString()}`}
                className="btn-secondary"
              >
                🧾 Criar Plano de Viagem
              </Link>
              <SalvarConsultaForm
                tipo="rota"
                empresaId={empresaId}
                dados={{
                  origem,
                  destino,
                  paradas,
                  raioKm,
                  placa,
                  capacidade,
                  autonomia,
                  combustivel,
                  combustivelInicial,
                }}
                nomeSugerido={`${origem.label} → ${destino.label}`}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
