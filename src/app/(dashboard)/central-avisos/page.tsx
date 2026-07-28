import { renderMarkdownSimples } from "@/lib/markdownSimples";
import { urlImagemAviso } from "@/lib/avisos/imagemAviso";
import { formatarDataHoraBr } from "@/lib/utils";
import { listarAvisosAcao } from "../administracao/central-avisos/actions";
import type { AvisoParaUsuario } from "../administracao/central-avisos/actions";

const TIPO_LABEL: Record<AvisoParaUsuario["tipo"], string> = {
  novidade: "🆕 Novidade",
  correcao: "🐛 Correção",
  manutencao: "🔧 Manutenção",
  aviso_geral: "📣 Aviso geral",
};

const URGENCIA_BORDA: Record<AvisoParaUsuario["urgencia"], string> = {
  informativo: "border-slate-200",
  atencao: "border-amber-300",
  critico: "border-red-400",
};

// Fase Central-Avisos (28/07/2026) — histórico completo, tipo changelog
// público: todo aviso já publicado (segmentado pra este usuário), inclusive
// os já expirados — diferente do sino/drawer/banner, que só mostram o que
// está dentro da janela de exibição.
export default async function CentralAvisosHistoricoPage() {
  const avisos = await listarAvisosAcao({ incluirExpirados: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Central de Avisos</h1>
        <p className="mt-1 text-sm text-slate-500">Histórico completo de novidades, correções e avisos da plataforma.</p>
      </div>

      <div className="space-y-4">
        {avisos.length === 0 && <p className="p-4 text-sm text-slate-400">Nenhum aviso publicado ainda.</p>}
        {avisos.map((a) => {
          const urlImagem = urlImagemAviso(a.imagem_path);
          return (
            <div key={a.id} className={`card border p-5 ${URGENCIA_BORDA[a.urgencia]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{TIPO_LABEL[a.tipo]}</span>
                <span className="text-xs text-slate-400">{formatarDataHoraBr(a.data_publicacao)}</span>
              </div>
              <h2 className="mt-2 text-base font-semibold text-slate-900">{a.titulo}</h2>
              <p className="mt-1 text-sm text-slate-600">{a.resumo}</p>
              {urlImagem && (
                // eslint-disable-next-line @next/next/no-img-element -- imagem de storage dinâmica, sem domínio fixo pra next/image
                <img src={urlImagem} alt="" className="mt-3 max-h-64 rounded-lg border border-slate-200" />
              )}
              <div className="mt-3 space-y-2 text-sm text-slate-700">{renderMarkdownSimples(a.corpo)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
