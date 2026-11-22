import Link from "next/link";
import { Sparkles } from "lucide-react";

// Destaque do Assistente FNI no topo do menu lateral (acima dos grupos): deixa claro
// que o usuário pode contar com o assistente — pergunta, gráfico, cadastro de regra.
export function BotaoAssistenteMenu() {
  return (
    <div className="px-3 pt-3" data-tour="menu-assistente-destaque">
      <Link
        href="/assistente"
        className="flex items-center gap-3 rounded-xl border border-accento/50 bg-accento/10 px-3 py-2.5 text-slate-900 transition hover:bg-accento/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accento text-white">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-tight">Assistente FNI</span>
          <span className="block text-xs leading-tight text-slate-600 dark:text-slate-300">Pergunte, peça gráficos, cadastre regras</span>
        </span>
      </Link>
    </div>
  );
}
