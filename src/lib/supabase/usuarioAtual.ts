import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Usuário logado, consultado UMA vez por requisição. `auth.getUser()` é uma chamada de rede ao
// Supabase Auth (cerca de 130 ms entre o servidor e o banco); o layout, a página e os helpers
// chamavam cada um a sua. Com React `cache`, todos compartilham a mesma resposta durante a
// renderização. Mesmo formato de retorno de `supabase.auth.getUser()` ({ data: { user }, error }).
export const obterUsuarioAtual = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getUser();
});
