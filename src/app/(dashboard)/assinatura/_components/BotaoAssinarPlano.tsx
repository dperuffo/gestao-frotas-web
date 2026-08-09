"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANO_LABEL, PLANO_POSTO_LABEL, PLANO_GRUPO_FROTA_LABEL } from "@/lib/constants";
import {
  HASH_TERMO_ADESAO_POR_PLANO,
  HASH_TERMO_ADESAO_POSTO_POR_PLANO,
  HASH_TERMO_ADESAO_GRUPO_FROTA_POR_PLANO,
  montarParagrafosTermoAdesao,
  montarParagrafosTermoAdesaoPosto,
  montarParagrafosTermoAdesaoGrupoFrota,
  type PlanoComTermo,
  type PlanoPostoComTermo,
  type PlanoGrupoFrotaComTermo,
} from "@/lib/termoAdesao";
import { ModalTermoAdesao } from "./ModalTermoAdesao";

type PlanoComTodosOsTermos = PlanoComTermo | PlanoPostoComTermo | PlanoGrupoFrotaComTermo;

// Fase Grupo-Economico-Frota-Billing (09/08/2026) — generaliza o que antes
// só distinguia frotista/posto (`ehPlanoPosto`) pra também reconhecer
// planos de Grupo Frota (`grupo_frota_*`), mesmo padrão de "assinatura
// única, matriz paga por todos" que a Rede de Postos já tinha, agora
// também disponível pro Grupo Econômico de clientes.
function tipoDoPlano(plano: PlanoComTodosOsTermos): "posto" | "grupo_frota" | "frotista" {
  if (plano.startsWith("posto_")) return "posto";
  if (plano.startsWith("grupo_frota_")) return "grupo_frota";
  return "frotista";
}

function rotuloDoPlano(plano: PlanoComTodosOsTermos): string {
  const tipo = tipoDoPlano(plano);
  if (tipo === "posto") return PLANO_POSTO_LABEL[plano as PlanoPostoComTermo];
  if (tipo === "grupo_frota") return PLANO_GRUPO_FROTA_LABEL[plano as PlanoGrupoFrotaComTermo];
  return PLANO_LABEL[plano as PlanoComTermo];
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
  // Fase Posto/Rede (26/07/2026), generalizado na Fase Grupo-Economico-
  // Frota-Billing (09/08/2026) — quando informado, a assinatura é do GRUPO
  // (matriz paga por todos): empresaId continua sendo a empresa
  // administradora que clica em "Assinar", mas o Stripe cobra o
  // grupo_economico_id, não a empresa isolada. Ver create-checkout-session.
  grupoEconomicoId?: string;
  plano: PlanoComTodosOsTermos;
  nomeEmpresa: string;
  cnpj: string | null;
  email: string;
  precoLabel: string;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const tipoPlano = tipoDoPlano(plano);
  const planoLabel = rotuloDoPlano(plano);
  // Calibração TMS/ERP (23/07/2026), Fase Posto/Rede (26/07/2026) e Fase
  // Grupo-Economico-Frota-Billing (09/08/2026) — cada plano (frotista,
  // posto ou grupo frota) tem sua própria Cláusula 3ª (ver
  // src/lib/termoAdesao.ts), então os parágrafos e o hash já saem prontos
  // pro plano específico deste botão.
  const paragrafosTermo =
    tipoPlano === "posto"
      ? montarParagrafosTermoAdesaoPosto(plano as PlanoPostoComTermo)
      : tipoPlano === "grupo_frota"
        ? montarParagrafosTermoAdesaoGrupoFrota(plano as PlanoGrupoFrotaComTermo)
        : montarParagrafosTermoAdesao(plano as PlanoComTermo);
  const hashTermoFallback =
    tipoPlano === "posto"
      ? HASH_TERMO_ADESAO_POSTO_POR_PLANO[plano as PlanoPostoComTermo]
      : tipoPlano === "grupo_frota"
        ? HASH_TERMO_ADESAO_GRUPO_FROTA_POR_PLANO[plano as PlanoGrupoFrotaComTermo]
        : HASH_TERMO_ADESAO_POR_PLANO[plano as PlanoComTermo];

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
