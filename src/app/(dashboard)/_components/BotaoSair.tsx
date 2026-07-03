"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BotaoSair() {
  const router = useRouter();
  const supabase = createClient();

  async function handleClick() {
    await supabase.auth.signOut();
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
