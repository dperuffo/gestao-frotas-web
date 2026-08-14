import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lerAba, indiceColunas, texto, textoOuNull, numero, simNao, dedupePorChave } from "@/lib/xlsx";
import { normalizarCNPJ, resolverUf } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import { verificarLimite, ipDaRequisicao, respostaLimiteExcedido } from "@/lib/rateLimit";

export type ResultadoImportacaoAnp =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; ativosNaRede: number; duplicadas: number };

type LinhaAnp = Database["public"]["Tables"]["anp_postos"]["Insert"];

const COLUNAS_OBRIGATORIAS = ["cnpj", "uf", "municipio", "razao social"];

// Fase corrige-bloqueio-cloudflare-waf — mesma razão do route.ts de
// /api/postos/importar: trocado de Server Action pra Route Handler pra
// escapar da regra do WAF que confunde o protocolo de Server Actions com o
// CVE-2025-55183 (já corrigido nesta versão do Next, mas o Free plan da
// Cloudflare não deixa criar exceção pra essa regra).
//
// Importa o universo nacional de postos ANP (planilha recorrente
// "postos_anp.xlsx", ~35 mil linhas). A coluna "Gestão de Frotas" (SIM/vazio)
// indica quais desses postos fazem parte da rede negociada — é o próprio
// indicador de ativação, mantido aqui para consulta na tela de Postos.
// Restrito a administradores: é dado nacional compartilhado, não por cliente.
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") {
    return NextResponse.json<ResultadoImportacaoAnp>({
      erro: "Apenas administradores podem importar o universo de postos ANP.",
    });
  }

  // M2 — protege processamento pesado (planilha nacional, ~35 mil linhas).
  const limite = verificarLimite(`importar-anp:${ipDaRequisicao(request)}`, 10, 10 * 60 * 1000);
  if (!limite.permitido) return respostaLimiteExcedido(limite);

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json<ResultadoImportacaoAnp>({ erro: "Selecione o arquivo postos_anp.xlsx." });
  }

  const buffer = await arquivo.arrayBuffer();
  const linhas = lerAba(buffer);
  if (linhas.length < 2) {
    return NextResponse.json<ResultadoImportacaoAnp>({ erro: "A planilha está vazia ou não tem nenhuma linha de dados." });
  }

  const idx = indiceColunas(linhas[0]);
  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !idx.has(c));
  if (faltando.length > 0) {
    return NextResponse.json<ResultadoImportacaoAnp>({
      erro: `Colunas obrigatórias ausentes na planilha: ${faltando.join(", ")}. Confira se o arquivo é o modelo "postos_anp.xlsx" (aba "Postos ANP").`,
    });
  }

  const pegar = (linha: unknown[], nomeColuna: string) => {
    const i = idx.get(nomeColuna);
    return i === undefined ? undefined : linha[i];
  };

  const registros: LinhaAnp[] = [];
  let erros = 0;

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const cnpj = normalizarCNPJ(texto(pegar(linha, "cnpj")));
    if (!cnpj) {
      erros++;
      continue;
    }
    registros.push({
      cnpj,
      uf: resolverUf(textoOuNull(pegar(linha, "uf"))),
      municipio: textoOuNull(pegar(linha, "municipio")),
      razao_social: textoOuNull(pegar(linha, "razao social")),
      bandeira: textoOuNull(pegar(linha, "distribuidora / bandeira")),
      endereco: textoOuNull(pegar(linha, "endereco")),
      bairro: textoOuNull(pegar(linha, "bairro")),
      cep: textoOuNull(pegar(linha, "cep")),
      latitude: numero(pegar(linha, "latitude")),
      longitude: numero(pegar(linha, "longitude")),
      autorizacao_anp: textoOuNull(pegar(linha, "autorizacao anp")),
      situacao: textoOuNull(pegar(linha, "situacao")),
      status_sigaf: textoOuNull(pegar(linha, "status sigaf")),
      gestao_frotas: simNao(pegar(linha, "gestao de frotas")),
      ativo: true,
    });
  }

  const registrosSemDuplicata = dedupePorChave(registros, (r) => r.cnpj as string);
  const duplicadas = registros.length - registrosSemDuplicata.length;

  let sucesso = 0;
  let ativosNaRede = 0;
  const tamanhoLote = 1000;
  for (let i = 0; i < registrosSemDuplicata.length; i += tamanhoLote) {
    const lote = registrosSemDuplicata.slice(i, i + tamanhoLote);
    const { error } = await supabase.from("anp_postos").upsert(lote, { onConflict: "cnpj" });
    if (error) {
      return NextResponse.json<ResultadoImportacaoAnp>({
        erro: `Falha ao gravar a partir da linha ${i + 2}: ${error.message}. Linhas já gravadas até aqui foram mantidas.`,
      });
    }
    sucesso += lote.length;
    ativosNaRede += lote.filter((r) => r.gestao_frotas).length;
  }

  revalidatePath("/postos");

  return NextResponse.json<ResultadoImportacaoAnp>({ total: linhas.length - 1, sucesso, erros, ativosNaRede, duplicadas });
}
