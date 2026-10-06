"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Power, X } from "lucide-react";
import { COMBUSTIVEIS_PDV, temaCombustivelPdv } from "@/lib/combustiveisPdv";
import { BombaIcone } from "@/components/pdv/BombaIcone";
import {
  criarBicoCatalogoAcao,
  alternarAtivoBicoCatalogoAcao,
  atualizarCombustivelBicoCatalogoAcao,
} from "../actions";

type Bico = {
  id: string;
  bomba: number;
  lado: string;
  posicao: number;
  numero_bico: number;
  codigo_combustivel: string;
  combustivel: string;
  preco_litro_base: number;
  ativo: boolean;
};

type NovoBico = { bomba: number; lado: string };

// Fase 4 PDV (02/10/2026) — catálogo fixo de bombas/bicos/combustíveis.
// 06/10/2026 (pedido do Daniel: "esta tela na visão do admin igual à do PDV") —
// redesenhada no mesmo formato da tela /bicos do pdv-fni: cada bomba é um
// painel com os lados A e B, cada bico um cartão com ícone, combustível e
// preço. A lógica é a mesma; só muda o acesso aos dados (Server Actions em vez
// de supabase-js direto no navegador, convenção deste painel). O posto gerencia
// o próprio catálogo no PDV; aqui o admin configura em nome de qualquer revenda.
export function CatalogoBicosPdv({ revendaEmpresaId, bicosIniciais }: { revendaEmpresaId: string; bicosIniciais: Bico[] }) {
  const [bicos, setBicos] = useState(bicosIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [novo, setNovo] = useState<NovoBico | null>(null);
  const [codigoNovo, setCodigoNovo] = useState<string>(COMBUSTIVEIS_PDV[0].codigo);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [combustivelEditado, setCombustivelEditado] = useState<string>(COMBUSTIVEIS_PDV[0].codigo);
  const [precoEditado, setPrecoEditado] = useState("");

  // As Server Actions revalidam a rota: a lista nova chega por prop.
  useEffect(() => {
    setBicos(bicosIniciais);
  }, [bicosIniciais]);

  function adicionar() {
    if (!novo) return;
    setErro(null);
    const combustivel = COMBUSTIVEIS_PDV.find((c) => c.codigo === codigoNovo)!;
    const proximoNumero = (bicos.reduce((max, b) => Math.max(max, b.numero_bico), 0) || 0) + 1;
    const proximaPosicao =
      bicos.filter((b) => b.bomba === novo.bomba && b.lado === novo.lado).reduce((max, b) => Math.max(max, b.posicao), 0) + 1;
    const alvo = novo;
    startTransition(async () => {
      const resultado = await criarBicoCatalogoAcao(revendaEmpresaId, {
        bomba: alvo.bomba,
        lado: alvo.lado,
        posicao: proximaPosicao,
        numeroBico: proximoNumero,
        codigoCombustivel: combustivel.codigo,
        combustivel: combustivel.nome,
        precoLitroBase: combustivel.precoBase,
      });
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      setNovo(null);
    });
  }

  function alternarAtivo(b: Bico) {
    setBicos((atual) => atual.map((x) => (x.id === b.id ? { ...x, ativo: !x.ativo } : x)));
    startTransition(async () => {
      const resultado = await alternarAtivoBicoCatalogoAcao(b.id, !b.ativo);
      if (resultado?.erro) {
        setBicos((atual) => atual.map((x) => (x.id === b.id ? { ...x, ativo: b.ativo } : x)));
        setErro(resultado.erro);
      }
    });
  }

  function iniciarEdicao(b: Bico) {
    setErro(null);
    setEditandoId(b.id);
    setCombustivelEditado(b.codigo_combustivel);
    setPrecoEditado(String(b.preco_litro_base));
  }

  // Trocar o combustível já sugere o preço base dele — dá pra ajustar antes de salvar.
  function alterarCombustivelEditado(codigo: string) {
    setCombustivelEditado(codigo);
    const combustivel = COMBUSTIVEIS_PDV.find((c) => c.codigo === codigo);
    if (combustivel) setPrecoEditado(String(combustivel.precoBase));
  }

  function salvarEdicao(b: Bico) {
    const novoPreco = Number(precoEditado.replace(",", "."));
    if (!Number.isFinite(novoPreco) || novoPreco <= 0) {
      setErro("Preço inválido.");
      return;
    }
    const combustivel = COMBUSTIVEIS_PDV.find((c) => c.codigo === combustivelEditado)!;
    setEditandoId(null);
    startTransition(async () => {
      const resultado = await atualizarCombustivelBicoCatalogoAcao(b.id, combustivel.codigo, combustivel.nome, novoPreco);
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      setBicos((atual) =>
        atual.map((x) =>
          x.id === b.id
            ? { ...x, codigo_combustivel: combustivel.codigo, combustivel: combustivel.nome, preco_litro_base: novoPreco }
            : x
        )
      );
    });
  }

  // bomba -> lado -> bicos
  const bombas = useMemo(() => {
    const mapa = new Map<number, { A: Bico[]; B: Bico[]; outros: Bico[] }>();
    for (const b of bicos) {
      if (!mapa.has(b.bomba)) mapa.set(b.bomba, { A: [], B: [], outros: [] });
      const grupo = mapa.get(b.bomba)!;
      if (b.lado === "A") grupo.A.push(b);
      else if (b.lado === "B") grupo.B.push(b);
      else grupo.outros.push(b);
    }
    for (const g of mapa.values()) {
      g.A.sort((x, y) => x.numero_bico - y.numero_bico);
      g.B.sort((x, y) => x.numero_bico - y.numero_bico);
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0] - b[0]);
  }, [bicos]);

  const proximaBomba = (bicos.reduce((max, b) => Math.max(max, b.bomba), 0) || 0) + 1;

  function abrirNovo(alvo: NovoBico) {
    setErro(null);
    setCodigoNovo(COMBUSTIVEIS_PDV[0].codigo);
    setNovo(alvo);
  }

  // FormularioNovo/CartaoBico/Lado são chamados como funções (não <X />) de
  // propósito: definidos dentro do componente, virariam um tipo novo a cada
  // render e os campos perderiam o foco a cada tecla (mesmo cuidado do PDV).
  function FormularioNovo({ alvo }: { alvo: NovoBico }) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-accento/60 bg-accento/5 p-3">
        <p className="mb-2 text-xs font-semibold text-accento">
          Novo bico — Bomba {String(alvo.bomba).padStart(2, "0")} · Lado {alvo.lado}
        </p>
        <select className="input mb-2 text-sm" value={codigoNovo} onChange={(e) => setCodigoNovo(e.target.value)}>
          {COMBUSTIVEIS_PDV.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.codigo} — {c.nome}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={adicionar} disabled={isPending} className="btn-primary flex flex-1 items-center justify-center gap-1">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Adicionar
          </button>
          <button type="button" onClick={() => setNovo(null)} className="btn-secondary px-3" aria-label="Cancelar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  function CartaoBico({ b }: { b: Bico }) {
    const tema = temaCombustivelPdv(b.codigo_combustivel);
    const editando = editandoId === b.id;
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border-2 bg-white p-3 pt-4 text-center dark:bg-slate-800 ${
          b.ativo ? tema.borda : "border-slate-200 opacity-60 dark:border-slate-700"
        }`}
      >
        <span className={`absolute inset-x-0 top-0 h-1.5 ${b.ativo ? tema.faixa : "bg-slate-300 dark:bg-slate-600"}`} />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Posição {b.posicao}</p>
        <BombaIcone
          numero={String(b.numero_bico).padStart(2, "0")}
          className={`mx-auto my-1 h-14 w-14 ${b.ativo ? tema.icone : "text-slate-400"}`}
        />

        {editando ? (
          <div className="space-y-2 text-left">
            <select
              autoFocus
              className="input py-1 text-sm"
              value={combustivelEditado}
              onChange={(e) => alterarCombustivelEditado(e.target.value)}
            >
              {COMBUSTIVEIS_PDV.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.codigo} — {c.nome}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">R$</span>
              <input className="input py-1 text-sm" value={precoEditado} onChange={(e) => setPrecoEditado(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => salvarEdicao(b)} className="btn-primary flex flex-1 items-center justify-center py-1.5" aria-label="Salvar">
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditandoId(null)}
                className="btn-secondary flex flex-1 items-center justify-center py-1.5"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">{b.combustivel}</p>
            <p className="mt-1 text-base font-extrabold text-frota-900 dark:text-white">
              R$ {b.preco_litro_base.toFixed(3)}
              <span className="text-[11px] font-medium text-slate-400">/L</span>
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => iniciarEdicao(b)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-accento dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Pencil className="h-3 w-3" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => alternarAtivo(b)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                  b.ativo
                    ? "text-status-ativo hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
                title={b.ativo ? "Desativar bico" : "Ativar bico"}
              >
                <Power className="h-3 w-3" />
                {b.ativo ? "Ativo" : "Inativo"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  function Lado({ numBomba, lado, lista }: { numBomba: number; lado: string; lista: Bico[] }) {
    const adicionando = novo?.bomba === numBomba && novo.lado === lado;
    return (
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Lado {lado}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {lista.map((b) => (
            <div key={b.id}>{CartaoBico({ b })}</div>
          ))}
          {adicionando ? (
            FormularioNovo({ alvo: { bomba: numBomba, lado } })
          ) : (
            <button
              type="button"
              onClick={() => abrirNovo({ bomba: numBomba, lado })}
              className="flex min-h-[10rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-400 transition hover:border-accento hover:bg-accento/5 hover:text-accento dark:border-slate-600"
            >
              <Plus className="h-5 w-5" />
              Adicionar bico
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cada bico fica fixo num combustível — é esse catálogo que alimenta a seleção da pista.
        </p>
        <button type="button" onClick={() => abrirNovo({ bomba: proximaBomba, lado: "A" })} className="btn-primary flex items-center gap-1.5">
          <Plus className="h-4 w-4" />
          Nova bomba
        </button>
      </div>

      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-status-inativo dark:bg-red-950/40">{erro}</p>}

      <div className="space-y-6">
        {/* Nova bomba ainda sem bicos */}
        {novo && novo.bomba === proximaBomba && (
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-frota-700 dark:text-slate-300">
              Bomba {String(novo.bomba).padStart(2, "0")} (nova)
            </h2>
            <div className="max-w-xs">{FormularioNovo({ alvo: novo })}</div>
          </div>
        )}

        {bombas.length === 0 && !novo && (
          <p className="card p-8 text-center text-sm text-slate-400">Nenhum bico cadastrado ainda. Clique em &quot;Nova bomba&quot;.</p>
        )}

        {bombas.map(([numBomba, grupo]) => (
          <section key={numBomba} className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-frota-700 dark:text-slate-300">
              Bomba {String(numBomba).padStart(2, "0")}
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs font-medium normal-case tracking-normal text-slate-400">
                {grupo.A.length + grupo.B.length + grupo.outros.length} bicos
              </span>
            </h2>
            <div className="grid gap-5 lg:grid-cols-2">
              {Lado({ numBomba, lado: "A", lista: grupo.A })}
              {Lado({ numBomba, lado: "B", lista: grupo.B })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
