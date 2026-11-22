import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ChatAssistente } from "./_components/ChatAssistente";
import { PainelUsoAssistente } from "./_components/PainelUsoAssistente";
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
  // Perf: empresa atual e nome do usuário são independentes, então rodam juntos.
  const [{ empresas, empresaSelecionada, perfil }, { data: perfilApp }] = await Promise.all([
    resolverEmpresaAtual(supabase, empresaParam),
    user?.email
      ? supabase.from("usuarios_app").select("nome").ilike("email", user.email).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const primeiroNome = perfilApp?.nome ? String(perfilApp.nome).trim().split(" ")[0] : undefined;

  return (
    <div>
      {/* Faixa do Assistente: mesmo gradiente do CabecalhoPagina, com a logo FNI branca, grande e centralizada. */}
      <div
        className="mb-6 flex flex-col items-center gap-2 rounded-xl p-6 text-center text-white"
        style={{
          background:
            "radial-gradient(circle at 86% 0, rgba(222,96,36,.55), transparent 30%), linear-gradient(135deg, #333c4d, #4e5d77 60%, #66748d)",
        }}
      >
        {/* brightness(0) + invert(1): qualquer cor da logo vira branco puro (o PNG tem fundo transparente). */}
        <Image
          src="/logo-fni.png"
          alt="FNI — Fleet Network Intelligence"
          width={306}
          height={120}
          priority
          className="h-20 w-auto sm:h-24"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-white">
          Assistente FNI <AjudaIcon chave="assistente.pergunta" />
        </h1>
        <p className="max-w-3xl text-sm text-white/80">
          Pergunte em linguagem natural: o assistente consulta os dados em tempo real (só das empresas às quais você tem acesso), desenha gráficos, compara preços na rota e ajuda a cadastrar regras.
        </p>
      </div>
      <PainelUsoAssistente empresaId={empresaSelecionada} perfil={perfil} />
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
