"use client";

// Fase 27.121 — casca de modal reaproveitada pelos 9 tipos de regra que
// usam formulário inline (em vez de página própria, como o Vínculo). Mesmo
// visual do ModalTermoAdesao (overlay escuro + card branco central), só
// genérico: quem chama passa o título e o conteúdo do formulário.
export function ModalRegra({
  titulo,
  aberto,
  onFechar,
  children,
}: {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: React.ReactNode;
}) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
