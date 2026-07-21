"use client";

import { useState } from "react";
import { UFS } from "@/lib/constants";

// Fase 27.141 — pedido do Daniel (mockup em anexo "Configuração de Envio de
// Nota Personalizado por Estado"): quando o cliente escolhe "Personalizado
// CNPJ por Estado" como local de destino da NF, abre esta tela pra ele
// escolher um CNPJ padrão +, opcionalmente, exceções por UF (um grupo de
// estados apontando pra um CNPJ diferente do padrão). O resultado
// (cnpjPadrao + lista achatada de {uf, cnpj}) volta pro form principal via
// onConfirmar — quem grava de fato é criarParametroNF (actions.ts), que
// insere 1 linha por UF em parametros_nota_fiscal_destino_uf.
export type GrupoExcecaoUf = { ufs: string[]; cnpj: string };
export type ExcecaoUfPlano = { cnpjPadrao: string; grupos: GrupoExcecaoUf[] };

export function ModalDestinoEstado({
  aberto,
  onFechar,
  cnpjsFrota,
  valorInicial,
  onConfirmar,
}: {
  aberto: boolean;
  onFechar: () => void;
  cnpjsFrota: string[];
  valorInicial: ExcecaoUfPlano | null;
  onConfirmar: (plano: ExcecaoUfPlano) => void;
}) {
  const [cnpjPadrao, setCnpjPadrao] = useState(valorInicial?.cnpjPadrao ?? "");
  const [adicionarExcecoes, setAdicionarExcecoes] = useState((valorInicial?.grupos.length ?? 0) > 0);
  const [grupos, setGrupos] = useState<GrupoExcecaoUf[]>(valorInicial?.grupos ?? []);
  const [ufsSelecionadas, setUfsSelecionadas] = useState<Set<string>>(new Set());
  const [cnpjGrupoAtual, setCnpjGrupoAtual] = useState("");
  const [erro, setErro] = useState<string | undefined>();

  if (!aberto) return null;

  const ufsJaUsadas = new Set(grupos.flatMap((g) => g.ufs));

  function alternarUf(uf: string) {
    setUfsSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(uf)) novo.delete(uf);
      else novo.add(uf);
      return novo;
    });
  }

  function adicionarGrupo() {
    if (ufsSelecionadas.size === 0 || !cnpjGrupoAtual) {
      setErro("Selecione ao menos um estado e o CNPJ de destino para adicionar a exceção.");
      return;
    }
    setErro(undefined);
    setGrupos((prev) => [...prev, { ufs: Array.from(ufsSelecionadas), cnpj: cnpjGrupoAtual }]);
    setUfsSelecionadas(new Set());
    setCnpjGrupoAtual("");
  }

  function removerGrupo(idx: number) {
    setGrupos((prev) => prev.filter((_, i) => i !== idx));
  }

  function confirmar() {
    if (!cnpjPadrao) {
      setErro("Informe o CNPJ padrão para recebimento de NFs.");
      return;
    }
    onConfirmar({ cnpjPadrao, grupos: adicionarExcecoes ? grupos : [] });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between rounded-t-xl bg-frota-700 px-6 py-4 text-white">
          <h2 className="text-base font-semibold">Configuração de Envio de Nota Personalizado por Estado</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {erro && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

          <p className="text-sm font-medium text-frota-700">Local de destino da Nota Fiscal</p>
          <p className="mt-1 text-sm text-slate-500">
            Selecione o CNPJ/empresa que receberá as notas fiscais de abastecimentos.
          </p>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">CNPJ padrão para recebimento de NFs *</label>
            <input
              value={cnpjPadrao}
              onChange={(e) => setCnpjPadrao(e.target.value)}
              list="cnpjs-frota-padrao"
              placeholder="00.000.000/0000-00"
              className="input"
            />
            <datalist id="cnpjs-frota-padrao">
              {cnpjsFrota.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={adicionarExcecoes}
              onChange={(e) => setAdicionarExcecoes(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Adicionar Exceções
          </label>

          {adicionarExcecoes && (
            <div className="mt-3 rounded-lg border border-slate-200 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Estados</p>
                  <div className="h-48 overflow-y-auto rounded-lg border border-slate-200">
                    {UFS.map((uf) => (
                      <label
                        key={uf}
                        className={`flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm last:border-b-0 ${
                          ufsJaUsadas.has(uf) ? "text-slate-300" : "text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={ufsJaUsadas.has(uf)}
                          checked={ufsSelecionadas.has(uf)}
                          onChange={() => alternarUf(uf)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {uf}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-between">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      CNPJ/Razão Social - Frota/Unidade
                    </label>
                    <input
                      value={cnpjGrupoAtual}
                      onChange={(e) => setCnpjGrupoAtual(e.target.value)}
                      list="cnpjs-frota-excecao"
                      placeholder="00.000.000/0000-00"
                      className="input"
                    />
                    <datalist id="cnpjs-frota-excecao">
                      {cnpjsFrota.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <button type="button" onClick={adicionarGrupo} className="btn-secondary mt-3 self-end">
                    + Adicionar exceção
                  </button>
                </div>
              </div>

              {grupos.length > 0 && (
                <div className="mt-3 space-y-2">
                  {grupos.map((g, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span>
                        <strong>{g.ufs.join(", ")}</strong> → {g.cnpj}
                      </span>
                      <button type="button" onClick={() => removerGrupo(idx)} className="text-xs font-medium text-red-600 hover:underline">
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onFechar} className="btn-secondary">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} className="btn-primary">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
