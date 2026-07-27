"use client";

import { useState, useTransition, type FormEvent, type FocusEvent } from "react";
import { ModalRegra } from "@/app/(dashboard)/parametros-uso/_components/ModalRegra";
import { buscarDadosColegaParaEdicaoAcao, editarColegaAcao, verificarCpfDuplicadoColega } from "../actions";

// Fase editar-excluir-colega (27/07/2026, pedido do Daniel: "ter a
// possibilidade de editar e excluir um usuario" em Minha Equipe). Reaproveita
// o mesmo modal genérico (ModalRegra) já usado em Parâmetros de Uso —
// nome/CPF/telefone só são buscados ao ABRIR o modal (RPC dedicada, ver
// actions.ts), não ficam na listagem principal.
export function EditarColegaButton({
  empresaId,
  email,
  nomeAtual,
}: {
  empresaId: string;
  email: string;
  nomeAtual: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [avisoCpf, setAvisoCpf] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [dados, setDados] = useState<{ nome: string; cpf: string; telefone: string }>({
    nome: nomeAtual ?? "",
    cpf: "",
    telefone: "",
  });

  function handleAbrir() {
    setAberto(true);
    setErro(undefined);
    setCarregando(true);
    startTransition(async () => {
      const resultado = await buscarDadosColegaParaEdicaoAcao(empresaId, email);
      setCarregando(false);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setDados({ nome: resultado.nome, cpf: resultado.cpf, telefone: resultado.telefone });
    });
  }

  function handleBlurCpf(e: FocusEvent<HTMLInputElement>) {
    const cpf = e.target.value.trim();
    setAvisoCpf(undefined);
    if (!cpf) return;
    startTransition(async () => {
      const { duplicado } = await verificarCpfDuplicadoColega(cpf, email);
      if (duplicado) setAvisoCpf("Este CPF já está cadastrado em outra conta do sistema.");
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await editarColegaAcao(empresaId, email, undefined, formData);
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      setAberto(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAbrir}
        className="text-xs font-medium text-frota-600 hover:underline"
      >
        Editar
      </button>

      <ModalRegra titulo={`Editar ${email}`} aberto={aberto} onFechar={() => setAberto(false)}>
        {carregando ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                name="nome"
                required
                defaultValue={dados.nome}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">CPF</label>
              <input name="cpf" defaultValue={dados.cpf} onBlur={handleBlurCpf} className="input" />
              {avisoCpf && <p className="mt-1 text-xs text-amber-600">{avisoCpf}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Telefone</label>
              <input name="telefone" defaultValue={dados.telefone} className="input" />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAberto(false)} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </ModalRegra>
    </>
  );
}
