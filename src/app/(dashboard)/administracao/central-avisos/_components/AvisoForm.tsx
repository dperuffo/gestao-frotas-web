"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarAvisoAcao, atualizarAvisoAcao } from "../actions";
import { SEGMENTO_USUARIO, PLANOS, PLANO_LABEL, PLANOS_POSTO, PLANO_POSTO_LABEL } from "@/lib/constants";
import { urlImagemAviso } from "@/lib/avisos/imagemAviso";
import { renderMarkdownSimples } from "@/lib/markdownSimples";
import type { Database } from "@/types/database.types";

type Comunicado = Database["public"]["Tables"]["comunicados"]["Row"];

const TIPO_LABEL: Record<Comunicado["tipo"], string> = {
  novidade: "🆕 Novidade",
  correcao: "🐛 Correção",
  manutencao: "🔧 Manutenção / Indisponibilidade",
  aviso_geral: "📣 Aviso geral",
};

const URGENCIA_LABEL: Record<Comunicado["urgencia"], string> = {
  informativo: "Informativo",
  atencao: "Atenção",
  critico: "Crítico",
};

// Converte timestamptz (ISO, UTC) pro formato que <input type="datetime-local">
// espera (horário local, sem timezone) — mesmo tipo de conversão que qualquer
// form com data/hora editável precisa fazer nesta aplicação.
function paraDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AvisoForm({ aviso }: { aviso?: Comunicado }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [corpo, setCorpo] = useState(aviso?.corpo ?? "");
  const urlAtual = urlImagemAviso(aviso?.imagem_path ?? null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado = aviso
        ? await atualizarAvisoAcao(aviso.id, undefined, formData)
        : await criarAvisoAcao(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Identificação</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Tipo" required>
            <select name="tipo" defaultValue={aviso?.tipo ?? "aviso_geral"} className="input">
              {(Object.keys(TIPO_LABEL) as Comunicado["tipo"][]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Urgência" required hint="Crítico não bloqueia a tela — só destaca visualmente (banner/drawer).">
            <select name="urgencia" defaultValue={aviso?.urgencia ?? "informativo"} className="input">
              {(Object.keys(URGENCIA_LABEL) as Comunicado["urgencia"][]).map((u) => (
                <option key={u} value={u}>
                  {URGENCIA_LABEL[u]}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Conteúdo</h2>
        <div className="space-y-4">
          <Campo label="Título" required>
            <input name="titulo" required defaultValue={aviso?.titulo} className="input" />
          </Campo>
          <Campo label="Resumo" required hint="Linha curta — aparece no sino/drawer e no banner fixo.">
            <input name="resumo" required defaultValue={aviso?.resumo} className="input" />
          </Campo>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Campo
              label="Corpo"
              required
              hint={"Markdown simples: **negrito**, [texto](https://url), \"- \" pra lista, \"# \" pra título."}
            >
              <textarea
                name="corpo"
                required
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                rows={10}
                className="input font-mono text-xs"
              />
            </Campo>
            <Campo label="Prévia">
              <div className="min-h-[13rem] space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {corpo.trim() ? renderMarkdownSimples(corpo) : <span className="text-slate-400">Nada pra mostrar ainda.</span>}
              </div>
            </Campo>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Imagem / banner (opcional)</h2>
        {urlAtual && (
          <div className="mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem de storage dinâmica, sem domínio fixo pra next/image */}
            <img src={urlAtual} alt="Imagem atual" className="max-h-48 rounded-lg border border-slate-200" />
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" name="remover_imagem" className="rounded border-slate-300" />
              Remover esta imagem
            </label>
          </div>
        )}
        <Campo label={urlAtual ? "Substituir por outra imagem" : "Enviar imagem/banner"}>
          <input type="file" name="imagem" accept="image/*" className="input" />
        </Campo>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Janela de exibição</h2>
        <p className="mb-4 text-xs text-slate-500">
          Deixe &quot;Expira em&quot; vazio pra não sumir sozinho — precisa ser desativado manualmente.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Publicado a partir de">
            <input
              type="datetime-local"
              name="data_publicacao"
              defaultValue={paraDatetimeLocal(aviso?.data_publicacao) || paraDatetimeLocal(new Date().toISOString())}
              className="input"
            />
          </Campo>
          <Campo label="Expira em (opcional)" hint="Essencial pra manutenção: 'das 2h às 4h' some sozinho.">
            <input type="datetime-local" name="data_expiracao" defaultValue={paraDatetimeLocal(aviso?.data_expiracao)} className="input" />
          </Campo>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="fixado" defaultChecked={aviso?.fixado ?? false} className="rounded border-slate-300" />
          Fixar como banner no topo (além de aparecer no sino/drawer)
        </label>
      </section>

      <section className="card p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Segmentação</h2>
          <p className="mt-1 text-xs text-slate-500">Deixe tudo desmarcado pra aparecer a todos os clientes/postos/motoristas.</p>
        </div>
        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-slate-500">Segmento</span>
          <div className="flex flex-wrap gap-4">
            {SEGMENTO_USUARIO.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="segmentos_alvo"
                  value={s}
                  defaultChecked={aviso?.segmentos_alvo?.includes(s) ?? false}
                  className="rounded border-slate-300"
                />
                {s === "Frota" ? "Frota (clientes/motoristas)" : "Revenda (postos)"}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <span className="mb-1 block text-xs font-medium text-slate-500">Plano (opcional, filtro fino)</span>
          <div className="flex flex-wrap gap-4">
            {PLANOS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="planos_alvo"
                  value={p}
                  defaultChecked={aviso?.planos_alvo?.includes(p) ?? false}
                  className="rounded border-slate-300"
                />
                Frota — {PLANO_LABEL[p]}
              </label>
            ))}
            {PLANOS_POSTO.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="planos_alvo"
                  value={p}
                  defaultChecked={aviso?.planos_alvo?.includes(p) ?? false}
                  className="rounded border-slate-300"
                />
                Posto — {PLANO_POSTO_LABEL[p]}
              </label>
            ))}
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="ativo" defaultChecked={aviso?.ativo ?? true} className="rounded border-slate-300" />
          Ativo (visível para os usuários dentro da janela de exibição)
        </label>
      </section>

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
