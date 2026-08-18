"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { limparAvisosDispensados } from "@/lib/avisosDispensados";

export function BotaoSair() {
  const router = useRouter();
  const supabase = createClient();

  async function handleClick() {
    await supabase.auth.signOut();
    // Fase Avisos-Reaparecer-Login (18/08/2026) — garante que avisos
    // fixados dispensados voltem a aparecer no próximo login, mesmo se a
    // aba não for fechada entre o logout e o login seguinte.
    limparAvisosDispensados();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/10"
    >
      Sair
    </button>
  );
}
