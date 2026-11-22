import Image from "next/image";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ChatAssistente } from "./_components/ChatAssistente";
import { SeletorClienteAssistente } from "./_components/SeletorClienteAssistente";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

export default async function AssistenteFniPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Usuário com acesso a várias empresas (grupo econômico) escolhe o cliente aqui
  // mesmo; as ferramentas que dependem da empresa (ex.: preços negociados na
  // rota) usam a escolhida. resolverEmpresaAtual só aceita empresas do usuário.
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  return (
    <div>
      <CabecalhoPagina
        titulo={
          <>
            <Image src="/logo-fni.png" alt="FNI" width={102} height={40} className="mr-1 h-7 w-auto" priority />
            Assistente FNI <AjudaIcon chave="assistente.pergunta" />
          </>
        }
        descricao="Converse em linguagem natural sobre a sua operação de frota, ou tire dúvidas de como usar a plataforma. O assistente consulta os dados em tempo real (só enxerga as empresas às quais você tem acesso) e o conteúdo oficial de treinamento — sem inventar respostas."
      />
      {empresas.length > 1 && (
        <SeletorClienteAssistente empresas={empresas} empresaSelecionadaId={empresaSelecionada} />
      )}
      <ChatAssistente key={empresaSelecionada ?? "todas"} usuarioEmail={user?.email} empresaId={empresaSelecionada} />
    </div>
  );
}
