"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { registrarManutencaoAcao } from "../actions";
import { ITENS_MANUTENCAO } from "@/lib/manutencaoPreditiva";

function formatarMoedaSimples(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fase Aprovacao-Enforcement (27/08/2026, achado do Daniel: valores altos
// não passavam por aprovação nenhuma) — quando o custo digitado bate o
// limite configurado, o formulário passa a EXIGIR escolher uma solicitação
// já aprovada (categoria Manutenção) antes de deixar submeter. Quem decide
// de verdade é o trigger no banco (verificar_aprovacao_manutencao) — isto
// aqui é só pra avisar o usuário ANTES de ele preencher tudo e levar erro
// no fim.
export function RegistrarManutencaoForm({
  empresaId,
  placa,
  kmAtual,
  limiteAprovacao,
  solicitacoesAprovadas,
}: {
  empresaId: string;
  placa: string;
  kmAtual: number;
  limiteAprovacao: number;
  solicitacoesAprovadas: { id: string; titulo: string; valor: number }[];
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
  const [avisoFotos, setAvisoFotos] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [custoTexto, setCustoTexto] = useState("");
  const [solicitacaoEscolhidaId, setSolicitacaoEscolhidaId] = useState("");

  const custoTotal = Number(custoTexto.replace(",", "."));
  const precisaAprovacao = Number.isFinite(custoTotal) && custoTotal >= limiteAprovacao;
  const solicitacoesCompativeis = useMemo(
    () => solicitacoesAprovadas.filter((s) => s.valor >= (Number.isFinite(custoTotal) ? custoTotal : 0)),
    [solicitacoesAprovadas, custoTotal]
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(false);
    setAvisoFotos(undefined);
    if (precisaAprovacao && !solicitacaoEscolhidaId) {
      setErro("Esse valor exige uma solicitação de aprovação já aprovada vinculada — escolha uma acima.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await registrarManutencaoAcao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        setSucesso(true);
        setAvisoFotos(resultado?.avisoFotos);
        (e.target as HTMLFormElement).reset();
        setCustoTexto("");
        setSolicitacaoEscolhidaId("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {sucesso && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Manutenção registrada com sucesso.
        </div>
      )}
      {avisoFotos && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{avisoFotos}</div>}
      <input type="hidden" name="placa" value={placa} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Data <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="data_manutencao"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Hodômetro (km)</label>
          <input type="number" name="hodometro" min={0} defaultValue={kmAtual > 0 ? Math.round(kmAtual) : ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Custo total (R$)</label>
          <input
            type="number"
            name="custo_total"
            min={0}
            step="0.01"
            value={custoTexto}
            onChange={(e) => setCustoTexto(e.target.value)}
            className="input"
          />
        </div>
        {/* Fase Indicadores-da-Frota (30/07/2026) — classificação usada no KPI
            de proporção corretiva/preventiva. Sem valor padrão de propósito:
            forçar o gestor a escolher garante que a manutenção nova sempre
            entre na conta certa (o "não classificado" só existe pra manutenção
            antiga, registrada antes desta fase). */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select name="tipo" required defaultValue="" className="input">
            <option value="" disabled>
              Selecione...
            </option>
            <option value="Preventiva">Preventiva</option>
            <option value="Corretiva">Corretiva</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Técnico</label>
          <input name="tecnico" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Oficina</label>
          <input name="oficina" className="input" />
        </div>
        {/* Fase TCO 3 (29/07/2026) — opcional, usado só pra estimar custo de
            downtime no TCO (tco_veiculo/tco_frota_resumo). Sem telemetria/GPS
            não dá pra medir automaticamente, então é preenchimento manual do
            gestor mesmo. */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Dias parado <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input type="number" name="dias_parado" min={0} step="1" className="input" />
        </div>
      </div>

      {precisaAprovacao && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <input type="hidden" name="solicitacao_aprovacao_id" value={solicitacaoEscolhidaId} />
          <p className="mb-2 text-sm font-medium text-amber-800">
            Custo a partir de {formatarMoedaSimples(limiteAprovacao)} exige aprovação antes do lançamento.
          </p>
          {solicitacoesCompativeis.length > 0 ? (
            <>
              <label className="mb-1 block text-xs font-medium text-amber-700">
                Solicitação aprovada vinculada <span className="text-red-500">*</span>
              </label>
              <select
                value={solicitacaoEscolhidaId}
                onChange={(e) => setSolicitacaoEscolhidaId(e.target.value)}
                className="input text-sm"
              >
                <option value="">Selecione...</option>
                {solicitacoesCompativeis.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titulo} — {formatarMoedaSimples(s.valor)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="text-sm text-amber-700">
              Nenhuma solicitação aprovada disponível pra esse valor ainda.{" "}
              <Link
                href={`/aprovacoes?empresa=${empresaId}&categoria=manutencao&valor=${custoTexto}&titulo=${encodeURIComponent(`Manutenção — ${placa}`)}`}
                className="font-medium underline"
                target="_blank"
              >
                Criar solicitação de aprovação
              </Link>{" "}
              e volte aqui depois de aprovada.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Itens realizados <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ITENS_MANUTENCAO.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="itens_realizados" value={item} className="h-4 w-4 rounded border-slate-300" />
              {item}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
        <textarea name="obs_gerais" rows={3} className="input" placeholder="Condições, peças substituídas, pendências..." />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Fotos do serviço <span className="font-normal text-slate-400">(opcional — evidência pra compliance)</span>
        </label>
        <input type="file" name="fotos" accept="image/*" multiple className="input" />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Registrando..." : "Registrar Manutenção"}
        </button>
      </div>
    </form>
  );
}
