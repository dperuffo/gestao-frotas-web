"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerPlanilhaComoTexto } from "@/lib/xlsx";
import { normalizarCNPJ } from "@/lib/utils";
import { PERFIS, type Perfil } from "@/lib/constants";

export type LinhaResultado = {
  linha: number;
  email: string;
  status: "ok" | "erro";
  mensagem: string;
};

export type ResultadoImportacao =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; linhas: LinhaResultado[] };

const COLUNAS_OBRIGATORIAS = ["nome", "email", "perfil", "cnpj_cliente"];

export async function importarUsuarios(
  _prev: ResultadoImportacao | undefined,
  formData: FormData
): Promise<ResultadoImportacao> {
  // Achado real de segurança (26/07/2026) — mesma falha de criarUsuario em
  // ../actions.ts: esta importação em lote usa o cliente ADMIN (bypassa
  // RLS) sem checar quem está chamando. Sem esta guarda, qualquer perfil
  // conseguia importar uma planilha inteira de usuários "admin" pra
  // qualquer cliente.
  const supabaseSessao = await createClient();
  const { data: perfilChamador } = await supabaseSessao.rpc("perfil_usuario_atual");
  if (perfilChamador !== "admin" && perfilChamador !== "analista") {
    return { erro: "Esta ação é exclusiva do time interno (perfil administrador ou analista)." };
  }

  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione um arquivo Excel (.xlsx) para importar." };
  }

  const buffer = await arquivo.arrayBuffer();
  const linhas = lerPlanilhaComoTexto(buffer);

  if (linhas.length < 2) {
    return { erro: "O arquivo está vazio ou não tem nenhuma linha de dados." };
  }

  const cabecalho = linhas[0].map((c) => c.trim().toLowerCase());
  const indice = (nomeColuna: string) => cabecalho.indexOf(nomeColuna);

  const iNome = indice("nome");
  const iEmail = indice("email");
  const iCpf = indice("cpf");
  const iTelefone = indice("telefone");
  const iPerfil = indice("perfil");
  const iSegmento = indice("segmento");
  const iCnpj = indice("cnpj_cliente");

  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => indice(c) === -1);
  if (faltando.length > 0) {
    return {
      erro: `O arquivo precisa ter as colunas obrigatórias: ${COLUNAS_OBRIGATORIAS.join(", ")}. Faltando: ${faltando.join(", ")}.`,
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao inicializar cliente administrativo." };
  }

  // Busca todas as empresas de uma vez, para casar o CNPJ da planilha com o empresa_id.
  const { data: empresas } = await admin.from("empresas").select("id, cnpj");
  const empresaIdPorCnpj = new Map<string, string>();
  for (const empresa of empresas ?? []) {
    if (empresa.cnpj) {
      empresaIdPorCnpj.set(normalizarCNPJ(empresa.cnpj), empresa.id);
    }
  }

  const resultado: LinhaResultado[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i];
    const numeroLinha = i + 1; // linha 1 é o cabeçalho, então os dados começam na linha 2.

    const nome = (colunas[iNome] ?? "").trim();
    const email = (colunas[iEmail] ?? "").trim().toLowerCase();
    const cpf = iCpf >= 0 ? (colunas[iCpf] ?? "").trim() || null : null;
    const telefone = iTelefone >= 0 ? (colunas[iTelefone] ?? "").trim() || null : null;
    const perfil = (colunas[iPerfil] ?? "").trim().toLowerCase();
    const segmento = iSegmento >= 0 ? (colunas[iSegmento] ?? "").trim() || null : null;
    const cnpjBruto = (colunas[iCnpj] ?? "").trim();
    const cnpjNormalizado = normalizarCNPJ(cnpjBruto);

    try {
      if (!nome || !email) {
        throw new Error("Nome e e-mail são obrigatórios.");
      }
      if (!PERFIS.includes(perfil as Perfil)) {
        throw new Error(`Perfil inválido ("${perfil}"). Use um destes: ${PERFIS.join(", ")}.`);
      }
      if (!cnpjNormalizado) {
        throw new Error("Informe o CNPJ do cliente (coluna cnpj_cliente).");
      }
      const empresaId = empresaIdPorCnpj.get(cnpjNormalizado);
      if (!empresaId) {
        throw new Error(`Nenhum cliente cadastrado com o CNPJ ${cnpjBruto}.`);
      }

      const { error: authError } = await admin.auth.admin.inviteUserByEmail(email);
      if (authError && !authError.message.toLowerCase().includes("already been registered")) {
        throw new Error(`Não foi possível convidar por e-mail: ${authError.message}`);
      }

      const { error: perfilError } = await admin
        .from("usuarios_app")
        .upsert({ email, nome, perfil, cpf, telefone, segmento, ativo: true }, { onConflict: "email" });
      if (perfilError) {
        throw new Error(`Erro ao salvar o perfil: ${perfilError.message}`);
      }

      const { error: vinculoError } = await admin
        .from("usuarios_empresas")
        .upsert({ user_email: email, empresa_id: empresaId, role: perfil, ativo: true });
      if (vinculoError) {
        throw new Error(`Erro ao vincular ao cliente: ${vinculoError.message}`);
      }

      resultado.push({ linha: numeroLinha, email: email || "(sem e-mail)", status: "ok", mensagem: "Importado com sucesso." });
    } catch (e) {
      resultado.push({
        linha: numeroLinha,
        email: email || "(sem e-mail)",
        status: "erro",
        mensagem: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  revalidatePath("/usuarios");

  return {
    total: resultado.length,
    sucesso: resultado.filter((r) => r.status === "ok").length,
    erros: resultado.filter((r) => r.status === "erro").length,
    linhas: resultado,
  };
}
