"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  criarMissao,
  atualizarMissao,
  alternarAtivaMissao,
  excluirMissao,
  type MissaoRow,
} from "../../fidelidade-motoristas/missoesActions";
import { METRICAS_MISSAO, ICONES_MISSAO, LABEL_METRICA_MISSAO, metricaEhBinaria } from "@/lib/fidelidadeMissoes";

// Missões globais do posto (Fase 17/07-5) — pedido do Daniel: "dar a opção
// para os usuários cliente e posto de aplicar as missões para o grupo
// econômico (clientes) e rede de postos (postos)". Resposta do próprio
// Daniel na clarificação: pro posto, a missão fica GLOBAL (empresa_id
// null) — vale pra QUALQUER motorista da rede, mesmo espírito de Parcerias
// Locais (que também é visível pra rede toda, não só clientes do posto).
// Reusa as mesmas server actions de /fidelidade-motoristas, só que com
// modo="global" — o posto nem tem motoristas próprios pra escopar, então
// não faz sentido reaproveitar o conceito de "grupo econômico" aqui.

export function MissoesGlobaisGestao({ empresaId, missoesIniciais }: { empresaId: string; missoesIniciais: MissaoRow[] }) {
  const [missoes, setMissoes] = useState(missoesIniciais);
  const [editando, setEditando] = useState<MissaoRow | "nova" | null>(null);

  function aoSalvar(missao: MissaoRow, isNova: boolean) {
    setMissoes((atual) => (isNova ? [...atual, missao] : atual.map((m) => (m.id === missao.id ? missao : m))));
    setEditando(null);
  }

  return (
    <div className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">🎯 Missões da rede</h2>
          <p className="mt-1 text-sm text-slate-500">
            Crie desafios que valem pra QUALQUER motorista da rede &quot;Estrada que Cuida&quot; — ex.: abastecer no
            seu posto algumas vezes no mês. Cada missão concluída dá pontos bônus e aparece na Home do app do
            motorista.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditando("nova")}>
          + Nova Missão
        </button>
      </div>

      {editando && (
        <MissaoGlobalForm
          empresaId={empresaId}
          missao={editando === "nova" ? undefined : editando}
          onCancelar={() => setEditando(null)}
          onSalvar={(m) => aoSalvar(m, editando === "nova")}
        />
      )}

      {missoes.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-400">
          Nenhuma missão criada ainda. Clique em &quot;+ Nova Missão&quot; pra engajar a rede de motoristas.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {missoes.map((m) => (
            <CardMissaoGlobal
              key={m.id}
              missao={m}
              empresaId={empresaId}
              onExcluida={(id) => setMissoes((atual) => atual.filter((x) => x.id !== id))}
              onAtualizada={(m2) => setMissoes((atual) => atual.map((x) => (x.id === m2.id ? m2 : x)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardMissaoGlobal({
  missao,
  empresaId,
  onExcluida,
  onAtualizada,
}: {
  missao: MissaoRow;
  empresaId: string;
  onExcluida: (id: string) => void;
  onAtualizada: (m: MissaoRow) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);

  function toggle() {
    startTransition(async () => {
      await alternarAtivaMissao(missao.id, empresaId, !missao.ativa);
      onAtualizada({ ...missao, ativa: !missao.ativa });
    });
  }

  function excluir() {
    if (!confirm(`Excluir a missão "${missao.titulo}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      await excluirMissao(missao.id, empresaId);
      onExcluida(missao.id);
    });
  }

  if (editando) {
    return (
      <div className="sm:col-span-2 lg:col-span-3">
        <MissaoGlobalForm
          empresaId={empresaId}
          missao={missao}
          onCancelar={() => setEditando(false)}
          onSalvar={(m) => {
            onAtualizada(m);
            setEditando(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{missao.titulo}</p>
          <p className="mt-0.5 text-xs text-slate-500">{missao.descricao || "Sem descrição."}</p>
        </div>
        <span className={missao.ativa ? "badge-ativo" : "badge-inativo"}>{missao.ativa ? "Ativa" : "Inativa"}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>📊 {LABEL_METRICA_MISSAO[missao.tipo_metrica] ?? missao.tipo_metrica}</span>
        <span>🎯 Meta: {missao.meta}</span>
        <span>🏅 +{missao.bonus} pontos</span>
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-dashed border-slate-200 pt-2">
        <button type="button" onClick={() => setEditando(true)} className="text-xs font-medium text-frota-600 hover:underline">
          Editar
        </button>
        <button type="button" onClick={toggle} disabled={isPending} className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50">
          {isPending ? "..." : missao.ativa ? "Inativar" : "Ativar"}
        </button>
        <button type="button" onClick={excluir} disabled={isPending} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
          {isPending ? "..." : "Excluir"}
        </button>
      </div>
    </div>
  );
}

function MissaoGlobalForm({
  empresaId,
  missao,
  onCancelar,
  onSalvar,
}: {
  empresaId: string;
  missao?: MissaoRow;
  onCancelar: () => void;
  onSalvar: (m: MissaoRow) => void;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [tipoMetrica, setTipoMetrica] = useState(missao?.tipo_metrica ?? METRICAS_MISSAO[0].valor);
  const binaria = metricaEhBinaria(tipoMetrica);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = missao
        ? await atualizarMissao(missao.id, empresaId, "global", undefined, formData)
        : await criarMissao(empresaId, "global", undefined, formData);
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      onSalvar({
        id: missao?.id ?? crypto.randomUUID(),
        codigo: missao?.codigo ?? "",
        titulo: String(formData.get("titulo") ?? ""),
        descricao: String(formData.get("descricao") ?? ""),
        icone: String(formData.get("icone") ?? "flag_outlined"),
        tipo_metrica: tipoMetrica,
        meta: binaria ? 1 : Number(formData.get("meta") ?? 0),
        bonus: Number(formData.get("bonus") ?? 0),
        ativa: missao ? formData.get("ativa") === "on" : true,
        empresa_id: null,
        criador_empresa_id: empresaId,
        aplica_grupo_economico: false,
      });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-4 space-y-4 p-4">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Título <span className="text-red-500">*</span>
          </label>
          <input type="text" name="titulo" required defaultValue={missao?.titulo ?? ""} placeholder='Ex.: "Abasteça 3x no nosso posto"' className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ícone</label>
          <select name="icone" defaultValue={missao?.icone ?? "flag_outlined"} className="input">
            {ICONES_MISSAO.map((i) => (
              <option key={i.valor} value={i.valor}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Descrição</label>
        <textarea name="descricao" rows={2} defaultValue={missao?.descricao ?? ""} placeholder="O que o motorista precisa fazer pra concluir." className="input" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Métrica</label>
          <select name="tipo_metrica" value={tipoMetrica} onChange={(e) => setTipoMetrica(e.target.value)} className="input">
            {METRICAS_MISSAO.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">{METRICAS_MISSAO.find((m) => m.valor === tipoMetrica)?.descricao}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Meta</label>
          {binaria ? (
            <input type="text" value="Concluiu / não concluiu" disabled className="input bg-slate-50 text-slate-400" />
          ) : (
            <input type="number" name="meta" min="1" step="1" required defaultValue={missao?.meta ?? ""} className="input" />
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Bônus em pontos</label>
          <input type="number" name="bonus" min="0" step="1" defaultValue={missao?.bonus ?? 100} className="input" />
        </div>
        {missao && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" name="ativa" defaultChecked={missao.ativa} className="h-4 w-4 rounded border-slate-300" />
            Missão ativa
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Salvando..." : missao ? "Salvar alterações" : "Criar missão"}
        </button>
      </div>
    </form>
  );
}
