"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ModalRegra } from "../../parametros-uso/_components/ModalRegra";
import { ToggleStatusRegra, ExcluirRegra } from "../../parametros-uso/_components/AcoesRegra";
import { criarParametroNF, alternarStatusParametroNF, excluirParametroNF } from "../actions";

const OPCOES_SIM_NAO = ["Sem preferência", "Sim", "Não"] as const;
const OPCOES_FORMA_EMISSAO = [
  "Nota no ato do abastecimento",
  "Nota única por abastecimento",
  "Nota aglomerada com mais de um abastecimento",
] as const;
const OPCOES_LOCAL_DESTINO = [
  "Empresa em que o veículo está cadastrado",
  "Matriz",
  "Personalizado CNPJ por Posto",
  "Personalizado CNPJ por Estado",
  "Personalizado CNPJ por Abastecimento",
] as const;

type Linha = {
  id: string;
  cnpj_frota: string | null;
  exige_nota_fiscal: string;
  separar_nf_combustivel: string;
  forma_emissao: string;
  local_destino: string;
  cnpj_destino_personalizado: string | null;
  dados_adicionais: string | null;
  status: string;
  observacao: string | null;
};

export function SecaoParametrosNF({
  linhas,
  empresaId,
  cnpjsFrota,
}: {
  linhas: Linha[];
  empresaId: string;
  cnpjsFrota: string[];
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [localDestino, setLocalDestino] = useState<string>(OPCOES_LOCAL_DESTINO[0]);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarParametroNF(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        setModalAberto(false);
        setLocalDestino(OPCOES_LOCAL_DESTINO[0]);
      }
    });
  }

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Preferências de emissão de nota fiscal por CNPJ da frota. Sem uma regra específica para o CNPJ, o posto ou
            sistema de automação deve seguir a regra padrão (sem CNPJ preenchido), quando existir.
          </p>
          <button type="button" onClick={() => setModalAberto(true)} className="btn-primary shrink-0">
            + Nova Regra
          </button>
        </div>
      </div>

      <div className="card mb-4 border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">Atenção</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-amber-700">
          <li>A emissão da nota fiscal está sempre sujeita às regras da SEFAZ e à legislação vigente.</li>
          <li>Nem todos os postos têm suporte à opção &quot;Nota no ato do abastecimento&quot;.</li>
          <li>Alterações nestes parâmetros só valem a partir do próximo ciclo de faturamento.</li>
        </ul>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">CNPJ da Frota</th>
              <th className="px-4 py-3">Exige NF</th>
              <th className="px-4 py-3">Separa NF combustível</th>
              <th className="px-4 py-3">Forma de emissão</th>
              <th className="px-4 py-3">Destino da NF</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{l.cnpj_frota ?? "Todos (regra padrão)"}</td>
                <td className="px-4 py-3 text-slate-600">{l.exige_nota_fiscal}</td>
                <td className="px-4 py-3 text-slate-600">{l.separar_nf_combustivel}</td>
                <td className="px-4 py-3 text-slate-600">{l.forma_emissao}</td>
                <td className="px-4 py-3 text-slate-600">
                  {l.local_destino}
                  {l.cnpj_destino_personalizado ? ` (${l.cnpj_destino_personalizado})` : ""}
                </td>
                <td className="px-4 py-3">
                  <span className={l.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{l.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ToggleStatusRegra id={l.id} ativo={l.status === "Ativo"} acao={alternarStatusParametroNF} />
                    <ExcluirRegra id={l.id} acao={excluirParametroNF} />
                  </div>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma regra cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ModalRegra titulo="Nova Regra — Parâmetros de NF" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          <input type="hidden" name="empresa_id" value={empresaId} />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">CNPJ da Frota</label>
            <input name="cnpj_frota" list="cnpjs-frota" placeholder="Todos os CNPJs (regra padrão)" className="input" />
            <datalist id="cnpjs-frota">
              {cnpjsFrota.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-slate-500">Deixe em branco para uma regra padrão válida para todos os CNPJs.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Exige Nota Fiscal</label>
            <select name="exige_nota_fiscal" defaultValue={OPCOES_SIM_NAO[0]} className="input">
              {OPCOES_SIM_NAO.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Separar NF de combustível dos produtos e serviços
            </label>
            <select name="separar_nf_combustivel" defaultValue={OPCOES_SIM_NAO[0]} className="input">
              {OPCOES_SIM_NAO.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Forma de emissão da nota</label>
            <select name="forma_emissao" defaultValue={OPCOES_FORMA_EMISSAO[0]} className="input">
              {OPCOES_FORMA_EMISSAO.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Local de destino da Nota Fiscal</label>
            <select
              name="local_destino"
              value={localDestino}
              onChange={(e) => setLocalDestino(e.target.value)}
              className="input"
            >
              {OPCOES_LOCAL_DESTINO.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {localDestino.startsWith("Personalizado") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">CNPJ de destino personalizado</label>
              <input name="cnpj_destino_personalizado" placeholder="00.000.000/0000-00" className="input" />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Dados adicionais para a nota fiscal</label>
            <textarea name="dados_adicionais" rows={2} className="input" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Observação</label>
            <textarea name="observacao" rows={2} className="input" />
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? "Salvando..." : "Salvar Regra"}
            </button>
          </div>
        </form>
      </ModalRegra>
    </div>
  );
}
