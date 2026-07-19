"use client";

import { useState } from "react";
import { PwaMockupPhone } from "./PwaMockupPhone";
import { QrCodeMobile } from "./QrCodeMobile";

const URL_PWA = "https://mobile.fxgestaodefrotasonline.com/";

// Fase PWA-Lembrete-Mobile (19/07) — pedido do Daniel: lembrete nas visões
// web (cliente e posto) sobre o app mobile (PWA), com imagem do app, link e
// o passo a passo de "adicionar à tela de início" no iOS e Android. Mesmo
// visual de casca de modal já usado em ModalRegra/ModalTermoAdesao (overlay
// escuro + card branco central).
export function InstalarPwaModal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);

  if (!aberto) return null;

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(URL_PWA);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard pode falhar por permissão do navegador — sem problema,
      // o link já fica visível e selecionável na tela.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">📱 Instale o app no seu celular</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[140px_1fr]">
            <div className="mx-auto w-28 sm:mx-0">
              <PwaMockupPhone className="w-full" />
            </div>

            <div>
              <p className="text-sm text-slate-600">
                Gestão de frotas na palma da mão: acompanhe abastecimentos, negociações e indicadores de onde
                estiver, sem precisar abrir o computador.
              </p>

              <div className="mt-4 flex flex-col items-start gap-3 rounded-lg bg-slate-50 p-4 sm:flex-row sm:items-center">
                <QrCodeMobile className="h-24 w-24 shrink-0 rounded border border-slate-200" />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Aponte a câmera do celular pro QR code
                  </p>
                  <p className="mt-1 break-all text-sm text-frota-700">{URL_PWA}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={URL_PWA}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs"
                    >
                      Abrir link
                    </a>
                    <button type="button" onClick={copiarLink} className="btn-secondary text-xs">
                      {copiado ? "Link copiado!" : "Copiar link"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">🍏 No iPhone (Safari)</h3>
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
                <li>Abra o link acima no Safari (precisa ser o Safari, não funciona pelo Chrome no iPhone).</li>
                <li>
                  Toque no ícone de <strong>Compartilhar</strong> (o quadrado com uma seta pra cima), na barra
                  inferior.
                </li>
                <li>
                  Role as opções e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
                </li>
                <li>
                  Confirme tocando em <strong>&quot;Adicionar&quot;</strong> no canto superior direito.
                </li>
              </ol>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">🤖 No Android (Chrome)</h3>
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
                <li>Abra o link acima no Chrome.</li>
                <li>
                  Toque no menu de <strong>três pontinhos (⋮)</strong>, no canto superior direito.
                </li>
                <li>
                  Toque em <strong>&quot;Instalar aplicativo&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>{" "}
                  (o texto varia um pouco conforme a versão do Chrome).
                </li>
                <li>Confirme — o ícone aparece na tela inicial igual a qualquer outro app.</li>
              </ol>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Depois de adicionado, o app abre em tela cheia, sem a barra de endereço do navegador — como um app
            normal do celular.
          </p>
        </div>
      </div>
    </div>
  );
}
