"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { indicarCondutorAcao, atualizarStatusMultaAcao, excluirMultaAcao } from "../actions";

type Motorista = { id: string; nome_completo: string; empresaNome?: string };

export function IndicarCondutorForm({
  multaId,
  motoristas,
  motoristaSugeridoId,
}: {
  multaId: string;
  motoristas: Motorista[];
  motoristaSugeridoId: string | null;
}) {
  const [selecionado, setSelecionado] = useState(motoristaSugeridoId ?? "");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selecionado) {
      setErro("Selecione um motorista.");
      return;
    }
    setErro(undefined);
    startTransition(async () => {
      try {
        await indicarCondutorAcao(multaId, selecionado);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível indicar o condutor.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {motoristaSugeridoId && (
        <p className="text-xs text-slate-500">
          Sugestão pré-selecionada com base no vínculo Motorista ↔ Veículo ativo na data da infração.
        </p>
      )}
      <select value={selecionado} onChange={(e) => setSelecionado(e.target.value)} className="input">
        <option value="">Selecione o condutor...</option>
        {motoristas.map((m) => (
          <option key={m.id} value={m.id}>
            {m.empresaNome ? `${m.nome_completo} — ${m.empresaNome}` : m.nome_completo}
          </option>
        ))}
      </select>
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Salvando..." : "Indicar Condutor"}
      </button>
    </form>
  );
}

export function StatusMultaBotoes({ multaId, status }: { multaId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | undefined>();

  function mudar(novoStatus: string) {
    setErro(undefined);
    startTransition(async () => {
      try {
        await atualizarStatusMultaAcao(multaId, novoStatus);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível atualizar o status.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <div className="flex flex-wrap gap-2">
        {status !== "paga" && (
          <button type="button" disabled={isPending} onClick={() => mudar("paga")} className="btn-secondary text-sm">
            Marcar como Paga
          </button>
        )}
        {status !== "recorrida" && (
          <button type="button" disabled={isPending} onClick={() => mudar("recorrida")} className="btn-secondary text-sm">
            Marcar como Recorrida
          </button>
        )}
        {status !== "cancelada" && (
          <button type="button" disabled={isPending} onClick={() => mudar("cancelada")} className="btn-secondary text-sm">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

export function ExcluirMultaButton({ id, empresaId }: { id: string; empresaId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir esta multa? Essa ação não pode ser desfeita.")) return;
    startTransition(async () => {
      await excluirMultaAcao(id);
      router.push(`/multas?empresa=${empresaId}`);
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50">
      {isPending ? "Excluindo..." : "Excluir multa"}
    </button>
  );
}
