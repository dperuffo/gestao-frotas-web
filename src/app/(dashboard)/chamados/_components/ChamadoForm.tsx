"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarChamadoAcao } from "../actions";
import { PRIORIDADES_TICKET, TIPOS_TICKET, TAMANHO_MAX_ANEXO_BYTES, formatarTamanho } from "@/lib/chamados";
import type { EmpresaOpcao } from "@/lib/empresaAtual";

export function ChamadoForm({
  empresas,
  empresaSelecionadaInicial,
}: {
  empresas: EmpresaOpcao[];
  empresaSelecionadaInicial: string | null;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);

    // Fase 27.22 — valida o tamanho do anexo ANTES de enviar. Sem isso, um
    // arquivo grande demais faz a própria chamada de rede da Server Action
    // falhar (corpo excede o limite configurado), o que derruba a página
    // inteira com um erro genérico em vez de mostrar uma mensagem aqui.
    const arquivo = formData.get("arquivo");
    if (arquivo instanceof File && arquivo.size > TAMANHO_MAX_ANEXO_BYTES) {
      setErro(`O anexo (${formatarTamanho(arquivo.size)}) passa do limite de ${formatarTamanho(TAMANHO_MAX_ANEXO_BYTES)}. Envie um arquivo menor, ou abra o chamado sem anexo e adicione depois pela tela do chamado.`);
      return;
    }

    startTransition(async () => {
      try {
        const resultado = await criarChamadoAcao(undefined, formData);
        if (resultado?.erro) setErro(resultado.erro);
      } catch (e) {
        // Fase 27.22/27.24/27.25 — defesa em profundidade: se mesmo assim a
        // chamada de rede falhar (proxy, timeout etc.), mostra uma mensagem
        // aqui (com o motivo real e o "digest", quando disponível) em vez de
        // deixar a exceção escapar e derrubar a página inteira.
        const motivo = e instanceof Error ? e.message : "erro desconhecido";
        const digest = (e as { digest?: string })?.digest;
        setErro(`Não foi possível abrir o chamado (${motivo}${digest ? ` — código ${digest}` : ""}). Tente novamente.`);
        console.error("[ChamadoForm] falha ao enviar:", e);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="max-w-lg rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <section className="card max-w-lg space-y-4 p-6">
        {empresas.length > 1 ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select name="empresa_id" required defaultValue={empresaSelecionadaInicial ?? ""} className="input">
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="empresa_id" value={empresas[0]?.id ?? ""} />
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tipo <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            {TIPOS_TICKET.map((t) => (
              <label key={t.valor} className="flex items-center gap-1.5 text-sm">
                <input type="radio" name="tipo" value={t.valor} required defaultChecked={t.valor === "incidente"} />
                {t.icone} {t.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Título <span className="text-red-500">*</span>
          </label>
          <input name="titulo" required maxLength={150} className="input" placeholder="Resuma o problema/sugestão em poucas palavras" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Descrição <span className="text-red-500">*</span>
          </label>
          <textarea name="descricao" required rows={5} className="input" placeholder="Descreva com o máximo de detalhes possível" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prioridade</label>
          <select name="prioridade" defaultValue="media" className="input">
            {PRIORIDADES_TICKET.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Anexo (opcional)</label>
          <input type="file" name="arquivo" className="input" />
        </div>
      </section>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Enviando..." : "Abrir Chamado"}
        </button>
      </div>
    </form>
  );
}
