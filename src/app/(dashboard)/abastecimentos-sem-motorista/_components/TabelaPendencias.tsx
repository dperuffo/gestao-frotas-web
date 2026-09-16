"use client";

import { useMemo, useState, useTransition } from "react";
import { formatarDataHoraBr } from "@/lib/utils";
import { resolverPendenciaMotoristaAcao } from "../actions";

export type PendenciaAbastecimento = {
  id: number;
  codigo_abastecimento: string;
  data_abastecimento: string;
  placa: string;
  posto_nome: string | null;
  provedor: string;
  quantidade: number;
  valor_total: number;
};

export type MotoristaOpcao = { id: string; nome_completo: string; cpf: string | null };

// Fase Fila-Motorista-Abastecimento-Externo (16/09/2026) — tabela de
// trabalho da fila: cada linha vira o próprio formulário de resolução (busca
// motorista já cadastrado OU digita nome+CPF novo). Estado local otimista —
// linha resolvida some da lista na hora, sem esperar o revalidatePath da
// Server Action terminar — mesmo padrão já usado em AvisosSino.tsx pro sino
// de avisos.
export function TabelaPendencias({
  pendenciasIniciais,
  motoristas,
}: {
  pendenciasIniciais: PendenciaAbastecimento[];
  motoristas: MotoristaOpcao[];
}) {
  const [pendencias, setPendencias] = useState(pendenciasIniciais);

  function removerDaLista(id: number) {
    setPendencias((prev) => prev.filter((p) => p.id !== id));
  }

  if (pendencias.length === 0) {
    return (
      <div className="card p-6 text-sm text-slate-500 dark:text-slate-400">
        Nenhum abastecimento pendente de motorista — tudo o que veio das integrações já foi revisado.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Placa</th>
            <th className="px-4 py-3">Posto</th>
            <th className="px-4 py-3">Canal</th>
            <th className="px-4 py-3 text-right">Litros</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3">Motorista</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {pendencias.map((p) => (
            <LinhaPendencia key={p.id} pendencia={p} motoristas={motoristas} onResolvida={() => removerDaLista(p.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinhaPendencia({
  pendencia,
  motoristas,
  onResolvida,
}: {
  pendencia: PendenciaAbastecimento;
  motoristas: MotoristaOpcao[];
  onResolvida: () => void;
}) {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const datalistId = `motoristas-${pendencia.id}`;

  // Se o nome digitado bate exatamente (sem diferenciar maiúsculas) com um
  // motorista já cadastrado, usamos o id dele (e o CPF do cadastro, não o
  // que está no campo) — evita gravar uma grafia divergente do mesmo
  // motorista e reaproveita o CPF já confirmado antes.
  const motoristaCorrespondente = useMemo(
    () => motoristas.find((m) => m.nome_completo.trim().toLowerCase() === nome.trim().toLowerCase()),
    [motoristas, nome]
  );

  function selecionarNome(valor: string) {
    setNome(valor);
    const encontrado = motoristas.find((m) => m.nome_completo.trim().toLowerCase() === valor.trim().toLowerCase());
    if (encontrado?.cpf) setCpf(encontrado.cpf);
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await resolverPendenciaMotoristaAcao({
        id: pendencia.id,
        motoristaId: motoristaCorrespondente?.id ?? null,
        nome,
        cpf,
      });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      onResolvida();
    });
  }

  return (
    <tr className="align-top transition-colors hover:bg-frota-50/60">
      <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
        {formatarDataHoraBr(pendencia.data_abastecimento)}
      </td>
      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{pendencia.placa}</td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{pendencia.posto_nome ?? "—"}</td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{pendencia.provedor}</td>
      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
        {pendencia.quantidade.toLocaleString("pt-BR")} L
      </td>
      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
        {pendencia.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <div>
            <input
              list={datalistId}
              value={nome}
              onChange={(e) => selecionarNome(e.target.value)}
              placeholder="Nome do motorista"
              className="input text-xs"
            />
            <datalist id={datalistId}>
              {motoristas.map((m) => (
                <option key={m.id} value={m.nome_completo} />
              ))}
            </datalist>
          </div>
          <input
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="CPF (só números)"
            maxLength={14}
            className="input text-xs sm:w-36"
          />
        </div>
        {motoristaCorrespondente && (
          <p className="mt-1 text-[11px] text-frota-600">Motorista já cadastrado — vai reaproveitar o CPF do cadastro.</p>
        )}
        {!motoristaCorrespondente && nome.trim() && (
          <p className="mt-1 text-[11px] text-slate-400">Motorista novo — será cadastrado com o CPF informado ao lado.</p>
        )}
        {erro && <p className="mt-1 text-[11px] text-red-600">{erro}</p>}
      </td>
      <td className="px-4 py-3 text-right">
        <button type="button" onClick={salvar} disabled={isPending} className="btn-secondary text-xs">
          {isPending ? "Salvando..." : "Vincular"}
        </button>
      </td>
    </tr>
  );
}
