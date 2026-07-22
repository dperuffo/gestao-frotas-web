"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obterProvedorCobranca } from "@/lib/cobranca";

// Fase P0.6 (plano FNI_Plano_Implementacao_P0.md) — faturas de frete:
// agrupa CT-es autorizados (ainda não faturados) por tomador + período,
// gera o título em contas_receber e, opcionalmente, a cobrança (boleto
// simulado + PIX real) via ProvedorCobranca.

export type FaturaFreteFormState = { erro?: string } | undefined;

async function empresaPertenceAoUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email === "d.peruffo@gmail.com") return true;
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil === "admin") return true;
  const { data: minhas } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
  return (minhas ?? []).includes(empresaId);
}

export async function gerarFaturaFreteAcao(
  empresaId: string,
  _prev: FaturaFreteFormState,
  formData: FormData
): Promise<FaturaFreteFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para gerar faturas nesta empresa." };
  }

  const tomadorCnpj = String(formData.get("tomador_cnpj") ?? "").trim();
  const tomadorNome = String(formData.get("tomador_nome") ?? "").trim() || null;
  const periodoInicio = String(formData.get("periodo_inicio") ?? "").trim();
  const periodoFim = String(formData.get("periodo_fim") ?? "").trim();
  const vencimento = String(formData.get("vencimento") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

  if (!tomadorCnpj) return { erro: "Escolha um tomador." };
  if (!periodoInicio || !periodoFim) return { erro: "Informe o período (início e fim)." };
  if (!vencimento) return { erro: "Informe o vencimento." };
  if (periodoFim < periodoInicio) return { erro: "O fim do período não pode ser antes do início." };

  // Fretes desta empresa (transportadora) — fretes_cte não tem FK declarada,
  // então o join é feito manualmente em duas consultas (mesmo padrão já
  // usado no webhook fiscal).
  const { data: fretesDaEmpresa } = await supabase.from("fretes").select("id").eq("empresa_id", empresaId);
  const freteIds = (fretesDaEmpresa ?? []).map((f) => f.id);
  if (freteIds.length === 0) return { erro: "Nenhum frete encontrado para esta empresa." };

  const { data: ctes } = await supabase
    .from("fretes_cte")
    .select("id, frete_id, valor_prestacao, data_emissao")
    .in("frete_id", freteIds)
    .eq("status", "autorizado")
    .eq("tomador_cnpj", tomadorCnpj)
    .is("fatura_frete_id", null)
    .gte("data_emissao", `${periodoInicio}T00:00:00`)
    .lte("data_emissao", `${periodoFim}T23:59:59`);

  if (!ctes || ctes.length === 0) {
    return { erro: "Nenhum CT-e autorizado (ainda não faturado) encontrado para esse tomador/período." };
  }

  const valorTotal = ctes.reduce((soma, c) => soma + (c.valor_prestacao ?? 0), 0);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fatura, error: erroFatura } = await supabase
    .from("faturas_fretes")
    .insert({
      empresa_id: empresaId,
      tomador_cnpj: tomadorCnpj,
      tomador_nome: tomadorNome,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      vencimento,
      valor_total: valorTotal,
      quantidade_ctes: ctes.length,
      observacoes,
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();
  if (erroFatura || !fatura) return { erro: `Não foi possível criar a fatura: ${erroFatura?.message}` };

  const { error: erroItens } = await supabase.from("faturas_fretes_itens").insert(
    ctes.map((c) => ({
      fatura_frete_id: fatura.id,
      frete_cte_id: c.id,
      frete_id: c.frete_id,
      valor_prestacao: c.valor_prestacao ?? 0,
    }))
  );
  if (erroItens) return { erro: `Fatura criada, mas houve erro ao gravar os itens: ${erroItens.message}` };

  await supabase
    .from("fretes_cte")
    .update({ fatura_frete_id: fatura.id })
    .in(
      "id",
      ctes.map((c) => c.id)
    );

  const { error: erroConta } = await supabase.from("contas_receber").insert({
    empresa_id: empresaId,
    origem: "fatura_frete",
    referencia_id: fatura.id,
    devedor_nome: tomadorNome,
    devedor_cnpj: tomadorCnpj,
    descricao: `Fatura de fretes — ${periodoInicio} a ${periodoFim}`,
    valor_original: valorTotal,
    vencimento,
    criado_por: user?.email ?? null,
  });
  if (erroConta) return { erro: `Fatura criada, mas houve erro ao gerar o título em contas a receber: ${erroConta.message}` };

  revalidatePath("/faturas-fretes");
  revalidatePath("/financeiro");
  redirect(`/faturas-fretes/${fatura.id}?empresa=${empresaId}`);
}

export async function cancelarFaturaFreteAcao(faturaId: string, empresaId: string): Promise<{ erro?: string } | undefined> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };

  const { data: fatura } = await supabase
    .from("faturas_fretes")
    .update({ status: "cancelada", atualizado_em: new Date().toISOString() })
    .eq("id", faturaId)
    .eq("empresa_id", empresaId)
    .eq("status", "aberta")
    .select("id")
    .maybeSingle();
  if (!fatura) return { erro: "Fatura não encontrada ou já não está mais aberta." };

  // Libera os CT-es pra poderem entrar numa fatura futura.
  await supabase.from("fretes_cte").update({ fatura_frete_id: null }).eq("fatura_frete_id", faturaId);

  const { data: conta } = await supabase
    .from("contas_receber")
    .select("id")
    .eq("origem", "fatura_frete")
    .eq("referencia_id", faturaId)
    .maybeSingle();
  if (conta) await supabase.rpc("cancelar_conta_receber", { p_conta_id: conta.id });

  revalidatePath("/faturas-fretes");
  revalidatePath(`/faturas-fretes/${faturaId}`);
  revalidatePath("/financeiro");
}

export async function marcarFaturaFretePagaAcao(faturaId: string, empresaId: string): Promise<{ erro?: string } | undefined> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };

  const { data: conta } = await supabase
    .from("contas_receber")
    .select("id, valor_original, valor_pago")
    .eq("origem", "fatura_frete")
    .eq("referencia_id", faturaId)
    .maybeSingle();
  if (!conta) return { erro: "Título não encontrado pra esta fatura." };
  if (conta.valor_original <= conta.valor_pago) return { erro: "Este título já está quitado." };

  const { error } = await supabase.rpc("baixar_conta_receber", {
    p_conta_id: conta.id,
    p_valor: conta.valor_original - conta.valor_pago,
    p_forma: "manual",
  });
  if (error) return { erro: error.message };

  revalidatePath("/faturas-fretes");
  revalidatePath(`/faturas-fretes/${faturaId}`);
  revalidatePath("/financeiro");
}

// Gera boleto (simulado) + PIX (real, via src/lib/pix.ts) pra cobrança desta
// fatura, usando os dados cadastrais da própria transportadora (empresas)
// como beneficiário.
export async function gerarCobrancaFaturaFreteAcao(faturaId: string, empresaId: string): Promise<{ erro?: string } | undefined> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return { erro: "Sem permissão." };

  const { data: conta } = await supabase
    .from("contas_receber")
    .select("id, valor_original, vencimento, devedor_nome, devedor_cnpj")
    .eq("origem", "fatura_frete")
    .eq("referencia_id", faturaId)
    .maybeSingle();
  if (!conta) return { erro: "Título não encontrado pra esta fatura." };

  const { data: empresa } = await supabase
    .from("empresas")
    .select("nome, municipio, pix_chave")
    .eq("id", empresaId)
    .maybeSingle();

  const provedor = obterProvedorCobranca("mock");
  const resultado = await provedor.gerarCobranca({
    provedorRef: empresaId,
    ambiente: "homologacao",
    descricao: `Fatura de fretes ${faturaId}`,
    valor: conta.valor_original,
    vencimento: conta.vencimento,
    devedorNome: conta.devedor_nome ?? "Tomador",
    devedorCpfCnpj: conta.devedor_cnpj ?? "",
    referenciaExterna: conta.id,
    pixChaveBeneficiario: empresa?.pix_chave ?? null,
    pixNomeBeneficiario: empresa?.nome ?? null,
    pixCidadeBeneficiario: empresa?.municipio ?? null,
  });

  if (!resultado.ok) return { erro: resultado.erro };

  const { error } = await supabase
    .from("contas_receber")
    .update({
      gateway_nome: "mock",
      gateway_ref: resultado.gatewayRef,
      gateway_linha_digitavel: resultado.linhaDigitavel,
      gateway_pix_copia_cola: resultado.pixCopiaCola,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", conta.id);
  if (error) return { erro: error.message };

  revalidatePath(`/faturas-fretes/${faturaId}`);
}
