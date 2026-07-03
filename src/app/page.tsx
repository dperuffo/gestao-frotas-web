import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LANDING_BODY_HTML } from "./_landing/landingBody";

export const metadata: Metadata = {
  title: "FNI — Fleet Network Intelligence | Gestão de Frotas",
  description:
    "Plataforma SaaS para gestão de frotas. Compare preços ANP, monitore consumo e identifique os melhores postos. Trial grátis por 14 dias.",
};

// Raiz do domínio público (fxgestaodefrotasonline.com) — landing de
// marketing pra visitante anônimo, com CTA pro cadastro/login (Fase 26).
// Quem já está logado não precisa ver a landing de novo: manda direto pro
// dashboard, mesmo comportamento que "/" sempre teve antes de existir uma
// landing (o middleware libera "/" como rota pública pra isso não virar
// redirect-loop pra quem ainda não tem sessão — ver src/lib/supabase/middleware.ts).
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: link direto no Server Component é o padrão suportado, o lint ainda assume Pages Router */}
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500&display=swap"
        rel="stylesheet"
      />
      <div dangerouslySetInnerHTML={{ __html: LANDING_BODY_HTML }} />
    </>
  );
}
