import Image from "next/image";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ChatAssistente } from "./_components/ChatAssistente";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

export default async function AssistenteFniPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; pergunta?: string }>;
}) {
  const { empresa: empresaParam, pergunta } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Usuário com acesso a várias empresas (grupo econômico) escolhe o cliente na barra
  // do chat; as ferramentas que dependem da empresa (preços negociados na rota,
  // cadastro de regra) usam a escolhida. resolverEmpresaAtual só aceita empresas do usuário.
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const { data: perfilApp } = user?.email
    ? await supabase.from("usuarios_app").select("nome").ilike("email", user.email).maybeSingle()
    : { data: null };
  const primeiroNome = perfilApp?.nome ? String(perfilApp.nome).trim().split(" ")[0] : undefined;

  return (
    <div>
      <CabecalhoPagina
        titulo={
          <>
            <Image src="/logo-fni.png" alt="FNI" width={102} height={40} className="mr-1 h-7 w-auto" priority />
            Assistente FNI <AjudaIcon chave="assistente.pergunta" />
          </>
        }
        descricao="Pergunte em linguagem natural: o assistente consulta os dados em tempo real (só das empresas às quais você tem acesso), desenha gráficos, compara preços na rota e ajuda a cadastrar regras."
      />
      <ChatAssistente
        key={empresaSelecionada ?? "todas"}
        usuarioEmail={user?.email}
        primeiroNome={primeiroNome}
        empresaId={empresaSelecionada}
        empresas={empresas}
        perguntaInicial={pergunta?.slice(0, 2000)}
      />
    </div>
  );
}
