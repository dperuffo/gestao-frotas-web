"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_ANEXOS, temAtualizacaoNaoVista, type AutorTipo, type TicketPrioridade, type TicketStatus, type TicketTipo } from "@/lib/chamados";

export type ChamadoFormState = { erro?: string } | undefined;

// Resolve se o usuário logado age como "admin" (time interno da FNI,
// responde chamados de qualquer cliente) ou "usuario" (gestor de um
// cliente, só vê/comenta os chamados da própria empresa) — mesma regra já
// usada nas policies de RLS (perfil admin OU o e-mail fixo), calculada aqui
// pra rotular corretamente o autor de cada comentário/anexo.
export async function resolverPapelAtual(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ email: string; papel: AutorTipo }> {
  // Fase 27.25 — achado real: um anexo enviado numa resposta de chamado
  // (ThreadChamado) derrubava a página com o erro genérico de produção do
  // Next ("An error occurred in the Server Components render..."), sem
  // NENHUM registro de upload no Storage — ou seja, a falha acontecia antes
  // mesmo de chegar no upload. resolverPapelAtual (chamada por
  // enviarAnexoAcao, comentarAcao, marcarVistoAcao e pela própria página do
  // chamado) fazia duas chamadas de rede (getUser + rpc) sem nenhuma
  // proteção — qualquer falha ali (ex.: token expirado de um jeito que o
  // Supabase client não trata como erro normal) escapava sem tratamento.
  // Try/catch aqui protege todos os usos de uma vez, sem precisar mexer em
  // cada função que chama isso.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email ?? "";
    const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
    const papel: AutorTipo = perfil === "admin" || email === "d.peruffo@gmail.com" ? "admin" : "usuario";
    return { email, papel };
  } catch (e) {
    console.error("[chamados] resolverPapelAtual falhou:", e instanceof Error ? e.message : e);
    return { email: "", papel: "usuario" };
  }
}

export async function criarChamadoAcao(_prev: ChamadoFormState, formData: FormData): Promise<ChamadoFormState> {
  const supabase = await createClient();
  const empresaId = String(formData.get("empresa_id") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "").trim() as TicketTipo;
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const prioridade = (String(formData.get("prioridade") ?? "media").trim() || "media") as TicketPrioridade;
  const arquivo = formData.get("arquivo");

  if (!empresaId) return { erro: "Selecione o cliente." };
  if (tipo !== "incidente" && tipo !== "melhoria") return { erro: "Selecione o tipo do chamado." };
  if (!titulo) return { erro: "Título é obrigatório." };
  if (!descricao) return { erro: "Descrição é obrigatória." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login novamente." };

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      empresa_id: empresaId,
      user_email: user.email,
      tipo,
      titulo,
      descricao,
      prioridade,
      status: "aberto",
      usuario_visto_em: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível abrir o chamado: ${error.message}` };

  // Fase 27.18 — achado real: quando o upload do anexo falhava (rede,
  // política de storage, tipo de arquivo etc.), a exceção de enviarAnexo
  // subia sem tratamento e derrubava a Server Action inteira com um erro
  // genérico de servidor — mesmo o CHAMADO já tendo sido criado com sucesso
  // (o insert acima já tinha comitado). Cliente ficava sem saber se o
  // chamado existia ou não, numa tela de "Application error" sem contexto
  // nenhum. Agora o anexo é best-effort: falha nele não derruba a abertura
  // do chamado, só sinaliza via query param pra tela de detalhe avisar o
  // usuário e oferecer o upload de novo por lá (ThreadChamado já tem esse
  // recurso via enviarAnexoAcao).
  let anexoFalhou = false;
  if (arquivo instanceof File && arquivo.size > 0) {
    try {
      await enviarAnexo(supabase, data.id, arquivo, user.email);
    } catch (e) {
      anexoFalhou = true;
      console.error("[chamados] falha ao enviar anexo na abertura do chamado:", e instanceof Error ? e.message : e);
    }
  }

  revalidatePath("/chamados");
  redirect(`/chamados/${data.id}${anexoFalhou ? "?anexoErro=1" : ""}`);
}

// Fase 27.24 — achado real: o nome original do arquivo (com espaços,
// acentos, parênteses etc. — bem comum em screenshots, ex.: "captura de
// tela (2).png") ia direto pro caminho do objeto no Supabase Storage. Isso
// nunca deu erro tratável (a Storage API não devolve um `error` claro pra
// esse caso) — a chamada da Server Action simplesmente falhava no nível de
// rede, sem nenhuma mensagem específica, só "Failed to fetch" genérico.
// Sanitiza só o CAMINHO no Storage (nunca visível pro usuário); o nome
// original continua guardado sem alteração na coluna `nome` de
// ticket_anexos, usado pra exibir/baixar o arquivo com o nome certo.
function sanitizarNomeParaStorage(nomeOriginal: string): string {
  const semAcentos = nomeOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const seguro = semAcentos.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return seguro.slice(-150) || "arquivo";
}

async function enviarAnexo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ticketId: string,
  arquivo: File,
  autorEmail: string
) {
  const caminho = `${ticketId}/${Date.now()}_${sanitizarNomeParaStorage(arquivo.name)}`;
  const { error: erroUpload } = await supabase.storage.from(BUCKET_ANEXOS).upload(caminho, arquivo, {
    contentType: arquivo.type || undefined,
  });
  if (erroUpload) throw new Error(erroUpload.message);

  const { error: erroInsert } = await supabase.from("ticket_anexos").insert({
    ticket_id: ticketId,
    nome: arquivo.name,
    tipo_mime: arquivo.type || null,
    tamanho: arquivo.size,
    url: caminho,
    autor_email: autorEmail,
  });
  if (erroInsert) throw new Error(erroInsert.message);

  // Anexo também conta como atualização do chamado pra fins de notificação
  // visual (o trigger no banco só cobre comentários, não anexos).
  await supabase.from("tickets").update({ atualizado_em: new Date().toISOString() }).eq("id", ticketId);
}

// Fase 27.27 — achado real: essa action recebia (ticketId: string, formData:
// FormData) — dois argumentos separados, um deles carregando um File — e
// continuava travando com o erro genérico mascarado de produção do Next
// mesmo com TODO o corpo da função protegido por try/catch (Fase 27.25) e
// ZERO rastro de execução (nenhum log no Storage, nada). Isso indica que a
// falha acontecia antes mesmo do nosso código rodar — na camada do Next que
// decodifica os argumentos da Server Action a partir da requisição. A
// diferença pro fluxo que FUNCIONA (criarChamadoAcao, que usa o mesmo
// enviarAnexo() por baixo): lá o primeiro argumento é sempre `undefined`
// (padrão de action state), nunca uma string populada. Agora o ticketId vai
// embutido como campo oculto dentro do próprio FormData — um único
// argumento, no mesmo formato que já funciona.
export async function enviarAnexoAcao(formData: FormData): Promise<{ erro?: string }> {
  const ticketId = String(formData.get("ticket_id") ?? "").trim();
  const arquivo = formData.get("arquivo");
  if (!ticketId) return { erro: "Chamado não identificado." };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione um arquivo." };

  // Fase 27.25 — try/catch em volta de TUDO (não só do upload em si), pra
  // nenhuma etapa (criar client, resolver papel, revalidatePath) escapar
  // sem tratamento e virar o erro genérico de produção do Next.
  try {
    const supabase = await createClient();
    const { email } = await resolverPapelAtual(supabase);
    if (!email) return { erro: "Sessão expirada, faça login novamente." };

    await enviarAnexo(supabase, ticketId, arquivo, email);

    revalidatePath(`/chamados/${ticketId}`);
    revalidatePath("/chamados");
    return {};
  } catch (e) {
    console.error("[chamados] enviarAnexoAcao falhou:", e instanceof Error ? e.message : e);
    return { erro: e instanceof Error ? e.message : "Erro ao enviar anexo." };
  }
}

export async function comentarAcao(ticketId: string, texto: string): Promise<{ erro?: string }> {
  const textoLimpo = texto.trim();
  if (!textoLimpo) return { erro: "Escreva uma mensagem." };

  // Fase 27.25 — mesmo raciocínio de enviarAnexoAcao: todo o corpo (não só
  // uma parte) protegido, pra nenhuma etapa escapar sem tratamento.
  try {
    const supabase = await createClient();
    const { email, papel } = await resolverPapelAtual(supabase);
    if (!email) return { erro: "Sessão expirada, faça login novamente." };

    const { error } = await supabase.from("ticket_comentarios").insert({
      ticket_id: ticketId,
      autor_email: email,
      autor_tipo: papel,
      texto: textoLimpo,
    });
    if (error) return { erro: error.message };

    // O próprio autor já "viu" a atualização que acabou de criar.
    await marcarComoVisto(supabase, ticketId, papel);

    revalidatePath(`/chamados/${ticketId}`);
    revalidatePath("/chamados");
    return {};
  } catch (e) {
    console.error("[chamados] comentarAcao falhou:", e instanceof Error ? e.message : e);
    return { erro: e instanceof Error ? e.message : "Erro ao enviar mensagem." };
  }
}

// Grava a marca de "visto" — separado em função própria (em vez de um
// objeto com chave computada) porque o tipo gerado pelo Supabase para
// `.update()` rejeita index signatures genéricas (RejectExcessProperties).
async function marcarComoVisto(supabase: Awaited<ReturnType<typeof createClient>>, ticketId: string, papel: AutorTipo) {
  const agora = new Date().toISOString();
  if (papel === "admin") {
    await supabase.from("tickets").update({ admin_visto_em: agora }).eq("id", ticketId);
  } else {
    await supabase.from("tickets").update({ usuario_visto_em: agora }).eq("id", ticketId);
  }
}

export async function marcarVistoAcao(ticketId: string): Promise<void> {
  const supabase = await createClient();
  const { email, papel } = await resolverPapelAtual(supabase);
  if (!email) return;

  await marcarComoVisto(supabase, ticketId, papel);
  revalidatePath("/chamados");
}

// Atualização de status/prioridade — a tela só mostra esses controles pro
// admin (gestor de cliente tem só o botão "Marcar como resolvido", que
// chama esta mesma action com status fixo). RLS permite ambos os papéis
// escreverem no chamado da própria empresa, mas a UI que decide quem vê o
// quê.
export async function atualizarChamadoAcao(
  ticketId: string,
  dados: { status?: TicketStatus; prioridade?: TicketPrioridade }
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({ ...dados, atualizado_em: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) return { erro: error.message };

  revalidatePath(`/chamados/${ticketId}`);
  revalidatePath("/chamados");
  return {};
}

// Conta chamados com atualização não vista pelo usuário logado — usada pelo
// badge de notificação visual no menu lateral (layout.tsx). Chamados
// fechados não entram na contagem (não faz sentido continuar "cutucando"
// o usuário depois que o assunto foi encerrado).
export async function contarChamadosNaoVistosAcao(): Promise<number> {
  const supabase = await createClient();
  const { email, papel } = await resolverPapelAtual(supabase);
  if (!email) return 0;

  const { data } = await supabase
    .from("tickets")
    .select("atualizado_em, usuario_visto_em, admin_visto_em")
    .neq("status", "fechado");

  if (!data) return 0;
  return data.filter((t) => temAtualizacaoNaoVista(t, papel)).length;
}
