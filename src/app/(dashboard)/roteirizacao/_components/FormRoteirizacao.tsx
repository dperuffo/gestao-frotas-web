"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BuscaLocalInput, type LocalSelecionado } from "./BuscaLocalInput";
import { SalvarConsultaForm } from "./SalvarConsultaForm";
import MapaRotaLazy from "./MapaRotaLazy";
import { calcularRoteirizacaoAcao, type ResultadoRoteirizacao } from "../actions";
import { PERFIS_PESO, PERFIL_PADRAO } from "@/lib/roteirizacaoScore";
import { PRODUTOS_POSTO, PRODUTOS_POR_TIPO_VEICULO } from "@/lib/constants";
import { corPorBandeira } from "@/lib/coresBandeira";
import { formatCNPJ } from "@/lib/utils";
import { calcularAbastecimentoParaSelecao } from "@/lib/roteirizacaoAlgoritmo";
import { ComparativoEstrategias } from "./ComparativoEstrategias";
import { GraficosRota } from "./GraficosRota";
import { ComparativoPrecos } from "./ComparativoPrecos";
import { BotaoExportarGpx } from "./BotaoExportarGpx";
import { BotaoGerarCardPng } from "./BotaoGerarCardPng";
import BotaoBaixarPdfRotaLazy from "./BotaoBaixarPdfRotaLazy";

export type VeiculoOpcao = {
  id: string;
  placa: string;
  modelo: string | null;
  tanque: number | null;
  autonomia: number | null;
  combustivel: string | null;
};

const MOTIVO_LABEL: Record<string, string> = {
  otimizado: "Melhor custo-benefício",
  estrategico: "Vale a pena esticar até aqui",
  emergencia: "Parada obrigatória (tanque no limite)",
  // Fase Seleção-Manual-de-Postos — parada escolhida pelo próprio gestor
  // (não pelo algoritmo), ver calcularAbastecimentoParaSelecao.
  manual: "Selecionada pelo gestor",
};

const GRADE_COR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700",
  B: "bg-sky-100 text-sky-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-red-100 text-red-700",
};

const ABAS_RESULTADO = [
  { chave: "mapa", label: "🗺️ Mapa da Rota" },
  { chave: "abastecimento", label: "⛽ Abastecimento" },
  { chave: "custo", label: "💰 Custo da Viagem" },
  { chave: "resumo", label: "📋 Resumo" },
] as const;
type AbaResultado = (typeof ABAS_RESULTADO)[number]["chave"];

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function FormRoteirizacao({
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
    placa?: string;
    capacidade: number;
    autonomia: number;
    combustivel: string;
    combustivelInicial: number;
    perfilChave: string;
  } | null;
}) {
  const [origem, setOrigem] = useState<LocalSelecionado | null>(estadoInicial?.origem ?? null);
  const [destino, setDestino] = useState<LocalSelecionado | null>(estadoInicial?.destino ?? null);
  const [paradas, setParadas] = useState<LocalSelecionado[]>(estadoInicial?.paradas ?? []);
  const [placa, setPlaca] = useState(estadoInicial?.placa ?? "");
  const [capacidade, setCapacidade] = useState(estadoInicial?.capacidade ?? 80);
  const [autonomia, setAutonomia] = useState(estadoInicial?.autonomia ?? 10);
  const [combustivel, setCombustivel] = useState(estadoInicial?.combustivel ?? "");
  // Produtos compatíveis com o veículo selecionado (ex: um Flex mostra só
  // gasolina/etanol) — sem veículo selecionado, mostra a lista completa.
  const [opcoesCombustivel, setOpcoesCombustivel] = useState<readonly string[]>(PRODUTOS_POSTO);
  const [avisoCombustivel, setAvisoCombustivel] = useState<string | null>(null);
  const [combustivelInicial, setCombustivelInicial] = useState(estadoInicial?.combustivelInicial ?? 0);
  const [perfilChave, setPerfilChave] = useState(estadoInicial?.perfilChave ?? PERFIL_PADRAO);
  const [resultado, setResultado] = useState<ResultadoRoteirizacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [abaAtiva, setAbaAtiva] = useState<AbaResultado>("mapa");
  // Fase Seleção-Manual-de-Postos (28/07/2026) — pedido de um gestor de
  // frota: depois de calcular, ele quer ver TODOS os postos do corredor
  // (não só os que o algoritmo escolheu) e poder marcar/desmarcar quais o
  // motorista vai realmente usar. Começa com os CNPJs que o algoritmo
  // sugeriu (ver calcular() abaixo) — o gestor ajusta a partir daí.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function alternarPosto(cnpj: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(cnpj)) novo.delete(cnpj);
      else novo.add(cnpj);
      return novo;
    });
  }

  // Recalcula litros/custo/viabilidade a cada mudança de seleção — 100% no
  // client (calcularAbastecimentoParaSelecao é pura), sem round-trip ao
  // servidor a cada clique. Também recalcula se o gestor mudar tanque/
  // autonomia/combustível inicial depois de já ter um resultado.
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

  // Fase Roteirização-Colunas-Extra (28/07/2026) — pedido do Daniel: os
  // postos já escolhidos (pelo algoritmo ou ajustados pelo gestor) aparecem
  // primeiro na tabela, pra não precisar rolar a lista inteira pra achar o
  // que já está marcado. Dentro de cada grupo (selecionado/não selecionado),
  // mantém a ordem por km da rota.
  const candidatosOrdenados = useMemo(() => {
    if (!resultado) return [];
    return [...resultado.candidatos].sort((a, b) => {
      const aSel = selecionados.has(a.cnpj);
      const bSel = selecionados.has(b.cnpj);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return a.km - b.km;
    });
  }, [resultado, selecionados]);

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

    // O motor do veículo (ex: "Flex", "Diesel S10") não é o mesmo nome do
    // produto vendido no posto — resolve pra lista de produtos compatíveis
    // em vez de usar o valor bruto direto (que nunca bateria com nenhum
    // preço registrado, ex: nenhum posto vende "Flex").
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
    if (!empresaId) return setErro("Selecione um cliente antes.");
    if (!origem || !destino) return setErro("Informe origem e destino.");
    if (!combustivel.trim()) return setErro("Informe o combustível do veículo.");
    if (capacidade <= 0 || autonomia <= 0) return setErro("Tanque e autonomia precisam ser maiores que zero.");
    setErro(null);
    startTransition(async () => {
      const r = await calcularRoteirizacaoAcao({
        empresaId,
        origem,
        destino,
        paradas: paradas.filter((p) => p.lat !== 0 || p.lon !== 0).map((p) => ({ lat: p.lat, lon: p.lon })),
        veiculo: {
          capacidadeTanqueL: capacidade,
          autonomiaKmPorL: autonomia,
          combustivel,
          combustivelInicialL: combustivelInicial || capacidade,
        },
        perfilChave,
      });
      setResultado(r);
      // A sugestão do algoritmo vira o ponto de partida da seleção — o
      // gestor ajusta a partir daí (marca/desmarca postos).
      setSelecionados(new Set(r.paradas.map((p) => p.cnpj)));
      setAbaAtiva("mapa");
    });
  }

  useEffect(() => {
    if (estadoInicial) calcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const perfilAtual = PERFIS_PESO.find((p) => p.chave === perfilChave) ?? PERFIS_PESO[1];

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
          <div className="mt-3 w-48">
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
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-semibold text-slate-900">Perfil de otimização</p>
          <div className="grid gap-2 sm:grid-cols-4">
            {PERFIS_PESO.map((p) => (
              <button
                key={p.chave}
                type="button"
                onClick={() => setPerfilChave(p.chave)}
                className={`rounded-lg border p-3 text-left text-sm ${
                  perfilChave === p.chave
                    ? "border-frota-600 bg-frota-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-medium text-slate-900">
                  {p.icone} {p.nome}
                </p>
                <p className="mt-1 text-xs text-slate-500">{p.descricao}</p>
              </button>
            ))}
          </div>
        </div>

        <button type="button" disabled={isPending} className="btn-primary disabled:opacity-50" onClick={calcular}>
          {isPending ? "Calculando..." : "Calcular paradas de abastecimento"}
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

          {resultado.pracasPedagio.length > 0 && (
            <div className="mb-6 card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  🎫 {resultado.pracasPedagio.length} praça{resultado.pracasPedagio.length > 1 ? "s" : ""} de pedágio no
                  trajeto
                </p>
                <p className="text-sm text-slate-600">
                  Estimado (carro/utilitário): <strong className="text-slate-900">{formatarMoeda(resultado.custoPedagioEstimado)}</strong>
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Caminhão paga por eixo — veja o valor por eixo de cada praça no mapa ou na aba Resumo.
              </p>
            </div>
          )}

          {resultado.candidatosEncontrados === 0 && (
            <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Nenhum posto da rede — nem da base pública ANP — tem preço registrado para &quot;{combustivel}
              &quot; dentro do corredor de 5 km da rota.
            </p>
          )}

          {/* Fase 27.17 — cliente sem postos próprios (postos_gf) cadastrados
              ainda consegue uma roteirização utilizável: os candidatos vieram
              da base pública da ANP (~35 mil postos) em vez da rede própria.
              Mensagem informativa, não de erro, porque o resultado É válido —
              só explica a origem dos dados e sugere o próximo passo.
              Fase 27.140 — antes só aparecia quando a rede própria estava
              zerada no corredor (fallback); agora os dois conjuntos são
              sempre mesclados, então a mensagem também cobre o caso misto
              (algumas paradas próprias, outras "Base ANP" — sinalizadas
              individualmente na tabela de abastecimento). */}
          {resultado.usouFallbackAnp && (
            <p className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Algumas das paradas sugeridas (marcadas &quot;Base ANP&quot; na tabela abaixo) vêm da base pública
              nacional, com a estimativa oficial de preço da ANP — não um preço negociado. Cadastre mais postos do
              seu relacionamento em{" "}
              <Link href="/postos" className="font-medium underline">
                Postos Revendedores
              </Link>{" "}
              para ter preços reais e comparativos mais precisos nas próximas rotas.
            </p>
          )}

          {/* ── Abas de resultado (Mapa / Abastecimento / Custo / Resumo) ── */}
          <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200">
            {ABAS_RESULTADO.map((aba) => (
              <button
                key={aba.chave}
                type="button"
                onClick={() => setAbaAtiva(aba.chave)}
                className={
                  "border-b-2 px-3 py-2 text-sm font-medium " +
                  (abaAtiva === aba.chave
                    ? "border-frota-600 text-frota-600"
                    : "border-transparent text-slate-500 hover:text-slate-700")
                }
              >
                {aba.label}
              </button>
            ))}
          </div>

          {abaAtiva === "mapa" && (
            <div className="mb-6">
              <p className="mb-2 text-xs text-slate-500">
                Clique num posto no mapa (ou na tabela da aba Abastecimento) pra marcar/desmarcar como parada. Postos
                em cinza ainda não foram selecionados.
              </p>
              <MapaRotaLazy
                rota={resultado.coordenadas}
                onTogglePosto={alternarPosto}
                marcadores={[
                  { lat: origem.lat, lon: origem.lon, label: origem.label, cor: "verde" },
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
                    pedagio: true,
                    popup: [
                      praca.concessionaria,
                      praca.valorCarro != null ? `Carro: ${formatarMoeda(praca.valorCarro)}` : null,
                      praca.valorCaminhaoEixo != null
                        ? `Caminhão: ${formatarMoeda(praca.valorCaminhaoEixo)}/eixo`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  })),
                ]}
              />
            </div>
          )}

          {abaAtiva === "abastecimento" && (
            <div className="card overflow-x-auto p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Postos no corredor — sugestão inicial: {perfilAtual.nome}
                </h2>
                <p className="text-xs text-slate-500">Clique numa linha pra marcar/desmarcar como parada.</p>
              </div>
              {resultado.candidatos.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum posto candidato encontrado no corredor da rota.</p>
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
                    {candidatosOrdenados.map((c) => {
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
                            {/* Fase 27.140 — sinaliza quando o posto veio da
                                base pública ANP (preço estimado, não
                                negociado) em vez da rede própria do cliente. */}
                            {c.origem === "anp" && (
                              <span className="ml-1.5 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                Base ANP
                              </span>
                            )}
                            <p className="mt-0.5 text-xs font-normal text-slate-400">{formatCNPJ(c.cnpj)}</p>
                            {parada && (
                              <p className="mt-0.5 text-xs font-normal text-slate-400">
                                {MOTIVO_LABEL[parada.motivo] ?? parada.motivo}
                              </p>
                            )}
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
          )}

          {abaAtiva === "custo" && (
            <div className="card space-y-6 p-4">
              <ComparativoEstrategias comparativo={resultado.comparativoEstrategias} selecionada={perfilChave} />
              <GraficosRota
                paradas={paradasAtuais.paradas}
                distanciaKm={resultado.distanciaKm}
                origemLabel={origem.label}
                destinoLabel={destino.label}
                capacidadeTanqueL={capacidade}
                autonomiaKmPorL={autonomia}
              />
              <ComparativoPrecos
                custoTotal={custoTotalAtual}
                litrosTotal={litrosTotalAtual}
                precoMedioGf={resultado.precoMedioGf}
                precoReferenciaAnp={resultado.precoReferenciaAnp}
                ufReferencia={resultado.ufReferencia}
              />
            </div>
          )}

          {abaAtiva === "resumo" && (
            <div className="card space-y-6 p-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">📋 Resumo da Roteirização</p>
                <div className="space-y-1 text-sm">
                  <p className="border-l-2 border-emerald-600 pl-2">
                    <span className="font-medium text-emerald-700">🟢 Origem:</span> {origem.label}
                  </p>
                  {paradas
                    .filter((p) => p.lat !== 0 || p.lon !== 0)
                    .map((p, i) => (
                      <p key={i} className="border-l-2 border-amber-500 pl-2">
                        <span className="font-medium text-amber-600">🟠 Parada {i + 1}:</span> {p.label}
                      </p>
                    ))}
                  <p className="border-l-2 border-red-600 pl-2">
                    <span className="font-medium text-red-700">🔴 Destino:</span> {destino.label}
                  </p>
                </div>
                <div className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <p className="text-slate-500">
                    📏 Distância: <span className="font-medium text-slate-900">{resultado.distanciaKm} km</span>
                  </p>
                  <p className="text-slate-500">
                    ⏱️ Tempo:{" "}
                    <span className="font-medium text-slate-900">
                      {Math.floor(resultado.duracaoMin / 60)}h {String(Math.round(resultado.duracaoMin % 60)).padStart(2, "0")}min
                    </span>
                  </p>
                  <p className="text-slate-500">
                    ⛽ Combustível: <span className="font-medium text-slate-900">{combustivel || "—"}</span>
                  </p>
                  <p className="text-slate-500">
                    🚛 Placa: <span className="font-medium text-slate-900">{placa || "—"}</span>
                  </p>
                  <p className="text-slate-500">
                    🛢 Consumo total:{" "}
                    <span className="font-medium text-slate-900">
                      {autonomia ? (resultado.distanciaKm / autonomia).toFixed(0) : "—"} L
                    </span>
                  </p>
                  <p className="text-slate-500">
                    🛢 Total abastecido: <span className="font-medium text-slate-900">{litrosTotalAtual} L</span>
                  </p>
                  <p className="text-slate-500">
                    💰 Custo abastecimento:{" "}
                    <span className="font-medium text-slate-900">{formatarMoeda(custoTotalAtual)}</span>
                  </p>
                  <p className="text-slate-500">
                    ⛽ Paradas: <span className="font-medium text-slate-900">{paradasAtuais.paradas.length || "Nenhuma"}</span>
                  </p>
                  {resultado.pracasPedagio.length > 0 && (
                    <>
                      <p className="text-slate-500">
                        🎫 Pedágio estimado (carro):{" "}
                        <span className="font-medium text-slate-900">{formatarMoeda(resultado.custoPedagioEstimado)}</span>
                      </p>
                      <p className="text-slate-500">
                        💰 Total (combustível + pedágio):{" "}
                        <span className="font-medium text-slate-900">
                          {formatarMoeda(custoTotalAtual + resultado.custoPedagioEstimado)}
                        </span>
                      </p>
                    </>
                  )}
                </div>
              </div>

              {resultado.pracasPedagio.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-2 text-sm font-semibold text-slate-900">🎫 Praças de pedágio no trajeto</p>
                  <table className="w-full border-separate border-spacing-0 text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-1.5 pr-4">Praça</th>
                        <th className="whitespace-nowrap py-1.5 pr-4">Km</th>
                        <th className="whitespace-nowrap py-1.5 pr-4">Carro</th>
                        <th className="whitespace-nowrap py-1.5">Caminhão/eixo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {resultado.pracasPedagio.map((praca) => (
                        <tr key={praca.id}>
                          <td className="py-1.5 pr-4 text-slate-700">
                            {praca.nome}
                            {praca.concessionaria && <span className="text-slate-400"> — {praca.concessionaria}</span>}
                          </td>
                          <td className="py-1.5 pr-4 whitespace-nowrap text-slate-600">{praca.kmNaRota.toFixed(0)} km</td>
                          <td className="py-1.5 pr-4 whitespace-nowrap text-slate-600">
                            {praca.valorCarro != null ? formatarMoeda(praca.valorCarro) : "—"}
                          </td>
                          <td className="py-1.5 whitespace-nowrap text-slate-600">
                            {praca.valorCaminhaoEixo != null ? formatarMoeda(praca.valorCaminhaoEixo) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">Exportações</p>
                <p className="mb-3 text-xs text-slate-500">
                  📄 PDF para impressão · 🗺️ GPX para GPS/Waze · 📤 Card PNG para WhatsApp/e-mail · 🛡️
                  Rotograma de segurança para o motorista.
                </p>
                <div className="flex flex-wrap items-start gap-2">
                  <BotaoBaixarPdfRotaLazy
                    nomeArquivo={`rota_${origem.label.slice(0, 15).replace(/\s+/g, "_")}_${destino.label.slice(0, 15).replace(/\s+/g, "_")}.pdf`}
                    origemLabel={origem.label}
                    destinoLabel={destino.label}
                    placa={placa || undefined}
                    kpis={[
                      { label: "Distância", valor: `${resultado.distanciaKm} km` },
                      {
                        label: "Tempo estimado",
                        valor: `${Math.floor(resultado.duracaoMin / 60)}h ${String(Math.round(resultado.duracaoMin % 60)).padStart(2, "0")}min`,
                      },
                      { label: "Paradas selecionadas", valor: String(paradasAtuais.paradas.length) },
                      { label: "Custo total", valor: formatarMoeda(custoTotalAtual) },
                    ]}
                    comparativo={resultado.comparativoEstrategias.map((c) => ({
                      nome: `${c.icone} ${c.nome}`,
                      custo: formatarMoeda(c.custoTotal),
                      paradas: String(c.numParadas),
                      litros: `${c.litrosTotal} L`,
                      grade: c.gradeMedia,
                    }))}
                    paradas={paradasAtuais.paradas.map((p, i) => ({
                      numero: String(i + 1),
                      posto: p.label,
                      municipioUf: "—",
                      km: `${p.km.toFixed(0)} km`,
                      precoLitro: formatarMoeda(p.preco),
                      litros: `${p.litrosSugeridos} L`,
                      custo: formatarMoeda(p.custoAbastecimento),
                      nivelApos: `${p.pctApos.toFixed(0)}%`,
                    }))}
                  />
                  <BotaoExportarGpx
                    origem={origem}
                    destino={destino}
                    paradas={paradasAtuais.paradas}
                    coordenadas={resultado.coordenadas}
                    placa={placa || undefined}
                  />
                  <Link
                    href={`/rotograma/novo?prefill=${encodeURIComponent(
                      JSON.stringify({
                        origem: origem.label,
                        destino: destino.label,
                        placa: placa || undefined,
                        paradas: [
                          ...paradasAtuais.paradas.map((p) => ({
                            local: p.label,
                            categoria: "abastecimento",
                            descricao: [p.bandeira, `R$ ${p.preco.toFixed(3)}/L`].filter(Boolean).join(" · "),
                            km: Math.round(p.km * 10) / 10,
                          })),
                          ...resultado.pracasPedagio.map((praca) => ({
                            local: praca.nome,
                            categoria: "pedagio",
                            descricao: [
                              praca.concessionaria,
                              praca.valorCarro != null ? `R$ ${praca.valorCarro.toFixed(2)} (carro)` : null,
                            ]
                              .filter(Boolean)
                              .join(" · "),
                            km: Math.round(praca.kmNaRota * 10) / 10,
                          })),
                        ],
                      })
                    )}`}
                    className="btn-secondary"
                  >
                    🛡️ Gerar Rotograma
                  </Link>
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
                        // Fase Pré-Pedido (27/07/2026) — snapshot dos pontos de
                        // abastecimento sugeridos pelo otimizador, carregado até o
                        // Plano de Viagem pra virar o Pré-Pedido automaticamente
                        // (se a empresa tiver o parâmetro habilitado, ver
                        // planos-viagem/actions.ts). Não editável no formulário —
                        // só passa direto, igual aos pedágios sugeridos da rota.
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
                </div>
                <div className="mt-3">
                  <BotaoGerarCardPng
                    origemLabel={origem.label}
                    destinoLabel={destino.label}
                    placa={placa || undefined}
                    combustivel={combustivel || undefined}
                    distanciaKm={resultado.distanciaKm}
                    duracaoMin={resultado.duracaoMin}
                    custoTotal={custoTotalAtual}
                    paradas={paradasAtuais.paradas}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">Salvar esta rota</p>
                <SalvarConsultaForm
                  tipo="roteirizacao"
                  empresaId={empresaId}
                  dados={{
                    origem,
                    destino,
                    paradas,
                    placa,
                    capacidade,
                    autonomia,
                    combustivel,
                    combustivelInicial,
                    perfilChave,
                  }}
                  nomeSugerido={`${origem.label} → ${destino.label}`}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
