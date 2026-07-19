"use client";

import { useState } from "react";
import { PwaMockupPhone } from "./PwaMockupPhone";
import { PwaMockupPhoneMotorista } from "./PwaMockupPhoneMotorista";
import { QrCodeMobile } from "./QrCodeMobile";
import { QrCodeEstrada } from "./QrCodeEstrada";

const URL_PWA_CLIENTE = "https://mobile.fxgestaodefrotasonline.com/";
const URL_PWA_MOTORISTA = "https://estrada.fxgestaodefrotasonline.com/#/login";

// Fase PWA-Lembrete-Mobile (19/07) — pedido do Daniel: lembrete nas visões
// web (cliente e posto) sobre o app mobile (PWA), com imagem do app, link e
// o passo a passo de "adicionar à tela de início" no iOS e Android. Mesmo
// visual de casca de modal já usado em ModalRegra/ModalTermoAdesao (overlay
// escuro + card branco central).
//
// Achado do Daniel (19/07, mesmo dia): a primeira versão só trazia o app
// Cliente/Posto — faltava informação sobre o PWA do Motorista ("Estrada que
// Cuida"), que é justamente o que o gestor/cliente vai querer compartilhar
// com a equipe de motoristas. Agora o modal traz os dois, cada um com seu
// próprio QR/link — "pra você" (gestor) e "pra seus motoristas".
function BlocoApp({
  titulo,
  descricao,
  url,
  mockup,
  qr,
  copiado,
  onCopiar,
}: {
  titulo: string;
  descricao: string;
  url: string;
  mockup: React.ReactNode;
  qr: React.ReactNode;
  copiado: boolean;
  onCopiar: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[110px_1fr]">
      <div className="mx-auto w-24 sm:mx-0">{mockup}</div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        <p className="mt-1 text-sm text-slate-600">{descricao}</p>

        <div className="mt-3 flex flex-col items-start gap-3 rounded-lg bg-slate-50 p-4 sm:flex-row sm:items-center">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded border border-slate-200">{qr}</div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Aponte a câmera do celular pro QR code
            </p>
            <p className="mt-1 break-all text-sm text-frota-700">{url}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                Abrir link
              </a>
              <button type="button" onClick={onCopiar} className="btn-secondary text-xs">
                {copiado ? "Link copiado!" : "Copiar link"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstalarPwaModal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [copiado, setCopiado] = useState<"cliente" | "motorista" | null>(null);

  if (!aberto) return null;

  async function copiar(url: string, alvo: "cliente" | "motorista") {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(alvo);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // Clipboard pode falhar por permissão do navegador — sem problema,
      // o link já fica visível e selecionável na tela.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl sm:max-w-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">📱 Instale os apps no celular</h2>
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
          <BlocoApp
            titulo="📱 Pra você — App Cliente e Posto"
            descricao="Gestão de frotas na palma da mão: acompanhe abastecimentos, negociações e indicadores de onde estiver, sem precisar abrir o computador."
            url={URL_PWA_CLIENTE}
            mockup={<PwaMockupPhone className="w-full" />}
            qr={<QrCodeMobile className="h-full w-full" />}
            copiado={copiado === "cliente"}
            onCopiar={() => copiar(URL_PWA_CLIENTE, "cliente")}
          />

          <hr className="my-6 border-slate-200" />

          <BlocoApp
            titulo="🚚 Pra seus motoristas — App Estrada que Cuida"
            descricao="Compartilhe este link ou QR code com a sua equipe: os motoristas confirmam abastecimentos, acompanham fretes, missões e o saldo financeiro deles direto do celular."
            url={URL_PWA_MOTORISTA}
            mockup={<PwaMockupPhoneMotorista className="w-full" />}
            qr={<QrCodeEstrada className="h-full w-full" />}
            copiado={copiado === "motorista"}
            onCopiar={() => copiar(URL_PWA_MOTORISTA, "motorista")}
          />

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">🍏 No iPhone (Safari)</h3>
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
                <li>Abra o link do app (acima) no Safari — precisa ser o Safari, não funciona pelo Chrome no iPhone.</li>
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
                <li>Abra o link do app (acima) no Chrome.</li>
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
            normal do celular. Cada app (Cliente/Posto e Motorista) é instalado separadamente, um pra cada uso.
          </p>
        </div>
      </div>
    </div>
  );
}
