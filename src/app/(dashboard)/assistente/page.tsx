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
      <h1 className="mb-1 flex items-center gap-1.5 text-xl font-semibold text-slate-900">
        🤖 Assistente FNI <AjudaIcon chave="assistente.pergunta" />
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Converse em linguagem natural sobre a sua operação de frota. O assistente consulta os dados em tempo real
        e só enxerga as empresas às quais você tem acesso.
      </p>
      <ChatAssistente usuarioEmail={user?.email} />
    </div>
  );
}
