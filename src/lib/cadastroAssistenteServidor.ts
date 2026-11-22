import type { createClient } from "@/lib/supabase/server";
import { normalizarTexto } from "@/lib/utils";
import { carregarMapaPermissoes, ehBypassPermissao, temAcesso } from "@/lib/permissoes";
import {
  calcularMudancas,
  descreverCadastro,
  normalizarPlaca,
  type CadastroValido,
  type CamposCadastro,
  type MudancaCadastro,
} from "@/lib/cadastroAssistente";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Linha = Record<string, unknown>;

// Perfis que mantêm cadastros de frota (cliente). Posto e colaborador não.
const PERFIS_CADASTRO = new Set(["admin", "gestor_frota", "analista"]);

const FUNCIONALIDADE: Record<CadastroValido["entidade"], string> = {
  veiculo: "aba_veiculos",
  motorista: "aba_motoristas",
};

export type CadastroPreparado = {
  registroId: string | null; // null quando a ação é "criar"
  alvo: string; // texto para mostrar ao usuário (placa ou nome)
  mudancas: MudancaCadastro[];
  aviso: string | null;
  resumo: string;
  // Contexto interno para gravar sem nova consulta.
  empresaCnpj: string | null;
};

// Confere perfil + permissão da funcionalidade (mesma matriz usada no menu) para
// a empresa escolhida. A RLS das tabelas continua sendo a trava final.
export async function conferirPermissaoCadastro(
  supabase: Supabase,
  entidade: CadastroValido["entidade"],
  perfil: string | null,
  email: string | null | undefined,
  empresaId: string
): Promise<string | null> {
  if (ehBypassPermissao(perfil, email)) return null;
  if (!perfil || !PERFIS_CADASTRO.has(perfil)) {
    return "Seu perfil não pode alterar cadastros de frota.";
  }
  const mapa = await carregarMapaPermissoes(supabase, perfil, [empresaId]);
  if (!temAcesso(mapa, FUNCIONALIDADE[entidade])) {
    return `Seu perfil não tem acesso a ${entidade === "veiculo" ? "Veículos" : "Motoristas"}.`;
  }
  return null;
}

const mascararCpf = (cpf: unknown) => {
  const d = String(cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.***-${d.slice(9)}` : "sem CPF";
};

// Resolve o cadastro existente (alterar/inativar/reativar), checa duplicidade e
// monta a descrição do que vai mudar. Só leitura. Devolve { erro } com texto
// claro quando algo impede a ação.
export async function prepararCadastro(
  supabase: Supabase,
  empresaId: string,
  v: CadastroValido
): Promise<CadastroPreparado | { erro: string }> {
  const { data: empresa } = await supabase.from("empresas").select("id, nome, cnpj").eq("id", empresaId).maybeSingle();
  if (!empresa) return { erro: "Não encontrei essa empresa (ou você não tem acesso a ela)." };

  return v.entidade === "veiculo"
    ? prepararVeiculo(supabase, empresa, v)
    : prepararMotorista(supabase, empresa, v);
}

async function prepararVeiculo(
  supabase: Supabase,
  empresa: { id: string; cnpj: string | null },
  v: CadastroValido
): Promise<CadastroPreparado | { erro: string }> {
  if (!empresa.cnpj) return { erro: "A empresa não tem CNPJ cadastrado, então não dá para cadastrar veículos nela." };

  const { data: lista } = await supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresa.id });
  const veiculos = (lista ?? []) as unknown as Linha[];
  const existente = veiculos.find((x) => normalizarPlaca(x.placa) === v.identificador) ?? null;

  if (v.acao === "criar") {
    if (existente) return { erro: `Já existe um veículo com a placa ${v.identificador} nesta empresa.` };
    const { data: duplicado } = await supabase.rpc("veiculo_duplicado", { p_cnpj_frota: empresa.cnpj, p_placa: v.identificador });
    if (duplicado) {
      return { erro: `A placa ${v.identificador} já está cadastrada nesta empresa ou em outra empresa do mesmo grupo econômico.` };
    }
    const mudancas = calcularMudancas("veiculo", {}, v.campos);
    return { registroId: null, alvo: v.identificador, mudancas, aviso: null, resumo: descreverCadastro(v, v.identificador, mudancas), empresaCnpj: empresa.cnpj };
  }

  if (!existente) return { erro: `Não encontrei veículo com a placa ${v.identificador} nesta empresa.` };
  const id = String(existente.id);

  if (v.acao === "inativar" && existente.ativo === false) return { erro: `O veículo ${v.identificador} já está inativo.` };
  if (v.acao === "reativar" && existente.ativo !== false) return { erro: `O veículo ${v.identificador} já está ativo.` };

  let mudancas: MudancaCadastro[] = [];
  if (v.acao === "alterar") {
    mudancas = calcularMudancas("veiculo", existente, v.campos);
    if (mudancas.length === 0) return { erro: "Os valores informados já são os que estão cadastrados; nada para alterar." };
    const novaPlaca = typeof v.campos.placa === "string" ? v.campos.placa : null;
    if (novaPlaca && novaPlaca !== v.identificador) {
      const { data: duplicado } = await supabase.rpc("veiculo_duplicado", {
        p_cnpj_frota: empresa.cnpj,
        p_placa: novaPlaca,
        p_excluir_id: id,
      });
      if (duplicado) return { erro: `A placa ${novaPlaca} já está cadastrada nesta empresa ou em outra do mesmo grupo econômico.` };
    }
  }
  return {
    registroId: id,
    alvo: v.identificador,
    mudancas,
    aviso: null,
    resumo: descreverCadastro(v, v.identificador, mudancas),
    empresaCnpj: empresa.cnpj,
  };
}

async function prepararMotorista(
  supabase: Supabase,
  empresa: { id: string; cnpj: string | null },
  v: CadastroValido
): Promise<CadastroPreparado | { erro: string }> {
  if (v.acao === "criar") {
    const cpf = String(v.campos.cpf);
    const { data: duplicado } = await supabase.rpc("motorista_duplicado", { p_empresa_id: empresa.id, p_cpf: cpf });
    if (duplicado) return { erro: "Já existe um motorista com esse CPF nesta empresa." };
    const nome = String(v.campos.nome_completo);
    const mudancas = calcularMudancas("motorista", {}, v.campos);
    return { registroId: null, alvo: nome, mudancas, aviso: null, resumo: descreverCadastro(v, nome, mudancas), empresaCnpj: empresa.cnpj };
  }

  const { data: lista } = await supabase
    .from("motoristas")
    .select("id, nome_completo, cpf, telefone, email, cnh, cnh_vencimento, exame_toxicologico_vencimento, aso_vencimento, classificacao, status, auth_user_id")
    .eq("empresa_id", empresa.id)
    .limit(5000);
  const motoristas = (lista ?? []) as unknown as Linha[];

  const porCpf = /^\d{11}$/.test(v.identificador);
  const alvoNorm = normalizarTexto(v.identificador);
  const candidatos = porCpf
    ? motoristas.filter((m) => String(m.cpf ?? "").replace(/\D/g, "") === v.identificador)
    : motoristas.filter((m) => normalizarTexto(String(m.nome_completo ?? "")).includes(alvoNorm));

  if (candidatos.length === 0) return { erro: `Não encontrei motorista ${porCpf ? "com esse CPF" : `com o nome “${v.identificador}”`} nesta empresa.` };
  if (candidatos.length > 1) {
    const exemplos = candidatos.slice(0, 5).map((m) => `${m.nome_completo} (${mascararCpf(m.cpf)})`).join("; ");
    return { erro: `Encontrei ${candidatos.length} motoristas com esse nome: ${exemplos}. Informe o CPF do motorista desejado.` };
  }

  const existente = candidatos[0];
  const id = String(existente.id);
  const nome = String(existente.nome_completo);

  if (v.acao === "inativar" && existente.status === "Inativo") return { erro: `O motorista ${nome} já está inativo.` };
  if (v.acao === "reativar" && existente.status !== "Inativo") return { erro: `O motorista ${nome} já está ativo.` };

  let mudancas: MudancaCadastro[] = [];
  if (v.acao === "alterar") {
    mudancas = calcularMudancas("motorista", existente, v.campos);
    if (mudancas.length === 0) return { erro: "Os valores informados já são os que estão cadastrados; nada para alterar." };
    const novoCpf = typeof v.campos.cpf === "string" ? v.campos.cpf : null;
    if (novoCpf && novoCpf !== String(existente.cpf ?? "").replace(/\D/g, "")) {
      const { data: duplicado } = await supabase.rpc("motorista_duplicado", { p_empresa_id: empresa.id, p_cpf: novoCpf, p_excluir_id: id });
      if (duplicado) return { erro: "Esse CPF já está cadastrado em outro motorista desta empresa." };
    }
  }

  return {
    registroId: id,
    alvo: nome,
    mudancas,
    aviso: v.acao === "inativar" && existente.auth_user_id ? "Este motorista tem acesso ao app do motorista." : null,
    resumo: descreverCadastro(v, nome, mudancas),
    empresaCnpj: empresa.cnpj,
  };
}

// Grava no banco com o cliente da sessão do usuário (RLS). Devolve texto de erro ou null.
export async function gravarCadastro(
  supabase: Supabase,
  empresaId: string,
  v: CadastroValido,
  preparado: CadastroPreparado,
  email: string | null | undefined
): Promise<{ erro: string } | { id: string }> {
  const tabela = v.entidade === "veiculo" ? "cadastro_veiculos" : "motoristas";
  const campos: CamposCadastro = v.campos;

  if (v.acao === "criar") {
    const linha =
      v.entidade === "veiculo"
        ? { classificacao: "Próprio", ...campos, cnpj_frota: preparado.empresaCnpj, ativo: true, criado_por: email ?? null }
        : { classificacao: "Próprio", ...campos, empresa_id: empresaId, status: "Ativo", criado_por: email ?? null };
    const { data, error } = await supabase.from(tabela).insert(linha as never).select("id").single();
    if (error) {
      if (error.code === "23505") return { erro: "Esse cadastro já existe (placa ou CPF duplicado)." };
      return { erro: `Não foi possível salvar: ${error.message}` };
    }
    return { id: String((data as { id: string }).id) };
  }

  const id = preparado.registroId;
  if (!id) return { erro: "Cadastro não identificado." };

  let alteracao: Record<string, unknown>;
  if (v.acao === "alterar") {
    // Qualquer edição conta como revisão do cadastro (igual às telas de edição).
    alteracao = { ...campos, pendente_revisao: false };
  } else {
    const ativo = v.acao === "reativar";
    alteracao = v.entidade === "veiculo" ? { ativo } : { status: ativo ? "Ativo" : "Inativo" };
  }

  const { data, error } = await supabase.from(tabela).update(alteracao as never).eq("id", id).select("id");
  if (error) {
    if (error.code === "23505") return { erro: "Placa ou CPF já cadastrado em outro registro." };
    return { erro: `Não foi possível salvar: ${error.message}` };
  }
  // RLS pode filtrar em silêncio: nenhuma linha afetada = sem permissão sobre esse registro.
  if (!data || data.length === 0) return { erro: "Não consegui atualizar esse cadastro (sem permissão ou ele foi removido)." };
  return { id };
}
