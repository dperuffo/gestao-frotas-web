"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Fase Grupo-1-item-3 (02/08/2026, benchmark FNI vs KMM) — chat simples
// motorista<->operação vinculado a um frete. Primeira vez que o projeto usa
// Supabase Realtime (postgres_changes): sem isso o chat exigiria a empresa
// ficar recarregando a página pra ver resposta do motorista, o que mata a
// utilidade de um chat. RLS da tabela fretes_mensagens já garante que só
// quem é dono da empresa ou o motorista do frete recebe os eventos.
//
// Esse componente roda só do lado empresa (dentro de /fretes/[id], que é
// tela de gestão — motorista nunca acessa essa página). Por isso
// remetente_tipo é sempre 'empresa' aqui.

type Mensagem = {
  id: string;
  frete_id: string;
  remetente_tipo: "motorista" | "empresa";
  remetente_email: string | null;
  mensagem: string;
  criado_em: string;
};

export function ChatFrete({
  freteId,
  remetenteEmail,
  nomeMotorista,
}: {
  freteId: string;
  remetenteEmail: string | null;
  nomeMotorista: string | null;
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const fimListaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    supabase
      .from("fretes_mensagens")
      .select("id, frete_id, remetente_tipo, remetente_email, mensagem, criado_em")
      .eq("frete_id", freteId)
      .order("criado_em")
      .then(({ data }) => {
        if (ativo) {
          setMensagens((data ?? []) as Mensagem[]);
          setCarregando(false);
        }
      });

    const canal = supabase
      .channel(`fretes_mensagens:${freteId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fretes_mensagens", filter: `frete_id=eq.${freteId}` },
        (payload) => {
          setMensagens((atual) => {
            const nova = payload.new as Mensagem;
            if (atual.some((m) => m.id === nova.id)) return atual;
            return [...atual, nova];
          });
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [freteId]);

  useEffect(() => {
    fimListaRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  async function enviar() {
    const texto2 = texto.trim();
    if (!texto2 || enviando) return;
    setEnviando(true);
    setErro(undefined);
    const supabase = createClient();
    const { error } = await supabase.from("fretes_mensagens").insert({
      frete_id: freteId,
      remetente_tipo: "empresa",
      remetente_email: remetenteEmail,
      mensagem: texto2,
    });
    setEnviando(false);
    if (error) {
      setErro("Não foi possível enviar. Tente de novo.");
      return;
    }
    setTexto("");
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <div className="card mb-6 p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">💬 Chat com o motorista</h2>
      <p className="mb-3 text-xs text-slate-500">
        Conversa direta com {nomeMotorista ?? "o motorista"} sobre esse frete. Ele recebe e responde pelo app.
      </p>

      <div className="mb-3 max-h-80 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
        {carregando && <p className="text-sm text-slate-400">Carregando mensagens...</p>}
        {!carregando && mensagens.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma mensagem ainda. Envie a primeira.</p>
        )}
        {mensagens.map((m) => {
          const daEmpresa = m.remetente_tipo === "empresa";
          return (
            <div key={m.id} className={`flex ${daEmpresa ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  daEmpresa ? "bg-frota-600 text-white" : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.mensagem}</p>
                <p className={`mt-1 text-[10px] ${daEmpresa ? "text-frota-100" : "text-slate-400"}`}>
                  {daEmpresa ? "Você" : nomeMotorista ?? "Motorista"} ·{" "}
                  {new Date(m.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={fimListaRef} />
      </div>

      {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}

      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={aoTeclar}
          rows={2}
          placeholder="Escreva uma mensagem... (Enter envia, Shift+Enter quebra linha)"
          className="input text-sm"
        />
        <button type="button" onClick={enviar} disabled={enviando || !texto.trim()} className="btn-primary text-sm">
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}
