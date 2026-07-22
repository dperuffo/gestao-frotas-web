"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { cancelarMdfeAcao, encerrarMdfeAcao, iniciarViagemAcao } from "../mdfeActions";

// Fase P0.3 (plano FNI_Plano_Implementacao_P0.md) — "1 viagem = 1 MDF-e por
// veículo, agrupando N CT-e". Aqui, 1 frete = 1 viagem. Provedor real ainda
// não existe (mesma decisão da P0.1/P0.2) — roda no Simulador.

export type VeiculoOpcao = { id: string; placa: string };

export type MdfeAtivo = {
  id: string;
  status: string;
  placaVeiculo: string;
  condutorNome: string | null;
  ufCarregamento: string;
  ufDescarregamento: string;
  chaveAcesso: string | null;
  protocoloAutorizacao: string | null;
  numeroMdfe: string | null;
  motivoRejeicao: string | null;
  criadoEm: string;
};

const STATUS_MDFE_BADGE: Record<string, { texto: string; classe: string }> = {
  autorizado: { texto: "Em viagem", classe: "bg-emerald-50 text-emerald-700" },
  enviando: { texto: "Enviando...", classe: "bg-amber-50 text-amber-700" },
  rejeitado: { texto: "Rejeitado pela SEFAZ", classe: "bg-red-50 text-red-700" },
  encerrado: { texto: "Encerrado", classe: "bg-slate-100 text-slate-500" },
  cancelado: { texto: "Cancelado", classe: "bg-slate-100 text-slate-500" },
};

const DIAS_ALERTA_MDFE_ABERTO = 3;

export function MdfeCard({
  freteId,
  empresaId,
  fiscalConfigurado,
  temCteAutorizado,
  veiculos,
  condutorNomePadrao,
  condutorCpfPadrao,
  ufCarregamentoPadrao,
  ufDescarregamentoPadrao,
  mdfeAtivo,
}: {
  freteId: string;
  empresaId: string;
  fiscalConfigurado: boolean;
  temCteAutorizado: boolean;
  veiculos: VeiculoOpcao[];
  condutorNomePadrao: string;
  condutorCpfPadrao: string;
  ufCarregamentoPadrao: string;
  ufDescarregamentoPadrao: string;
  mdfeAtivo: MdfeAtivo | null;
}) {
  if (mdfeAtivo) {
    return <MdfeStatusCard empresaId={empresaId} mdfe={mdfeAtivo} />;
  }

  return (
    <div className="card mb-6 p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">🚛 Viagem (MDF-e)</h2>
      <p className="mb-4 text-xs text-slate-500">
        Agrupa os CT-e autorizados deste frete em um único manifesto — obrigatório pra circular sem multa/retenção
        de carga.
      </p>
      {!fiscalConfigurado && (
        <p className="text-xs text-slate-400">
          Configure os dados fiscais em <a href="/fiscal" className="text-frota-600 hover:underline">Fiscal</a> antes
          de iniciar uma viagem.
        </p>
      )}
      {fiscalConfigurado && !temCteAutorizado && (
        <p className="text-xs text-slate-400">Emita ao menos um CT-e autorizado neste frete antes de iniciar a viagem.</p>
      )}
      {fiscalConfigurado && temCteAutorizado && (
        <FormIniciarViagem
          freteId={freteId}
          empresaId={empresaId}
          veiculos={veiculos}
          condutorNomePadrao={condutorNomePadrao}
          condutorCpfPadrao={condutorCpfPadrao}
          ufCarregamentoPadrao={ufCarregamentoPadrao}
          ufDescarregamentoPadrao={ufDescarregamentoPadrao}
        />
      )}
    </div>
  );
}

function FormIniciarViagem({
  freteId,
  empresaId,
  veiculos,
  condutorNomePadrao,
  condutorCpfPadrao,
  ufCarregamentoPadrao,
  ufDescarregamentoPadrao,
}: {
  freteId: string;
  empresaId: string;
  veiculos: VeiculoOpcao[];
  condutorNomePadrao: string;
  condutorCpfPadrao: string;
  ufCarregamentoPadrao: string;
  ufDescarregamentoPadrao: string;
}) {
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | undefined>();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await iniciarViagemAcao(freteId, empresaId, formData);
      if (resultado.erro) setMensagem({ tipo: "erro", texto: resultado.erro });
      else if (resultado.sucesso) setMensagem({ tipo: "sucesso", texto: `MDF-e nº ${resultado.sucesso.numeroMdfe} autorizado.` });
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {veiculos.length > 0 ? (
          <select
            name="veiculo_id"
            className="input text-xs"
            onChange={(e) => {
              const placa = e.target.selectedOptions[0]?.dataset.placa ?? "";
              const campoPlaca = e.currentTarget.form?.elements.namedItem("placa_veiculo") as HTMLInputElement | null;
              if (campoPlaca) campoPlaca.value = placa;
            }}
          >
            <option value="">Selecione o veículo...</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id} data-placa={v.placa}>
                {v.placa}
              </option>
            ))}
          </select>
        ) : (
          <span />
        )}
        <input name="placa_veiculo" placeholder="Placa do veículo" required className="input text-xs uppercase" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="condutor_nome" defaultValue={condutorNomePadrao} placeholder="Nome do condutor" required className="input text-xs" />
        <input name="condutor_cpf" defaultValue={condutorCpfPadrao} placeholder="CPF do condutor" required className="input text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="condutor_adicional_nome" placeholder="Condutor adicional (opcional)" className="input text-xs" />
        <input name="condutor_adicional_cpf" placeholder="CPF do condutor adicional" className="input text-xs" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input name="uf_carregamento" defaultValue={ufCarregamentoPadrao} placeholder="UF carregamento" maxLength={2} required className="input text-xs uppercase" />
        <input name="uf_descarregamento" defaultValue={ufDescarregamentoPadrao} placeholder="UF descarregamento" maxLength={2} required className="input text-xs uppercase" />
        <input name="percurso_uf" placeholder="UFs de percurso (opcional)" className="input text-xs uppercase" />
      </div>
      <button type="submit" disabled={isPending} className="btn-primary w-full text-xs">
        {isPending ? "Iniciando viagem..." : "Iniciar viagem"}
      </button>
      {mensagem && <p className={`text-xs font-medium ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>{mensagem.texto}</p>}
    </form>
  );
}

function MdfeStatusCard({ empresaId, mdfe }: { empresaId: string; mdfe: MdfeAtivo }) {
  const [modo, setModo] = useState<"nenhum" | "cancelar">("nenhum");
  const [justificativa, setJustificativa] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | undefined>();
  const [isPending, startTransition] = useTransition();

  const badge = STATUS_MDFE_BADGE[mdfe.status] ?? { texto: mdfe.status, classe: "bg-slate-100 text-slate-500" };
  const diasAberto = Math.floor((Date.now() - new Date(mdfe.criadoEm).getTime()) / (1000 * 60 * 60 * 24));
  const abertoHaMuitoTempo = mdfe.status === "autorizado" && diasAberto >= DIAS_ALERTA_MDFE_ABERTO;

  function encerrar() {
    setMensagem(undefined);
    startTransition(async () => {
      const resultado = await encerrarMdfeAcao(mdfe.id, empresaId);
      if (resultado.erro) setMensagem({ tipo: "erro", texto: resultado.erro });
      else setMensagem({ tipo: "sucesso", texto: resultado.ok ?? "Feito." });
    });
  }

  function confirmarCancelamento() {
    setMensagem(undefined);
    startTransition(async () => {
      const resultado = await cancelarMdfeAcao(mdfe.id, empresaId, justificativa);
      if (resultado.erro) setMensagem({ tipo: "erro", texto: resultado.erro });
      else {
        setMensagem({ tipo: "sucesso", texto: resultado.ok ?? "Feito." });
        setModo("nenhum");
      }
    });
  }

  return (
    <div className="card mb-6 p-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">🚛 Viagem (MDF-e) — Nº {mdfe.numeroMdfe ?? "—"}</h2>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.classe}`}>{badge.texto}</span>
      </div>
      <p className="text-xs text-slate-500">
        {mdfe.placaVeiculo} · {mdfe.condutorNome ?? "—"} · {mdfe.ufCarregamento} → {mdfe.ufDescarregamento}
      </p>
      {mdfe.protocoloAutorizacao && <p className="mt-1 text-xs text-slate-500">Protocolo {mdfe.protocoloAutorizacao}</p>}
      {mdfe.motivoRejeicao && <p className="mt-1 text-xs text-red-600">{mdfe.motivoRejeicao}</p>}
      {abertoHaMuitoTempo && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          ⚠️ MDF-e aberto há {diasAberto} dias — confira se a viagem já terminou e encerre.
        </p>
      )}

      {mdfe.status === "autorizado" && modo === "nenhum" && (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={isPending} onClick={encerrar} className="btn-primary text-xs">
            {isPending ? "Encerrando..." : "Encerrar viagem"}
          </button>
          <button type="button" onClick={() => setModo("cancelar")} className="btn-secondary text-xs">
            Cancelar MDF-e
          </button>
        </div>
      )}

      {mdfe.status === "autorizado" && modo === "cancelar" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Justificativa do cancelamento (mín. 15 caracteres)"
            rows={2}
            className="input w-full text-xs"
          />
          <div className="flex gap-2">
            <button type="button" disabled={isPending} onClick={confirmarCancelamento} className="btn-secondary text-xs">
              {isPending ? "Enviando..." : "Confirmar cancelamento"}
            </button>
            <button type="button" onClick={() => setModo("nenhum")} className="text-xs text-slate-400 hover:underline">
              voltar
            </button>
          </div>
        </div>
      )}

      {mensagem && <p className={`mt-2 text-xs font-medium ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>{mensagem.texto}</p>}
    </div>
  );
}
