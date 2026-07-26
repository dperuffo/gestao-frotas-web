"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANO_LABEL, PLANO_POSTO_LABEL } from "@/lib/constants";
import {
  HASH_TERMO_ADESAO_POR_PLANO,
  HASH_TERMO_ADESAO_POSTO_POR_PLANO,
  montarParagrafosTermoAdesao,
  montarParagrafosTermoAdesaoPosto,
  type PlanoComTermo,
  type PlanoPostoComTermo,
} from "@/lib/termoAdesao";
import { ModalTermoAdesao } from "./ModalTermoAdesao";

function ehPlanoPosto(plano: PlanoComTermo | PlanoPostoComTermo): plano is PlanoPostoComTermo {
  return plano.startsWith("posto_");
}

function rotuloDoPlano(plano: PlanoComTermo | PlanoPostoComTermo): string {
  return ehPlanoPosto(plano) ? PLANO_POSTO_LABEL[plano] : PLANO_LABEL[plano];
}

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
  grupoEconomicoId,
  plano,
  nomeEmpresa,
  cnpj,
  email,
  precoLabel,
}: {
  empresaId: string;
  // Fase Posto/Rede (26/07/2026) — quando informado, a assinatura é da REDE
  // (matriz paga por todos): empresaId continua sendo a empresa
  // administradora que clica em "Assinar", mas o Stripe cobra o
  // grupo_economico_id, não a empresa isolada. Ver create-checkout-session.
  grupoEconomicoId?: string;
  plano: PlanoComTermo | PlanoPostoComTermo;
  nomeEmpresa: string;
  cnpj: string | null;
  email: string;
  precoLabel: string;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const planoPosto = ehPlanoPosto(plano);
  const planoLabel = rotuloDoPlano(plano);
  // Calibração TMS/ERP (23/07/2026) e Fase Posto/Rede (26/07/2026) — cada
  // plano (frotista ou posto) tem sua própria Cláusula 3ª (ver
  // src/lib/termoAdesao.ts), então os parágrafos e o hash já saem prontos
  // pro plano específico deste botão.
  const paragrafosTermo = planoPosto
    ? montarParagrafosTermoAdesaoPosto(plano)
    : montarParagrafosTermoAdesao(plano);
  const hashTermoFallback = planoPosto
    ? HASH_TERMO_ADESAO_POSTO_POR_PLANO[plano]
    : HASH_TERMO_ADESAO_POR_PLANO[plano];

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
    }>("create-checkout-session", {
      body: {
        empresa_id: empresaId,
        ...(grupoEconomicoId ? { grupo_economico_id: grupoEconomicoId } : {}),
        plano,
        aceite_termo: true,
      },
    });

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
          planoLabel={planoLabel}
          precoLabel={precoLabel}
          dataHoraAceite={new Date().toLocaleString("pt-BR")}
          ip={null}
          hashTermo={data.hash_termo ?? hashTermoFallback}
          paragrafos={paragrafosTermo}
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
          Assinar {planoLabel}
        </button>
      </div>

      <ModalTermoAdesao
        aberto={modalAberto}
        planoLabel={planoLabel}
        precoLabel={precoLabel}
        paragrafos={paragrafosTermo}
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
