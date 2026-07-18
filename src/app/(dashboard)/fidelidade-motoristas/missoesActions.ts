"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { eMetricaValida, eIconeValido, metricaEhBinaria } from "@/lib/fidelidadeMissoes";

// Missões de gamificação do programa "Estrada que Cuida" (Fase 17/07-4,
// ampliado na Fase 17/07-5) — pedido do Daniel: "quero que o cliente tenha
// uma tela para criar mais missões" e depois "dar a opção para os usuários
// cliente e posto de aplicar as missões para o grupo econômico (clientes) e
// rede de postos (postos)".
//
// Dois modos de criação:
// - "empresa" (cliente, em /fidelidade-motoristas): missão vale só pros
//   motoristas da própria empresa — com a opção de marcar
//   aplica_grupo_economico pra valer também pras empresas "irmãs" do mesmo
//   grupo econômico (uma ÚNICA definição compartilhada, calculada na hora
//   pela RPC avaliar_missoes_motorista via grupos_economicos_empresas).
// - "global" (posto, em /parcerias-locais): missão fica com empresa_id NULL
//   — mesmo alcance das 4 missões padrão do produto, vale pra QUALQUER
//   motorista da rede toda (mesmo espírito das Parcerias Locais, que também
//   são visíveis pra rede inteira, não só clientes do posto que criou).
//
// criador_empresa_id (não empresa_id) é quem manda na RLS de escrita
// (fidelidade_missoes_escreve_empresa) — permite ao posto criar/editar as
// PRÓPRIAS missões globais mesmo com empresa_id null.

export type MissaoFormState = { erro?: string } | undefined;

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

// Slug estável a partir do título — fidelidade_missoes.codigo é unique
// globalmente (entre todas as empresas), então junta um sufixo curto pra
// evitar colisão entre empresas diferentes usando títulos parecidos.
function gerarCodigo(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const sufixo = Math.random().toString(36).slice(2, 8);
  return `${base || "missao"}_${sufixo}`;
}

function validarCampos(formData: FormData): {
  erro?: string;
  titulo: string;
  descricao: string;
  icone: string;
  tipoMetrica: string;
  meta: number;
  bonus: number;
} {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const icone = String(formData.get("icone") ?? "flag_outlined");
  const tipoMetrica = String(formData.get("tipo_metrica") ?? "");
  const metaRaw = String(formData.get("meta") ?? "").trim();
  const bonusRaw = String(formData.get("bonus") ?? "0").trim();

  if (!titulo) return { erro: "Título é obrigatório.", titulo, descricao, icone, tipoMetrica, meta: 0, bonus: 0 };
  if (!eMetricaValida(tipoMetrica)) {
    return { erro: "Selecione uma métrica válida.", titulo, descricao, icone, tipoMetrica, meta: 0, bonus: 0 };
  }
  if (!eIconeValido(icone)) {
    return { erro: "Selecione um ícone válido.", titulo, descricao, icone, tipoMetrica, meta: 0, bonus: 0 };
  }

  const meta = metricaEhBinaria(tipoMetrica) ? 1 : Number(metaRaw);
  if (!Number.isFinite(meta) || meta <= 0) {
    return { erro: "Meta precisa ser um número maior que zero.", titulo, descricao, icone, tipoMetrica, meta: 0, bonus: 0 };
  }
  const bonus = Number(bonusRaw || 0);
  if (!Number.isFinite(bonus) || bonus < 0) {
    return { erro: "Bônus em pontos precisa ser zero ou maior.", titulo, descricao, icone, tipoMetrica, meta: 0, bonus: 0 };
  }

  return { titulo, descricao, icone, tipoMetrica, meta: Math.round(meta), bonus: Math.round(bonus) };
}

export type ModoMissao = "empresa" | "global";

export async function criarMissao(
  empresaId: string,
  modo: ModoMissao,
  _prev: MissaoFormState,
  formData: FormData
): Promise<MissaoFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para criar missões nesta empresa." };
  }

  const campos = validarCampos(formData);
  if (campos.erro) return { erro: campos.erro };
  const aplicaGrupoEconomico = modo === "empresa" && formData.get("aplica_grupo_economico") === "on";

  const { error } = await supabase.from("fidelidade_missoes").insert({
    empresa_id: modo === "global" ? null : empresaId,
    criador_empresa_id: empresaId,
    aplica_grupo_economico: aplicaGrupoEconomico,
    codigo: gerarCodigo(campos.titulo),
    titulo: campos.titulo,
    descricao: campos.descricao,
    icone: campos.icone,
    tipo_metrica: campos.tipoMetrica,
    meta: campos.meta,
    bonus: campos.bonus,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/fidelidade-motoristas");
  revalidatePath("/parcerias-locais");
  return undefined;
}

export async function atualizarMissao(
  id: string,
  empresaId: string,
  modo: ModoMissao,
  _prev: MissaoFormState,
  formData: FormData
): Promise<MissaoFormState> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para editar esta missão." };
  }

  const campos = validarCampos(formData);
  if (campos.erro) return { erro: campos.erro };
  const ativa = formData.get("ativa") === "on";
  const aplicaGrupoEconomico = modo === "empresa" && formData.get("aplica_grupo_economico") === "on";

  const { error } = await supabase
    .from("fidelidade_missoes")
    .update({
      titulo: campos.titulo,
      descricao: campos.descricao,
      icone: campos.icone,
      tipo_metrica: campos.tipoMetrica,
      meta: campos.meta,
      bonus: campos.bonus,
      ativa,
      aplica_grupo_economico: aplicaGrupoEconomico,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("criador_empresa_id", empresaId);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/fidelidade-motoristas");
  revalidatePath("/parcerias-locais");
  return undefined;
}

export async function alternarAtivaMissao(id: string, empresaId: string, ativa: boolean) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase
    .from("fidelidade_missoes")
    .update({ ativa, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("criador_empresa_id", empresaId);
  revalidatePath("/fidelidade-motoristas");
  revalidatePath("/parcerias-locais");
}

export async function excluirMissao(id: string, empresaId: string) {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) return;
  await supabase.from("fidelidade_missoes").delete().eq("id", id).eq("criador_empresa_id", empresaId);
  revalidatePath("/fidelidade-motoristas");
  revalidatePath("/parcerias-locais");
}

export type MissaoRow = {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  icone: string;
  tipo_metrica: string;
  meta: number;
  bonus: number;
  ativa: boolean;
  empresa_id: string | null;
  criador_empresa_id: string | null;
  aplica_grupo_economico: boolean;
};

const COLUNAS_MISSAO =
  "id, codigo, titulo, descricao, icone, tipo_metrica, meta, bonus, ativa, empresa_id, criador_empresa_id, aplica_grupo_economico";

// Empresas do mesmo grupo econômico da empresa informada (inclui ela
// mesma) — usado só pra achar, na listagem, missões de empresas "irmãs"
// marcadas aplica_grupo_economico=true.
async function empresasDoGrupoEconomico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("grupos_economicos_empresas")
    .select("grupo_economico_id")
    .eq("empresa_id", empresaId);
  const gruposIds = (data ?? []).map((g) => g.grupo_economico_id);
  if (gruposIds.length === 0) return [];

  const { data: irmas } = await supabase
    .from("grupos_economicos_empresas")
    .select("empresa_id")
    .in("grupo_economico_id", gruposIds);
  return Array.from(new Set((irmas ?? []).map((i) => i.empresa_id)));
}

// Modo "empresa" (cliente): globais do produto + próprias + as
// aplica_grupo_economico das empresas irmãs.
export async function listarMissoes(empresaId: string): Promise<MissaoRow[]> {
  const supabase = await createClient();
  const empresasGrupo = await empresasDoGrupoEconomico(supabase, empresaId);

  let filtro = `empresa_id.is.null,empresa_id.eq.${empresaId}`;
  if (empresasGrupo.length > 0) {
    filtro += `,and(aplica_grupo_economico.eq.true,empresa_id.in.(${empresasGrupo.join(",")}))`;
  }

  const { data } = await supabase
    .from("fidelidade_missoes")
    .select(COLUNAS_MISSAO)
    .or(filtro)
    .order("empresa_id", { ascending: true, nullsFirst: true })
    .order("criado_em", { ascending: false });
  return (data ?? []) as MissaoRow[];
}

// Modo "global" (posto): só as missões globais que ESSE posto criou —
// não faz sentido mostrar aqui as globais de outros postos nem as 4
// padrão do produto (não editáveis por ninguém além do admin).
export async function listarMissoesGlobaisCriadasPor(empresaId: string): Promise<MissaoRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fidelidade_missoes")
    .select(COLUNAS_MISSAO)
    .eq("criador_empresa_id", empresaId)
    .is("empresa_id", null)
    .order("criado_em", { ascending: false });
  return (data ?? []) as MissaoRow[];
}
