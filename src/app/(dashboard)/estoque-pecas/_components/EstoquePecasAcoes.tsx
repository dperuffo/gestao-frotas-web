"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registrarMovimentoAcao, desativarPecaAcao } from "../actions";

type Manutencao = { id: number; placa: string; data_manutencao: string; tipo: string | null };

export function RegistrarMovimentoForm({ pecaId, empresaId, manutencoes }: { pecaId: string; empresaId: string; manutencoes: Manutencao[] }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await registrarMovimentoAcao(pecaId, empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        (e.currentTarget as HTMLFormElement).reset();
        setTipo("saida");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Tipo de movimento</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTipo("saida")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
              tipo === "saida" ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-500"
            }`}
          >
            Saída (uso)
          </button>
          <button
            type="button"
            onClick={() => setTipo("entrada")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
              tipo === "entrada" ? "border-green-300 bg-green-50 text-green-700" : "border-slate-200 text-slate-500"
            }`}
          >
            Entrada (compra)
          </button>
        </div>
        <input type="hidden" name="tipo_movimento" value={tipo} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Quantidade</label>
        <input type="number" name="quantidade" min={0.01} step="0.01" required className="input" />
      </div>

      {tipo === "entrada" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Custo unitário (R$)</label>
          <input type="number" name="custo_unitario" min={0} step="0.01" className="input" placeholder="opcional" />
        </div>
      )}

      {tipo === "saida" && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Placa (veículo)</label>
            <input name="placa" className="input" placeholder="ABC1D23" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Vincular à OS (opcional)</label>
            <select name="manutencao_id" className="input" defaultValue="">
              <option value="">Nenhuma</option>
              {manutencoes.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.id} — {m.placa} — {new Date(`${m.data_manutencao}T00:00:00`).toLocaleDateString("pt-BR")}
                  {m.tipo ? ` (${m.tipo})` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Vincular a uma OS mostra o consumo real de peças na manutenção — impede baixa sem justificativa.
            </p>
          </div>
        </>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Motivo / observação</label>
        <input name="motivo" className="input" placeholder="Opcional" />
      </div>

      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? "Salvando..." : "Registrar Movimento"}
      </button>
    </form>
  );
}

export function DesativarPecaButton({ pecaId, ativa }: { pecaId: string; ativa: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const mensagem = ativa ? "Desativar esta peça? Ela deixa de aparecer no cadastro ativo (o histórico é mantido)." : "Reativar esta peça?";
    if (!confirm(mensagem)) return;
    startTransition(async () => {
      await desativarPecaAcao(pecaId, !ativa);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`text-sm font-medium hover:underline disabled:opacity-50 ${ativa ? "text-red-600" : "text-green-600"}`}
    >
      {isPending ? "Salvando..." : ativa ? "Desativar peça" : "Reativar peça"}
    </button>
  );
}
