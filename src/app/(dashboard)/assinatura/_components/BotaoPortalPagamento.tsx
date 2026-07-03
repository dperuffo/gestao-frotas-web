"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function BotaoPortalPagamento({ empresaId, temAssinatura }: { empresaId: string; temAssinatura: boolean }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrirPortal() {
    setErro(null);
    setCarregando(true);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<{ url?: string; erro?: string }>(
      "create-billing-portal-session",
      { body: { empresa_id: empresaId } }
    );

    if (error || !data?.url) {
      setErro(data?.erro ?? "Não foi possível abrir o portal de pagamento.");
      setCarregando(false);
      return;
    }

    window.location.href = data.url;
  }

  if (!temAssinatura) {
    return <span className="text-xs text-slate-400">Assine um plano pago para gerenciar o pagamento.</span>;
  }

  return (
    <div>
      {erro && <p className="mb-1 text-xs text-red-600">{erro}</p>}
      <button type="button" onClick={abrirPortal} disabled={carregando} className="btn-secondary">
        {carregando ? "Abrindo..." : "Gerenciar pagamento"}
      </button>
    </div>
  );
}
