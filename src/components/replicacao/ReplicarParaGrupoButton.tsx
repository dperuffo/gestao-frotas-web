"use client";

import { useState } from "react";
import {
  buscarEmpresasAlvoReplicacaoAcao,
  replicarParaGrupoAcao,
  type EmpresaAlvoReplicacao,
  type ResultadoReplicacao,
} from "@/lib/replicacaoGrupo";

// Fase Replicação-Grupo — botão genérico e reutilizável. Qualquer tela que
// edite algo ligado a uma "chaveTabela" cadastrada em
// replicacao_tabelas_registro pode soltar este componente e ganhar de graça
// o "Replicar para o grupo": lista as empresas irmãs (Grupo Econômico ou
// Rede de Postos, é o mesmo mecanismo), confirma, roda e mostra o relatório
// por empresa (criado / já existia / erro). Sem registroId, replica TODOS
// os registros elegíveis da empresa de origem para aquela tabela.
export function ReplicarParaGrupoButton({
  chaveTabela,
  empresaId,
  registroId,
  rotuloRegistro,
  className,
}: {
  chaveTabela: string;
  empresaId: string;
  registroId?: string;
  rotuloRegistro?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregandoAlvos, setCarregandoAlvos] = useState(false);
  const [alvos, setAlvos] = useState<EmpresaAlvoReplicacao[] | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoReplicacao | null>(null);

  async function abrir() {
    setAberto(true);
    setResultado(null);
    setCarregandoAlvos(true);
    const lista = await buscarEmpresasAlvoReplicacaoAcao(empresaId);
    setAlvos(lista);
    setCarregandoAlvos(false);
  }

  function fechar() {
    setAberto(false);
    setAlvos(null);
    setResultado(null);
  }

  async function confirmar() {
    setProcessando(true);
    const r = await replicarParaGrupoAcao(chaveTabela, empresaId, registroId ?? null, "pular_se_existir");
    setResultado(r);
    setProcessando(false);
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className={className ?? "inline-flex items-center gap-1 text-xs font-medium text-frota-700 hover:underline"}
      >
        ↻ Replicar para o grupo
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between rounded-t-xl bg-frota-700 px-6 py-4 text-white">
          <h2 className="text-base font-semibold">Replicar para o grupo</h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm">
          {!resultado && (
            <>
              <p className="text-slate-600">
                Isso vai copiar {rotuloRegistro ?? "este cadastro"} para as demais empresas do seu Grupo Econômico ou
                Rede de Postos. Registros que já existirem na empresa destino não são alterados.
              </p>

              {carregandoAlvos && <p className="mt-4 text-slate-400">Buscando empresas do grupo…</p>}

              {!carregandoAlvos && alvos && alvos.length === 0 && (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
                  Não encontramos outras empresas no seu grupo — nada para replicar.
                </p>
              )}

              {!carregandoAlvos && alvos && alvos.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-slate-500">Empresas que vão receber a cópia ({alvos.length}):</p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {alvos.map((a) => (
                      <li key={a.empresa_id} className="text-slate-700">
                        {a.nome}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {resultado?.erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{resultado.erro}</div>}

          {resultado && !resultado.erro && (
            <div>
              <p className="font-medium text-slate-700">
                {resultado.totalSucesso ?? 0} empresa(s) atualizada(s), {resultado.totalPulado ?? 0} já estava(m) em dia
                {(resultado.totalErro ?? 0) > 0 ? `, ${resultado.totalErro} com erro` : ""}.
              </p>
              <ul className="mt-3 space-y-1.5">
                {resultado.itens?.map((i) => (
                  <li
                    key={i.empresa_destino_id}
                    title={i.motivo ?? undefined}
                    className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span className="text-slate-700">{i.nome_empresa}</span>
                    <span
                      className={
                        i.status === "sucesso"
                          ? "font-medium text-green-600"
                          : i.status === "erro"
                            ? "font-medium text-red-600"
                            : "text-slate-400"
                      }
                    >
                      {i.status === "sucesso" ? "Atualizado" : i.status === "erro" ? "Erro" : "Já existia"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={fechar} className="btn-secondary">
            {resultado ? "Fechar" : "Cancelar"}
          </button>
          {!resultado && (
            <button
              type="button"
              disabled={processando || carregandoAlvos || (alvos?.length ?? 0) === 0}
              onClick={confirmar}
              className="btn-primary disabled:opacity-50"
            >
              {processando ? "Replicando…" : "Replicar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
