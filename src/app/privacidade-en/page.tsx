import type { Metadata } from "next";
import { TITULO, ESTILO, CORPO } from "@/app/_landing/legal/privacidade-en";

export const metadata: Metadata = {
  title: TITULO,
};

// Página legal pública (Fase 26), portada de dperuffo/estudo-de-rede. Idioma
// fixo nesta rota (en); o script embutido no CORPO redireciona pra
// "/privacidade" se o visitante já tiver escolhido o outro idioma antes
// (localStorage "fni_lang", mesmo mecanismo da landing em "/").
export default function Pagina() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: link direto no Server Component é o padrão suportado, o lint ainda assume Pages Router */}
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: ESTILO }} />
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var l=localStorage.getItem("fni_lang")||"pt";if(l!=="en"){window.location.replace("/privacidade");}})();`,
        }}
      />
      <div dangerouslySetInnerHTML={{ __html: CORPO }} />
    </>
  );
}
