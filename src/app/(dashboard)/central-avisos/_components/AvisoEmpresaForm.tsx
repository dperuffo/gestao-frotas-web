"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarAvisoEmpresaAcao, editarAvisoEmpresaAcao, type AvisoDaMinhaEmpresa } from "../actions";

const TIPO_LABEL: Record<string, string> = {
  aviso_geral: "📣 Aviso geral",
  novidade: "🆕 Novidade",
  correcao: "🐛 Correção",
  manutencao: "🔧 Manutenção / Indisponibilidade",
};

const URGENCIA_LABEL: Record<string, string> = {
  informativo: "Informativo",
  atencao: "Atenção",
  critico: "Crítico",
};

// Fase Central-Avisos-Por-Empresa (04/08/2026) — versão simplificada do
// AvisoForm.tsx (administracao/central-avisos), sem os campos que só fazem
// sentido pro time FNI: imagem/banner, janela de publicação/expiração,
// segmentação por segmento/plano/empresa (aqui SEMPRE a própria empresa de
// quem cria — travado no banco, dentro de criar_aviso_empresa(), nem chega
// a virar campo de formulário).
//
// Fase edição (04/08/2026) — pedido do Daniel: "Usuario poder editar um
// aviso criado no painel". Reaproveita este mesmo form pros dois modos
// (mesmo padrão de AvisoForm.tsx do admin): sem `aviso` = criar; com
// `aviso` = editar (campos com defaultValue, chama editarAvisoEmpresaAcao,
// que redireciona de volta pra lista no sucesso — sem reset/onCriado).
export function AvisoEmpresaForm({
  aviso,
  onCriado,
}: {
  aviso?: AvisoDaMinhaEmpresa;
  onCriado?: () => void;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;

    startTransition(async () => {
      const resultado = aviso
        ? await editarAvisoEmpresaAcao(aviso.id, undefined, formData)
        : await criarAvisoEmpresaAcao(undefined, formData);
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      if (!aviso) {
        form.reset();
        onCriado?.();
      }
      // Modo edição: editarAvisoEmpresaAcao já dá redirect() no sucesso.
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Tipo">
          <select name="tipo" defaultValue={aviso?.tipo ?? "aviso_geral"} className="input">
            {Object.entries(TIPO_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Urgência" hint="Crítico não bloqueia a tela — só destaca visualmente.">
          <select name="urgencia" defaultValue={aviso?.urgencia ?? "informativo"} className="input">
            {Object.entries(URGENCIA_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo label="Título" required>
        <input name="titulo" required defaultValue={aviso?.titulo} className="input" />
      </Campo>
      <Campo label="Resumo" required hint="Linha curta — aparece no sino/drawer dos colegas da sua empresa.">
        <input name="resumo" required defaultValue={aviso?.resumo} className="input" />
      </Campo>
      <Campo label="Corpo" required hint={'Markdown simples: **negrito**, [texto](https://url), "- " pra lista.'}>
        <textarea name="corpo" required rows={6} defaultValue={aviso?.corpo} className="input font-mono text-xs" />
      </Campo>

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Salvando..." : aviso ? "Salvar alterações" : "Publicar pra minha empresa"}
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
