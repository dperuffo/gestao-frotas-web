"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANO_LABEL, type Plano } from "@/lib/constants";
import { HASH_TERMO_ADESAO } from "@/lib/termoAdesao";
import { ModalTermoAdesao } from "./ModalTermoAdesao";

// Antes de chamar o checkout, o usuário precisa aceitar o Termo de Adesão
// (Fase 23, pedido do Daniel). Fluxo do clique em "Assinar":
// 1. Abre o modal com o texto do termo (não chama nada ainda).
// 2. Ao clicar em "Aceito os Termos de Adesão": chama create-checkout-session
//    já com aceite_termo=true — a Edge Function registra o aceite em
//    termos_aceite (hash/versão/IP calculados no servidor) e devolve o
//    termo_id junto da url do Stripe.
// 3. Gera o comprovante em PDF no navegador (@react-pdf/renderer, mesmo
//    padrão do resto do app) e sobe pro Storage privado (termos-adesao/
//    {empresa_id}/{termo_id}.pdf) — é esse arquivo que o stripe-webhook
//    anexa no e-mail de confirmação depois do pagamento.
// 4. Só então redireciona pro Stripe. Se o upload falhar, mostra erro e não
//    redireciona (fica só um checkout/termo órfão no Stripe, sem cobrança —
//    inofensivo, o usuário pode tentar de novo).
export function BotaoAssinarPlano({
  empresaId,
  plano,
  nomeEmpresa,
  cnpj,
  email,
  precoLabel,
}: {
  empresaId: string;
  plano: Plano;
  nomeEmpresa: string;
  cnpj: string | null;
  email: string;
  precoLabel: string;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmarAceite() {
    setErro(null);
    setCarregando(true);
    const supabase = createClient();

    const { data, error } = await supabase.functions.invoke<{
      url?: string;
      termo_id?: number;
      hash_termo?: string;
      versao_termo?: string;
      erro?: string;
    }>("create-checkout-session", { body: { empresa_id: empresaId, plano, aceite_termo: true } });

    if (error || !data?.url || !data.termo_id) {
      setErro(data?.erro ?? "Não foi possível registrar o aceite. Tente novamente.");
      setCarregando(false);
      return;
    }

    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { TermoAdesaoPdf } = await import("./TermoAdesaoPdf");
      const blob = await pdf(
        <TermoAdesaoPdf
          nomeEmpresa={nomeEmpresa}
          cnpj={cnpj}
          email={email}
          planoLabel={PLANO_LABEL[plano]}
          precoLabel={precoLabel}
          dataHoraAceite={new Date().toLocaleString("pt-BR")}
          ip={null}
          hashTermo={data.hash_termo ?? HASH_TERMO_ADESAO}
        />
      ).toBlob();

      const caminho = `${empresaId}/${data.termo_id}.pdf`;
      const { error: erroUpload } = await supabase.storage
        .from("termos-adesao")
        .upload(caminho, blob, { contentType: "application/pdf", upsert: true });

      if (erroUpload) {
        setErro("Aceite registrado, mas não foi possível gerar o comprovante em PDF. Tente novamente.");
        setCarregando(false);
        return;
      }
    } catch {
      setErro("Aceite registrado, mas não foi possível gerar o comprovante em PDF. Tente novamente.");
      setCarregando(false);
      return;
    }

    window.location.href = data.url;
  }

  return (
    <>
      <div className="mt-3">
        {erro && !modalAberto && <p className="mb-2 text-xs text-red-600">{erro}</p>}
        <button
          type="button"
          onClick={() => {
            setErro(null);
            setModalAberto(true);
          }}
          className="btn-primary w-full justify-center"
        >
          Assinar {PLANO_LABEL[plano]}
        </button>
      </div>

      <ModalTermoAdesao
        aberto={modalAberto}
        planoLabel={PLANO_LABEL[plano]}
        precoLabel={precoLabel}
        carregando={carregando}
        erro={erro}
        onFechar={() => {
          if (!carregando) setModalAberto(false);
        }}
        onConfirmar={confirmarAceite}
      />
    </>
  );
}
