"use client";

import { useState } from "react";
import { TextoFormatado } from "@/lib/ajuda/textoFormatado";
import { urlImagemTreinamento, urlVideoTreinamento } from "@/lib/ajuda/imagemTreinamento";

type Licao = {
  id: number;
  titulo: string;
  texto: string;
  imagem_path: string | null;
  video_path: string | null;
};

type Modulo = {
  nome: string;
  licoes: Licao[];
};

export function TreinamentoExplorer({ modulos }: { modulos: Modulo[] }) {
  const [moduloAtivo, setModuloAtivo] = useState(modulos[0]?.nome ?? "");
  const [licaoAtivaId, setLicaoAtivaId] = useState<number | null>(modulos[0]?.licoes[0]?.id ?? null);

  const modulo = modulos.find((m) => m.nome === moduloAtivo);
  const licao = modulo?.licoes.find((l) => l.id === licaoAtivaId) ?? modulo?.licoes[0];
  const urlImagem = urlImagemTreinamento(licao?.imagem_path ?? null);
  const urlVideo = urlVideoTreinamento(licao?.video_path ?? null);

  function selecionarModulo(nome: string) {
    setModuloAtivo(nome);
    const primeiraLicao = modulos.find((m) => m.nome === nome)?.licoes[0];
    setLicaoAtivaId(primeiraLicao?.id ?? null);
  }

  if (modulos.length === 0) {
    return (
      <div className="card p-6 text-sm text-slate-500">
        Nenhuma lição publicada ainda. Volte em breve — o conteúdo é atualizado periodicamente.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
      <nav className="card h-fit p-3">
        {modulos.map((m) => (
          <div key={m.nome} className="mb-1">
            <button
              type="button"
              onClick={() => selecionarModulo(m.nome)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                m.nome === moduloAtivo ? "bg-frota-50 text-frota-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m.nome}
            </button>
            {m.nome === moduloAtivo && (
              <div className="ml-2 mt-1 space-y-0.5 border-l border-slate-100 pl-3">
                {m.licoes.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLicaoAtivaId(l.id)}
                    className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition ${
                      l.id === licaoAtivaId ? "font-semibold text-frota-700" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <span>{l.titulo}</span>
                    {l.video_path && (
                      <span className="shrink-0 rounded-full bg-frota-50 px-1.5 py-0.5 text-[9px] font-semibold text-frota-700">
                        🎥
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <article className="card p-6">
        {licao ? (
          <>
            <h2 className="text-lg font-semibold text-slate-900">{licao.titulo}</h2>
            <TextoFormatado texto={licao.texto} />
            {urlVideo && (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- vídeo curto ilustrativo de treinamento, sem legendas geradas
              <video
                src={urlVideo}
                controls
                preload="metadata"
                className="mt-4 w-full rounded-lg border border-slate-200"
              />
            )}
            {urlImagem && (
              // eslint-disable-next-line @next/next/no-img-element -- imagem de storage dinâmica
              <img src={urlImagem} alt={licao.titulo} className="mt-4 w-full rounded-lg border border-slate-200" />
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">Selecione uma lição ao lado.</p>
        )}
      </article>
    </div>
  );
}
