"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerAba, texto, numero, inteiro, data as celulaData, dedupePorChave } from "@/lib/xlsx";
import type { Database } from "@/types/database.types";

// Fase P0.5 — importação do piso mínimo de frete (Res. ANTT 5.867/2020).
// Tabela NACIONAL (não é por tenant, ver migração fase_p0_5_pisos_antt) —
// só quem tem perfil admin pode importar (checado aqui e também via RLS).
// Colunas da planilha, na ordem esperada (ver modelo/route.ts):
// 0 Tipo de Carga · 1 Nº de Eixos · 2 Coeficiente de Deslocamento (R$/km) ·
// 3 Coeficiente de Carga/Descarga (R$) · 4 Vigência
const COL = {
  tipoCarga: 0,
  numeroEixos: 1,
  coeficienteDeslocamento: 2,
  coeficienteCargaDescarga: 3,
  vigencia: 4,
} as const;

type LinhaPiso = Database["public"]["Tables"]["pisos_antt"]["Insert"];

export type ResultadoImportacaoPisosAntt =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; duplicadas: number };

export async function importarPisosAntt(
  _prev: ResultadoImportacaoPisosAntt | undefined,
  formData: FormData
): Promise<ResultadoImportacaoPisosAntt> {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") {
    return { erro: "Esta importação é exclusiva do time interno (perfil administrador)." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione a planilha do piso mínimo ANTT (.xlsx)." };
  }

  const buffer = await arquivo.arrayBuffer();
  const linhasDaAba = lerAba(buffer, "Piso ANTT");
  const linhas = linhasDaAba.length > 0 ? linhasDaAba : lerAba(buffer);
  if (linhas.length < 2) {
    return { erro: "A planilha está vazia ou não tem nenhuma linha de dados." };
  }

  const primeiraCelula = texto(linhas[0][COL.tipoCarga]).toLowerCase();
  if (!primeiraCelula.includes("tipo")) {
    return {
      erro: 'A primeira coluna da planilha precisa ser "Tipo de Carga" — confira se o arquivo enviado segue o modelo (aba "Piso ANTT").',
    };
  }

  const registros: LinhaPiso[] = [];
  let erros = 0;

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const tipoCarga = texto(linha[COL.tipoCarga]);
    const numeroEixos = inteiro(linha[COL.numeroEixos]);
    const coeficienteDeslocamento = numero(linha[COL.coeficienteDeslocamento]);
    const coeficienteCargaDescarga = numero(linha[COL.coeficienteCargaDescarga]) ?? 0;

    if (!tipoCarga || numeroEixos === null || numeroEixos <= 0 || coeficienteDeslocamento === null) {
      erros++;
      continue;
    }

    registros.push({
      tipo_carga: tipoCarga,
      numero_eixos: numeroEixos,
      coeficiente_deslocamento: coeficienteDeslocamento,
      coeficiente_carga_descarga: coeficienteCargaDescarga,
      vigencia_inicio: celulaData(linha[COL.vigencia]) ?? new Date().toISOString().slice(0, 10),
    });
  }

  // Mesma combinação tipo_carga+numero_eixos pode se repetir na planilha (ex:
  // exportação com linhas duplicadas) — o Postgres recusa upsert nesse caso.
  const registrosSemDuplicata = dedupePorChave(registros, (r) => `${r.tipo_carga}__${r.numero_eixos}`);
  const duplicadas = registros.length - registrosSemDuplicata.length;

  // Tabela nacional, sem empresa_id — usa o cliente com service role pra não
  // depender de RLS por tenant (mesmo raciocínio de historico_precos).
  const admin = createAdminClient();
  const { error } = await admin
    .from("pisos_antt")
    .upsert(registrosSemDuplicata, { onConflict: "tipo_carga,numero_eixos" });
  if (error) {
    return { erro: `Falha ao gravar: ${error.message}` };
  }

  revalidatePath("/administracao/pisos-antt");
  revalidatePath("/cotacoes");

  return { total: linhas.length - 1, sucesso: registrosSemDuplicata.length, erros, duplicadas };
}

export async function excluirPisoAntt(id: string) {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") return { erro: "Sem permissão." };

  const admin = createAdminClient();
  const { error } = await admin.from("pisos_antt").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidatePath("/administracao/pisos-antt");
}
