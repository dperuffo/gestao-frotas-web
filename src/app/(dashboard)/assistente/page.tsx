import Image from "next/image";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { ChatAssistente } from "./_components/ChatAssistente";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

export default async function AssistenteFniPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      <ChatAssistente usuarioEmail={user?.email} />
    </div>
  );
}
