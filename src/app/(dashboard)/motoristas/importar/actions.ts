"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lerPlanilhaComoTexto } from "@/lib/xlsx";
import { normalizarCNPJ } from "@/lib/utils";
import { CLASSIFICACAO, type Classificacao } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type MotoristaInsert = Database["public"]["Tables"]["motoristas"]["Insert"];
type MotoristaUpdate = Database["public"]["Tables"]["motoristas"]["Update"];

export type LinhaResultado = {
  linha: number;
  identificacao: string;
  status: "ok" | "erro";
  mensagem: string;
};

const COLUNAS_OBRIGATORIAS = ["nome_completo", "cpf", "cnpj_cliente"];

function normalizarCpf(valor: string): string {
  return valor.replace(/[^0-9]/g, "");
}

type Irmao = { motorista_id: string; empresa_id: string; empresa_nome: string };

// Fase Indicador-Progresso-Import (12/08/2026, pedido do Daniel: mesma
// mudança aplicada em veiculos/importar/actions.ts) -- dividido em duas
// etapas pra dar pro navegador mostrar progresso real: prepararImportacaoMotoristas
// decide o que fazer com cada linha sem gravar nada, e processarLoteMotoristas
// grava só o pedaço que o navegador mandar de cada vez.
export type LinhaPreparada = {
  numeroLinha: number;
  nomeCompleto: string;
  cpf: string;
  empresaId: string;
  empresaNome: string;
  camposInsert: MotoristaInsert;
  camposUpdate: MotoristaUpdate;
  camposCaracteristicas: MotoristaUpdate;
  avisoCentroCusto: string;
  existenteProprio: { id: string; ativo: boolean } | null;
  irmaosAtivos: Irmao[];
};

export type PreparacaoImportacao =
  | { erro: string }
  | {
      totalLinhas: number;
      errosIniciais: LinhaResultado[];
      preparadas: LinhaPreparada[];
    };

export async function prepararImportacaoMotoristas(
  formData: FormData,
): Promise<PreparacaoImportacao> {
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

  const iNome = indice("nome_completo");
  const iCpf = indice("cpf");
  const iTelefone = indice("telefone");
  const iEmail = indice("email");
  const iClassificacao = indice("classificacao");
  const iCnh = indice("cnh");
  const iCnhVencimento = indice("cnh_vencimento");
  const iCentroCusto = indice("centro_custo");
  const iCnpj = indice("cnpj_cliente");

  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => indice(c) === -1);
  if (faltando.length > 0) {
    return {
      erro: `O arquivo precisa ter as colunas obrigatórias: ${COLUNAS_OBRIGATORIAS.join(", ")}. Faltando: ${faltando.join(", ")}.`,
    };
  }

  const supabase = await createClient();

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, cnpj, nome");
  const empresaIdPorCnpj = new Map<string, string>();
  const nomePorEmpresaId = new Map<string, string>();
  for (const empresa of empresas ?? []) {
    if (empresa.cnpj)
      empresaIdPorCnpj.set(normalizarCNPJ(empresa.cnpj), empresa.id);
    nomePorEmpresaId.set(empresa.id, empresa.nome);
  }

  const { data: centros } = await supabase
    .from("centros_custo")
    .select("id, nome");
  const centroIdPorNome = new Map<string, string>();
  for (const centro of centros ?? []) {
    centroIdPorNome.set(centro.nome.trim().toLowerCase(), centro.id);
  }

  type LinhaValida = {
    numeroLinha: number;
    nomeCompleto: string;
    cpf: string;
    chave: string;
    empresaId: string;
    camposInsert: MotoristaInsert;
    camposUpdate: MotoristaUpdate;
    camposCaracteristicas: MotoristaUpdate;
    avisoCentroCusto: string;
  };

  const errosIniciais: LinhaResultado[] = [];
  const validas: LinhaValida[] = [];

  // Passo 1: parseia e valida cada linha, sem gravar nada ainda.
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i];
    const numeroLinha = i + 1;

    const nomeCompleto = (colunas[iNome] ?? "").trim();
    const cpf = (colunas[iCpf] ?? "").trim();
    const telefone = iTelefone >= 0 ? (colunas[iTelefone] ?? "").trim() : "";
    const email = iEmail >= 0 ? (colunas[iEmail] ?? "").trim() : "";
    const classificacaoBruta =
      iClassificacao >= 0 ? (colunas[iClassificacao] ?? "").trim() : "";
    const classificacaoValida = CLASSIFICACAO.includes(
      classificacaoBruta as Classificacao,
    )
      ? (classificacaoBruta as Classificacao)
      : null;
    const cnh = iCnh >= 0 ? (colunas[iCnh] ?? "").trim() : "";
    const cnhVencimento =
      iCnhVencimento >= 0 ? (colunas[iCnhVencimento] ?? "").trim() : "";
    const centroCustoNomeBruto =
      iCentroCusto >= 0 ? (colunas[iCentroCusto] ?? "").trim() : "";
    const cnpjBruto = (colunas[iCnpj] ?? "").trim();

    try {
      if (!nomeCompleto || !cpf) {
        throw new Error("Nome completo e CPF são obrigatórios.");
      }
      const cnpjNormalizado = normalizarCNPJ(cnpjBruto);
      if (!cnpjNormalizado) {
        throw new Error("Informe o CNPJ do cliente (coluna cnpj_cliente).");
      }
      const empresaId = empresaIdPorCnpj.get(cnpjNormalizado);
      if (!empresaId) {
        throw new Error(`Nenhum cliente cadastrado com o CNPJ ${cnpjBruto}.`);
      }

      let centroCustoId: string | null = null;
      let avisoCentroCusto = "";
      if (centroCustoNomeBruto) {
        centroCustoId =
          centroIdPorNome.get(centroCustoNomeBruto.toLowerCase()) ?? null;
        if (!centroCustoId) {
          avisoCentroCusto = ` (centro de custo "${centroCustoNomeBruto}" não encontrado — deixado como estava)`;
        }
      }

      const camposInsert: MotoristaInsert = {
        empresa_id: empresaId,
        nome_completo: nomeCompleto,
        cpf,
        telefone: telefone || null,
        email: email || null,
        classificacao: classificacaoValida ?? "Próprio",
        cnh: cnh || null,
        cnh_vencimento: cnhVencimento || null,
        centro_custo_id: centroCustoId,
        status: "Ativo",
      };
      const camposCaracteristicas: MotoristaUpdate = {
        nome_completo: nomeCompleto,
      };
      if (telefone) camposCaracteristicas.telefone = telefone;
      if (email) camposCaracteristicas.email = email;
      if (cnh) camposCaracteristicas.cnh = cnh;
      if (cnhVencimento) camposCaracteristicas.cnh_vencimento = cnhVencimento;

      const camposUpdate: MotoristaUpdate = { ...camposCaracteristicas };
      if (classificacaoValida) camposUpdate.classificacao = classificacaoValida;
      if (centroCustoId) camposUpdate.centro_custo_id = centroCustoId;

      validas.push({
        numeroLinha,
        nomeCompleto,
        cpf,
        chave: `${empresaId}|${normalizarCpf(cpf)}`,
        empresaId,
        camposInsert,
        camposUpdate,
        camposCaracteristicas,
        avisoCentroCusto,
      });
    } catch (e) {
      errosIniciais.push({
        linha: numeroLinha,
        identificacao: nomeCompleto || cpf || "(sem identificação)",
        status: "erro",
        mensagem: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  // Passo 2: ids do grupo econômico de cada empresa envolvida (1 chamada
  // por empresa, não por linha), e então os motoristas de TODAS as
  // empresas relevantes (as da planilha + as dos grupos delas) numa
  // consulta só.
  const empresaIdsEnvolvidas = [...new Set(validas.map((v) => v.empresaId))];
  const grupoIdsPorEmpresa = new Map<string, Set<string>>();
  const todasEmpresaIds = new Set<string>(empresaIdsEnvolvidas);
  for (const empresaId of empresaIdsEnvolvidas) {
    const { data: grupoIds } = await supabase.rpc("grupo_ids_da_empresa", {
      p_empresa_id: empresaId,
    });
    const set = new Set(grupoIds ?? []);
    grupoIdsPorEmpresa.set(empresaId, set);
    for (const gid of set) todasEmpresaIds.add(gid);
  }

  const { data: existentes } =
    todasEmpresaIds.size > 0
      ? await supabase
          .from("motoristas")
          .select("id, empresa_id, cpf, status")
          .in("empresa_id", [...todasEmpresaIds])
      : { data: [] };
  const existentePorChave = new Map<string, { id: string; ativo: boolean }>();
  const existentesPorCpfNorm = new Map<
    string,
    { id: string; empresa_id: string; ativo: boolean }[]
  >();
  for (const m of existentes ?? []) {
    if (!m.cpf) continue;
    const cpfNorm = normalizarCpf(m.cpf);
    const ativo = m.status === "Ativo";
    existentePorChave.set(`${m.empresa_id}|${cpfNorm}`, { id: m.id, ativo });
    const lista = existentesPorCpfNorm.get(cpfNorm) ?? [];
    lista.push({ id: m.id, empresa_id: m.empresa_id, ativo });
    existentesPorCpfNorm.set(cpfNorm, lista);
  }

  function irmaosAtivosDoGrupo(v: LinhaValida): Irmao[] {
    const grupoIds = grupoIdsPorEmpresa.get(v.empresaId) ?? new Set<string>();
    const candidatos = existentesPorCpfNorm.get(normalizarCpf(v.cpf)) ?? [];
    const irmaos: Irmao[] = [];
    for (const c of candidatos) {
      if (!c.ativo || c.empresa_id === v.empresaId) continue;
      if (!grupoIds.has(c.empresa_id)) continue;
      irmaos.push({
        motorista_id: c.id,
        empresa_id: c.empresa_id,
        empresa_nome: nomePorEmpresaId.get(c.empresa_id) ?? "",
      });
    }
    return irmaos;
  }

  const preparadas: LinhaPreparada[] = validas.map((v) => {
    const existenteProprio = existentePorChave.get(v.chave) ?? null;
    const temCaracteristicas = Object.keys(v.camposCaracteristicas).length > 0;
    const irmaosAtivos = temCaracteristicas ? irmaosAtivosDoGrupo(v) : [];
    return {
      numeroLinha: v.numeroLinha,
      nomeCompleto: v.nomeCompleto,
      cpf: v.cpf,
      empresaId: v.empresaId,
      empresaNome: nomePorEmpresaId.get(v.empresaId) ?? "empresa desta linha",
      camposInsert: v.camposInsert,
      camposUpdate: v.camposUpdate,
      camposCaracteristicas: v.camposCaracteristicas,
      avisoCentroCusto: v.avisoCentroCusto,
      existenteProprio,
      irmaosAtivos,
    };
  });

  return {
    totalLinhas: preparadas.length + errosIniciais.length,
    errosIniciais,
    preparadas,
  };
}

export async function processarLoteMotoristas(
  lote: LinhaPreparada[],
): Promise<LinhaResultado[]> {
  const supabase = await createClient();
  const resultado: LinhaResultado[] = [];

  await Promise.all(
    lote.map(async (v) => {
      const temCaracteristicas =
        Object.keys(v.camposCaracteristicas).length > 0;
      let redirecionadoPara: string | null = null;
      let avisoSincronizacao = "";
      try {
        if (v.existenteProprio?.ativo) {
          const { error } = await supabase
            .from("motoristas")
            .update(v.camposUpdate)
            .eq("id", v.existenteProprio.id);
          if (error) throw new Error(error.message);
        } else if (v.irmaosAtivos.length > 0) {
          const nomes: string[] = [];
          for (const irmao of v.irmaosAtivos) {
            const { error: erroIrmao } = await supabase
              .from("motoristas")
              .update(v.camposCaracteristicas)
              .eq("id", irmao.motorista_id);
            if (!erroIrmao) nomes.push(irmao.empresa_nome);
          }
          if (nomes.length > 0) redirecionadoPara = nomes.join(", ");
        } else if (v.existenteProprio) {
          const { error } = await supabase
            .from("motoristas")
            .update(v.camposUpdate)
            .eq("id", v.existenteProprio.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase
            .from("motoristas")
            .insert(v.camposInsert);
          if (error) throw new Error(error.message);
        }

        if (!redirecionadoPara && temCaracteristicas) {
          const nomesSincronizados: string[] = [];
          for (const irmao of v.irmaosAtivos) {
            const { error: erroIrmao } = await supabase
              .from("motoristas")
              .update(v.camposCaracteristicas)
              .eq("id", irmao.motorista_id);
            if (!erroIrmao) nomesSincronizados.push(irmao.empresa_nome);
          }
          if (nomesSincronizados.length > 0) {
            avisoSincronizacao = ` Também sincronizado em: ${nomesSincronizados.join(", ")}.`;
          }
        }

        resultado.push({
          linha: v.numeroLinha,
          identificacao: `${v.nomeCompleto} (${v.cpf})`,
          status: "ok",
          mensagem: redirecionadoPara
            ? `Este motorista já está Ativo na empresa "${redirecionadoPara}" (mesmo grupo econômico) — dados pessoais/CNH atualizados lá. Nenhum registro foi criado/alterado em "${v.empresaNome}" pra evitar duplicidade; campos específicos desta empresa (classificação, centro de custo, status) não se aplicam.`
            : v.existenteProprio
              ? `Motorista já cadastrado — dados atualizados.${v.avisoCentroCusto}${avisoSincronizacao}`
              : `Importado com sucesso.${v.avisoCentroCusto}${avisoSincronizacao}`,
        });
      } catch (e) {
        resultado.push({
          linha: v.numeroLinha,
          identificacao: `${v.nomeCompleto} (${v.cpf})`,
          status: "erro",
          mensagem: e instanceof Error ? e.message : "Erro desconhecido.",
        });
      }
    }),
  );

  revalidatePath("/motoristas");
  return resultado;
}
