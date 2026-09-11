"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { limparAvisosDispensados } from "@/lib/avisosDispensados";
import { limparLembrarMe } from "@/lib/lembrarMe";

export function BotaoSair() {
  const router = useRouter();
  const supabase = createClient();

  async function handleClick() {
    await supabase.auth.signOut();
    // Fase Avisos-Reaparecer-Login (18/08/2026) — garante que avisos
    // fixados dispensados voltem a aparecer no próximo login, mesmo se a
    // aba não for fechada entre o logout e o login seguinte.
    limparAvisosDispensados();
    // Fase Auditoria-UX (08/09/2026) — "lembrar-me" vale só "por essa
    // sessão": sair explicitamente também encerra essa preferência.
    limparLembrarMe();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      title="Sair"
      // Fase Menu-Retratil (08/09/2026) — ganhou um ícone (antes só tinha
      // texto) pra continuar clicável/identificável com o menu colapsado,
      // igual aos outros botões do rodapé (Avisos, Central de Ajuda).
      className="menu-item-link flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
    >
      <LogOut className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
      <span className="menu-item-label">Sair</span>
    </button>
  );
}
