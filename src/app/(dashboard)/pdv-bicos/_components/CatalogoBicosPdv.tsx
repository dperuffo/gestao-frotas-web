"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { Fuel, Plus, Loader2, Pencil, Check, X } from "lucide-react";
import { COMBUSTIVEIS_PDV } from "@/lib/combustiveisPdv";
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

// Fase 4 PDV (02/10/2026, pedido do Daniel: "montar tela de configuração
// de bombas, bicos e combustíveis na visão do posto e admin") — mesma
// UI/lógica da tela equivalente em pdv-fni (src/app/(pdv)/bicos/page.tsx),
// adaptada pra Server Actions em vez de supabase-js direto no client (
// convenção deste painel, ver ListaFormasPagamentoPdv.tsx). Quem acessa
// aqui é o admin (perfil "admin", bypass de RLS já coberto pela policy de
// pdv_bicos_catalogo); o posto gerencia o próprio catálogo direto no
// pdv-fni.
export function CatalogoBicosPdv({ revendaEmpresaId, bicosIniciais }: { revendaEmpresaId: string; bicosIniciais: Bico[] }) {
  const [bicos, setBicos] = useState(bicosIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [bomba, setBomba] = useState("1");
  const [lado, setLado] = useState("A");
  const [posicao, setPosicao] = useState("1");
  const [codigoCombustivel, setCodigoCombustivel] = useState<string>(COMBUSTIVEIS_PDV[0].codigo);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [combustivelEditado, setCombustivelEditado] = useState<string>(COMBUSTIVEIS_PDV[0].codigo);
  const [precoEditado, setPrecoEditado] = useState("");

  function adicionar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const combustivel = COMBUSTIVEIS_PDV.find((c) => c.codigo === codigoCombustivel)!;
    const proximoNumero = (bicos.reduce((max, b) => Math.max(max, b.numero_bico), 0) || 0) + 1;
    startTransition(async () => {
      const resultado = await criarBicoCatalogoAcao(revendaEmpresaId, {
        bomba: Number(bomba),
        lado,
        posicao: Number(posicao),
        numeroBico: proximoNumero,
        codigoCombustivel: combustivel.codigo,
        combustivel: combustivel.nome,
        precoLitroBase: combustivel.precoBase,
      });
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      setBicos((atual) => [
        ...atual,
        {
          id: `temp-${Date.now()}`,
          bomba: Number(bomba),
          lado,
          posicao: Number(posicao),
          numero_bico: proximoNumero,
          codigo_combustivel: combustivel.codigo,
          combustivel: combustivel.nome,
          preco_litro_base: combustivel.precoBase,
          ativo: true,
        },
      ]);
      setPosicao((p) => String(Number(p) + 1));
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

  // Trocar o combustível no select já sugere o preço base dele — ainda dá
  // pra ajustar o valor antes de salvar.
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

  const grupos = useMemo(() => {
    const porBomba = new Map<number, Bico[]>();
    for (const b of bicos) {
      if (!porBomba.has(b.bomba)) porBomba.set(b.bomba, []);
      porBomba.get(b.bomba)!.push(b);
    }
    return Array.from(porBomba.entries())
      .map(([numBomba, lista]) => [numBomba, lista.sort((a, c) => a.numero_bico - c.numero_bico)] as const)
      .sort((a, b) => a[0] - b[0]);
  }, [bicos]);

  return (
    <div className="space-y-4">
      <form onSubmit={adicionar} className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Bomba</label>
          <input
            type="number"
            min={1}
            className="input"
            value={bomba}
            onChange={(e) => setBomba(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Lado</label>
          <select className="input" value={lado} onChange={(e) => setLado(e.target.value)}>
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Posição</label>
          <input
            type="number"
            min={1}
            className="input"
            value={posicao}
            onChange={(e) => setPosicao(e.target.value)}
            required
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Combustível</label>
          <select className="input" value={codigoCombustivel} onChange={(e) => setCodigoCombustivel(e.target.value)}>
            {COMBUSTIVEIS_PDV.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.codigo} — {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <button type="submit" disabled={isPending} className="btn-primary flex w-full items-center justify-center gap-1.5">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </button>
        </div>
      </form>

      {erro && <p className="text-sm text-status-inativo">{erro}</p>}

      {grupos.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum bico cadastrado ainda.</p>
      ) : (
        <div className="space-y-4">
          {grupos.map(([numBomba, bicosDaBomba]) => (
            <div key={numBomba}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Bomba {numBomba}
              </p>
              <div className="card divide-y divide-slate-200 dark:divide-slate-700">
                {bicosDaBomba.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-frota-100 text-[11px] font-bold leading-tight text-frota-700 dark:bg-slate-700 dark:text-slate-200">
                        <span>{String(b.numero_bico).padStart(2, "0")}</span>
                        <span className="text-[10px] font-semibold">{b.codigo_combustivel}</span>
                      </div>
                      {editandoId === b.id ? (
                        <div>
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
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            Lado {b.lado} · Posição {b.posicao}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            <Fuel className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                            {b.combustivel}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Lado {b.lado} · Posição {b.posicao}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editandoId === b.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">R$</span>
                          <input
                            className="input w-20 py-1 text-sm"
                            value={precoEditado}
                            onChange={(e) => setPrecoEditado(e.target.value)}
                          />
                          <button
                            onClick={() => salvarEdicao(b)}
                            className="rounded-lg p-1.5 text-status-ativo hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            aria-label="Salvar"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditandoId(null)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                            aria-label="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => iniciarEdicao(b)}
                          className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-frota-600 dark:text-slate-300"
                        >
                          R$ {b.preco_litro_base.toFixed(3)}
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => alternarAtivo(b)} className={b.ativo ? "badge-ativo" : "badge-inativo"}>
                        {b.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
