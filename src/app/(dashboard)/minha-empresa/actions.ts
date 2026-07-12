"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Fase 27.92 — pedido do Daniel: cada posto cadastra a própria chave PIX
// (self-service), usada como "cedente" no boleto/documento de cobrança das
// faturas fechadas com clientes. RLS de `empresas` (empresas_update_admin,
// apesar do nome, já libera UPDATE pra qualquer membro da própria empresa —
// não só admin) garante que só quem pertence a esta empresa (ou admin)
// consegue salvar.
export async function atualizarPixChaveAcao(empresaId: string, pixChave: string) {
  const supabase = await createClient();

  const valor = pixChave.trim();
  if (valor.length > 140) {
    throw new Error("Chave PIX muito longa (máximo 140 caracteres).");
  }

  const { error } = await supabase
    .from("empresas")
    .update({ pix_chave: valor || null })
    .eq("id", empresaId);

  if (error) {
    throw new Error(`Erro ao salvar chave PIX: ${error.message}`);
  }

  revalidatePath("/minha-empresa");
}

export type DadosBancarios = {
  bancoCodigo: string;
  bancoNome: string;
  agencia: string;
  agenciaDigito: string;
  conta: string;
  contaDigito: string;
  tipoConta: "" | "corrente" | "poupanca";
  titularNome: string;
  titularDocumento: string;
};

// Fase 27.141 — pedido do Daniel: cada posto cadastra os próprios dados
// bancários (self-service), pra futuramente servir de base ao ajuste de
// layout de boleto conforme o domicílio bancário do estabelecimento. Por
// enquanto é só captura — nenhuma lógica de boleto lê esses campos ainda.
// Mesma RLS de `empresas` da chave PIX (empresas_update_admin libera UPDATE
// pra qualquer membro da própria empresa, não só admin).
export async function atualizarDadosBancariosAcao(empresaId: string, dados: DadosBancarios) {
  const supabase = await createClient();

  if (dados.tipoConta && dados.tipoConta !== "corrente" && dados.tipoConta !== "poupanca") {
    throw new Error("Tipo de conta inválido.");
  }

  const limpar = (v: string, max: number) => {
    const t = v.trim();
    if (t.length > max) {
      throw new Error(`Campo excede o tamanho máximo de ${max} caracteres.`);
    }
    return t || null;
  };

  const { error } = await supabase
    .from("empresas")
    .update({
      banco_codigo: limpar(dados.bancoCodigo, 10),
      banco_nome: limpar(dados.bancoNome, 140),
      agencia: limpar(dados.agencia, 20),
      agencia_digito: limpar(dados.agenciaDigito, 5),
      conta: limpar(dados.conta, 30),
      conta_digito: limpar(dados.contaDigito, 5),
      tipo_conta: dados.tipoConta || null,
      titular_nome: limpar(dados.titularNome, 140),
      titular_documento: limpar(dados.titularDocumento, 20),
    })
    .eq("id", empresaId);

  if (error) {
    throw new Error(`Erro ao salvar dados bancários: ${error.message}`);
  }

  revalidatePath("/minha-empresa");
}
