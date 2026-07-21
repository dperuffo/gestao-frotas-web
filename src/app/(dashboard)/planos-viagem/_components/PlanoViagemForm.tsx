"use client";

import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  criarPlanoViagem,
  atualizarPlanoViagem,
  revisarCombustivelRealAcao,
  buscarPracasPedagioPorNomeAcao,
  sugerirPedagiosDaRotaAcao,
  type SugestaoPedagio,
} from "../actions";
import { STATUS_PLANO_VIAGEM, STATUS_PLANO_VIAGEM_LABEL } from "@/lib/constants";
import { formatarMoeda } from "@/lib/financeiro";
import type { Database } from "@/types/database.types";

type PlanoViagem = Database["public"]["Tables"]["planos_viagem"]["Row"];
type Pedagio = { praca_nome: string; valor: number };

export type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null; autonomia: number | null };
export type MotoristaOpcao = { id: string; nome_completo: string };
export type RotogramaOpcao = { id: string; numero: number; origem: string | null; destino: string | null };
export type RotaSalvaOpcao = { id: string; nome: string };
export type CentroCustoOpcao = { id: string; nome: string };

// Fase 27.48 — formulário de Plano de Viagem, usado tanto em /novo quanto em
// /[id]/editar. Os campos "calculado" (custo de combustível, diárias,
// manutenção, total e margem) são recomputados ao vivo no client conforme o
// usuário digita — só pra feedback visual imediato; o valor que efetivamente
// grava vem recalculado de novo no servidor (actions.ts), nunca confiamos só
// no que chegou daqui.
export function PlanoViagemForm({
  empresaId,
  plano,
  pedagiosIniciais,
  veiculos,
  motoristas,
  rotogramas,
  rotasSalvas,
  centrosCusto,
}: {
  empresaId: string;
  plano?: PlanoViagem;
  pedagiosIniciais?: Pedagio[];
  veiculos: VeiculoOpcao[];
  motoristas: MotoristaOpcao[];
  rotogramas: RotogramaOpcao[];
  rotasSalvas: RotaSalvaOpcao[];
  centrosCusto: CentroCustoOpcao[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const [placa, setPlaca] = useState(plano?.placa ?? "");
  const [kmEstimado, setKmEstimado] = useState(plano?.km_estimado ?? 0);
  const [consumoKmL, setConsumoKmL] = useState(plano?.consumo_km_l ?? 0);
  const [precoCombustivel, setPrecoCombustivel] = useState(plano?.preco_combustivel ?? 0);
  const [pedagios, setPedagios] = useState<Pedagio[]>(pedagiosIniciais ?? []);
  const [rotaSalvaId, setRotaSalvaId] = useState(plano?.rota_salva_id ?? "");
  // Fase Pedágios — autocomplete do campo "Nome da praça" (busca na base
  // real pracas_pedagio em vez de texto 100% livre) e sugestão automática a
  // partir da Rota salva vinculada.
  const [linhaComSugestoes, setLinhaComSugestoes] = useState<number | null>(null);
  const [sugestoesPraca, setSugestoesPraca] = useState<SugestaoPedagio[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sugerindoDaRota, setSugerindoDaRota] = useState(false);
  const [erroSugestaoRota, setErroSugestaoRota] = useState<string | undefined>();
  const [nDiarias, setNDiarias] = useState(plano?.n_diarias ?? 0);
  const [valorRefeicao, setValorRefeicao] = useState(plano?.valor_refeicao_dia ?? 0);
  const [valorPernoite, setValorPernoite] = useState(plano?.valor_pernoite_dia ?? 0);
  const [valorBanho, setValorBanho] = useState(plano?.valor_banho_dia ?? 0);
  const [valorLavagem, setValorLavagem] = useState(plano?.valor_lavagem_dia ?? 0);
  const [custoManutencaoKm, setCustoManutencaoKm] = useState(plano?.custo_manutencao_km ?? 0);
  const [receitaViagem, setReceitaViagem] = useState(plano?.receita_viagem ?? 0);
  const [custoTotalReal, setCustoTotalReal] = useState<string>(
    plano?.custo_total_real != null ? String(plano.custo_total_real) : ""
  );

  const [combustivelRealLitros, setCombustivelRealLitros] = useState(plano?.combustivel_real_litros ?? null);
  const [combustivelRealValor, setCombustivelRealValor] = useState(plano?.custo_combustivel_real ?? null);
  const [revisandoCombustivel, setRevisandoCombustivel] = useState(false);
  const [erroRevisao, setErroRevisao] = useState<string | undefined>();

  const custoCombustivelEstimado = consumoKmL > 0 ? (kmEstimado / consumoKmL) * precoCombustivel : 0;
  const pedagiosTotal = pedagios.reduce((soma, p) => soma + (p.valor || 0), 0);
  const custoDiarias = nDiarias * (valorRefeicao + valorPernoite + valorBanho + valorLavagem);
  const custoManutencaoEstimado = kmEstimado * custoManutencaoKm;
  const custoTotalEstimado = custoCombustivelEstimado + pedagiosTotal + custoDiarias + custoManutencaoEstimado;

  const custoTotalRealNum = custoTotalReal.trim() ? Number(custoTotalReal) : null;
  const lucroEstimado = receitaViagem - custoTotalEstimado;
  const lucroReal = custoTotalRealNum != null ? receitaViagem - custoTotalRealNum : null;

  const veiculoSelecionado = useMemo(() => veiculos.find((v) => v.placa === placa), [veiculos, placa]);

  function handlePlacaChange(novaPlaca: string) {
    setPlaca(novaPlaca);
    // Autocompleta o consumo (km/L) com a autonomia cadastrada do veículo —
    // só se o campo ainda estiver zerado, pra não sobrescrever um valor que
    // o usuário já tenha ajustado na mão.
    const veiculo = veiculos.find((v) => v.placa === novaPlaca);
    if (veiculo?.autonomia && consumoKmL === 0) {
      setConsumoKmL(veiculo.autonomia);
    }
  }

  function adicionarPedagio() {
    setPedagios((atual) => [...atual, { praca_nome: "", valor: 0 }]);
  }

  function removerPedagio(indice: number) {
    setPedagios((atual) => atual.filter((_, i) => i !== indice));
  }

  function atualizarPedagio(indice: number, campo: keyof Pedagio, valor: string) {
    setPedagios((atual) =>
      atual.map((p, i) => (i === indice ? { ...p, [campo]: campo === "valor" ? Number(valor) || 0 : valor } : p))
    );
  }

  // Autocomplete do nome da praça — busca na base real com debounce (evita
  // 1 consulta por tecla digitada). Continua sendo texto livre: quem não
  // achar a praça na base pode digitar o nome na mão do mesmo jeito de
  // antes, só não tem o valor pré-preenchido.
  function handlePracaNomeChange(indice: number, valor: string) {
    atualizarPedagio(indice, "praca_nome", valor);
    setLinhaComSugestoes(indice);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (valor.trim().length < 2) {
      setSugestoesPraca([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const resultado = await buscarPracasPedagioPorNomeAcao(valor);
      setSugestoesPraca(resultado);
    }, 300);
  }

  function selecionarSugestaoPraca(indice: number, sugestao: SugestaoPedagio) {
    setPedagios((atual) =>
      atual.map((p, i) => (i === indice ? { praca_nome: sugestao.nome, valor: sugestao.valorCarro ?? p.valor } : p))
    );
    setLinhaComSugestoes(null);
    setSugestoesPraca([]);
  }

  // Sugere as praças de pedágio no corredor da Rota salva vinculada —
  // recalcula a rota (OSRM) e busca na base pracas_pedagio, igual ao mapa da
  // Roteirização. Só ACRESCENTA praças que ainda não estão na lista (por
  // nome) — não sobrescreve o que o usuário já ajustou manualmente.
  function sugerirDaRota() {
    if (!rotaSalvaId) return;
    setErroSugestaoRota(undefined);
    setSugerindoDaRota(true);
    startTransition(async () => {
      const resultado = await sugerirPedagiosDaRotaAcao(rotaSalvaId);
      setSugerindoDaRota(false);
      if (resultado.erro) {
        setErroSugestaoRota(resultado.erro);
        return;
      }
      const jaExistentes = new Set(pedagios.map((p) => p.praca_nome.trim().toLowerCase()));
      const novas = (resultado.sugestoes ?? []).filter((s) => !jaExistentes.has(s.pracaNome.trim().toLowerCase()));
      if (novas.length === 0) {
        setErroSugestaoRota("Nenhuma praça de pedágio nova encontrada no corredor dessa rota.");
        return;
      }
      setPedagios((atual) => [...atual, ...novas.map((s) => ({ praca_nome: s.pracaNome, valor: s.valor }))]);
    });
  }

  function handleRevisarCombustivel() {
    if (!plano) return;
    setErroRevisao(undefined);
    setRevisandoCombustivel(true);
    startTransition(async () => {
      const resultado = await revisarCombustivelRealAcao(plano.id);
      setRevisandoCombustivel(false);
      if (resultado.erro) {
        setErroRevisao(resultado.erro);
        return;
      }
      setCombustivelRealLitros(resultado.litros ?? 0);
      setCombustivelRealValor(resultado.valor ?? 0);
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    formData.set("pedagios_json", JSON.stringify(pedagios.filter((p) => p.praca_nome.trim())));

    startTransition(async () => {
      const resultado = plano
        ? await atualizarPlanoViagem(plano.id, undefined, formData)
        : await criarPlanoViagem(empresaId, undefined, formData);
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      if (plano) router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Identificação</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nome do Plano" required className="sm:col-span-2">
            <input
              name="nome"
              required
              defaultValue={plano?.nome}
              placeholder="Ex: SP → Curitiba — Abril/2026"
              className="input"
            />
          </Campo>
          <Campo label="Status">
            <select name="status" defaultValue={plano?.status ?? "rascunho"} className="input">
              {STATUS_PLANO_VIAGEM.map((s) => (
                <option key={s} value={s}>
                  {STATUS_PLANO_VIAGEM_LABEL[s]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Veículo (placa)">
            <select
              name="placa"
              value={placa}
              onChange={(e) => handlePlacaChange(e.target.value)}
              className="input"
            >
              <option value="">— Selecione —</option>
              {veiculos.map((v) => (
                <option key={v.placa} value={v.placa}>
                  {v.placa} {v.marca ? `— ${v.marca} ${v.modelo ?? ""}`.trim() : ""}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Motorista">
            <select name="motorista_id" defaultValue={plano?.motorista_id ?? ""} className="input">
              <option value="">— Selecione —</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome_completo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Rotograma (opcional)">
            <select name="rotograma_id" defaultValue={plano?.rotograma_id ?? ""} className="input">
              <option value="">— Nenhum —</option>
              {rotogramas.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.numero} {r.origem ?? "?"} → {r.destino ?? "?"}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Rota salva (Roteirização, opcional)">
            <select
              name="rota_salva_id"
              value={rotaSalvaId}
              onChange={(e) => setRotaSalvaId(e.target.value)}
              className="input"
            >
              <option value="">— Nenhuma —</option>
              {rotasSalvas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Data de Saída">
            <input type="date" name="data_saida" defaultValue={plano?.data_saida ?? ""} className="input" />
          </Campo>
          <Campo label="Retorno Previsto">
            <input
              type="date"
              name="retorno_previsto"
              defaultValue={plano?.retorno_previsto ?? ""}
              className="input"
            />
          </Campo>
          <Campo label="KM Estimado">
            <input
              type="number"
              min={0}
              step="1"
              name="km_estimado"
              value={kmEstimado}
              onChange={(e) => setKmEstimado(Number(e.target.value) || 0)}
              className="input"
            />
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Combustível</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Consumo (km/L)">
            <input
              type="number"
              min={0}
              step="0.1"
              name="consumo_km_l"
              value={consumoKmL}
              onChange={(e) => setConsumoKmL(Number(e.target.value) || 0)}
              className="input"
            />
          </Campo>
          <Campo label="Preço (R$/L)">
            <input
              type="number"
              min={0}
              step="0.001"
              name="preco_combustivel"
              value={precoCombustivel}
              onChange={(e) => setPrecoCombustivel(Number(e.target.value) || 0)}
              className="input"
            />
          </Campo>
          <Campo label="Custo combustível estimado">
            <div className="input flex items-center bg-slate-50 font-medium text-slate-700">
              {formatarMoeda(custoCombustivelEstimado)}
            </div>
          </Campo>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Combustível real (do Controle de Custos)
              </p>
              {combustivelRealValor != null ? (
                <p className="mt-1 text-sm text-slate-700">
                  {formatarMoeda(combustivelRealValor)} — {combustivelRealLitros?.toLocaleString("pt-BR")} L
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-400">
                  {plano ? "Ainda não revisado." : "Disponível depois de salvar o plano."}
                </p>
              )}
            </div>
            {plano && (
              <button
                type="button"
                onClick={handleRevisarCombustivel}
                disabled={revisandoCombustivel}
                className="btn-secondary text-sm"
              >
                {revisandoCombustivel ? "Revisando..." : "Revisar"}
              </button>
            )}
          </div>
          {erroRevisao && <p className="mt-2 text-xs text-red-600">{erroRevisao}</p>}
        </div>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Pedágios</h2>
          <div className="flex items-center gap-2">
            {rotaSalvaId && (
              <button
                type="button"
                onClick={sugerirDaRota}
                disabled={sugerindoDaRota}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {sugerindoDaRota ? "Buscando..." : "🎫 Sugerir da rota"}
              </button>
            )}
            <button type="button" onClick={adicionarPedagio} className="btn-secondary text-sm">
              + Praça
            </button>
          </div>
        </div>
        {erroSugestaoRota && <p className="mb-3 text-xs text-amber-700">{erroSugestaoRota}</p>}

        {pedagios.length === 0 ? (
          <p className="text-sm italic text-slate-400">
            Nenhuma praça de pedágio adicionada. Digite o nome pra buscar na base real, use &quot;Sugerir da
            rota&quot; (se houver Rota salva vinculada) ou clique em &quot;+ Praça&quot; pra adicionar manualmente.
          </p>
        ) : (
          <div className="space-y-3">
            {pedagios.map((p, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
                  <div className="relative">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Nome da praça</label>
                    <input
                      type="text"
                      placeholder="Buscar na base de pedágios..."
                      value={p.praca_nome}
                      onChange={(e) => handlePracaNomeChange(i, e.target.value)}
                      onFocus={() => setLinhaComSugestoes(i)}
                      onBlur={() => setTimeout(() => setLinhaComSugestoes(null), 150)}
                      autoComplete="off"
                      className="input w-full"
                    />
                    {linhaComSugestoes === i && sugestoesPraca.length > 0 && (
                      <ul className="absolute top-full left-0 z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {sugestoesPraca.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onMouseDown={() => selecionarSugestaoPraca(i, s)}
                              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              <span className="font-medium text-slate-800">
                                {s.nome} {s.uf ? `— ${s.uf}` : ""}
                              </span>
                              <span className="text-xs text-slate-500">
                                {s.concessionaria ?? "—"}
                                {s.valorCarro != null ? ` · carro ${formatarMoeda(s.valorCarro)}` : ""}
                                {s.valorCaminhaoEixo != null
                                  ? ` · caminhão ${formatarMoeda(s.valorCaminhaoEixo)}/eixo`
                                  : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Valor (R$)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0,00"
                      value={p.valor}
                      onChange={(e) => atualizarPedagio(i, "valor", e.target.value)}
                      className="input w-full"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removerPedagio(i)}
                    className="text-sm text-red-600 hover:underline sm:pb-2.5"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-right text-sm text-slate-600">
          Total Pedágios: <strong className="text-slate-900">{formatarMoeda(pedagiosTotal)}</strong>
        </p>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Diárias / Pernoites</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Nº de diárias">
            <input
              type="number"
              min={0}
              step="1"
              name="n_diarias"
              value={nDiarias}
              onChange={(e) => setNDiarias(Number(e.target.value) || 0)}
              className="input"
            />
          </Campo>
          <Campo label="Refeição (R$/dia)">
            <input
              type="number"
              min={0}
              step="0.01"
              name="valor_refeicao_dia"
              value={valorRefeicao}
              onChange={(e) => setValorRefeicao(Number(e.target.value) || 0)}
              className="input"
            />
          </Campo>
          <Campo label="Pernoite (R$/dia)">
            <input
              type="number"
              min={0}
              step="0.01"
              name="valor_pernoite_dia"
              value={valorPernoite}
              onChange={(e) => setValorPernoite(Number(e.target.value) || 0)}
              className="input"
            />
          </Campo>
          <Campo label="Banho (R$/dia)">
            <input
              type="number"
              min={0}
              step="0.01"
              name="valor_banho_dia"
              value={valorBanho}
              onChange={(e) => setValorBanho(Number(e.target.value) || 0)}
              className="input"
            />
          </Campo>
          <Campo label="Lavagem de roupas (R$/dia)">
            <input
              type="number"
              min={0}
              step="0.01"
              name="valor_lavagem_dia"
              value={valorLavagem}
              onChange={(e) => setValorLavagem(Number(e.target.value) || 0)}
              className="input"
            />
          </Campo>
          <Campo label="Custo diárias">
            <div className="input flex items-center bg-slate-50 font-medium text-slate-700">
              {formatarMoeda(custoDiarias)}
            </div>
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Manutenção + Pneus</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Custo por km (R$/km)">
            <input
              type="number"
              min={0}
              step="0.001"
              name="custo_manutencao_km"
              value={custoManutencaoKm}
              onChange={(e) => setCustoManutencaoKm(Number(e.target.value) || 0)}
              className="input"
            />
          </Campo>
          <Campo label="Custo manutenção">
            <div className="input flex items-center bg-slate-50 font-medium text-slate-700">
              {formatarMoeda(custoManutencaoEstimado)}
            </div>
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Receita e Totais</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Receita da viagem (R$)">
            <input
              type="number"
              min={0}
              step="0.01"
              name="receita_viagem"
              value={receitaViagem}
              onChange={(e) => setReceitaViagem(Number(e.target.value) || 0)}
              className="input"
            />
          </Campo>
          <Campo label="Custo total estimado">
            <div className="input flex items-center bg-slate-50 font-medium text-slate-700">
              {formatarMoeda(custoTotalEstimado)}
            </div>
          </Campo>
          <Campo label="Custo total real (R$)">
            <input
              type="number"
              min={0}
              step="0.01"
              name="custo_total_real"
              value={custoTotalReal}
              onChange={(e) => setCustoTotalReal(e.target.value)}
              placeholder="Preencher após a viagem"
              className="input"
            />
          </Campo>
          <Campo label="Margem estimada (receita − custo estimado)">
            <div
              className={`input flex items-center bg-slate-50 font-semibold ${
                lucroEstimado >= 0 ? "text-green-700" : "text-red-600"
              }`}
            >
              {formatarMoeda(lucroEstimado)}
            </div>
          </Campo>
          {lucroReal != null && (
            <Campo label="Margem real (receita − custo real)">
              <div
                className={`input flex items-center bg-slate-50 font-semibold ${
                  lucroReal >= 0 ? "text-green-700" : "text-red-600"
                }`}
              >
                {formatarMoeda(lucroReal)}
              </div>
            </Campo>
          )}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Centro de Custo</h2>
        <Campo label="Centro de Custo (opcional)">
          <select name="centro_custo_id" defaultValue={plano?.centro_custo_id ?? ""} className="input max-w-sm">
            <option value="">— Nenhum (sem lançamento automático) —</option>
            {centrosCusto.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Observações" className="mt-4">
          <textarea name="observacoes" defaultValue={plano?.observacoes ?? ""} rows={3} className="input" />
        </Campo>
      </section>

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Salvar Plano"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
