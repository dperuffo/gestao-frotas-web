import { createClient } from "@/lib/supabase/server";
import { TreinamentoExplorer } from "./_components/TreinamentoExplorer";
import type { Perfil } from "@/lib/constants";

// Fase Central-Treinamento (20/07/2026) — pedido do Daniel: "criar um
// treinamento interativo para o usuário, com imagens de telas e
// informações sobre cada aba, cada campo, cada indicador", pra um produto
// SaaS self-service não depender de time comercial/treinamento humano.
//
// Conteúdo vem de conteudo_ajuda (tipo='licao'), editável sem deploy via
// /administracao/central-conteudo. Perfil filtra o que aparece (ex.: um
// cliente de frota não precisa ver lições de "Meus Preços", que é só do
// posto revendedor) — mesmo espírito de filtragem por perfil já usado no
// tour de boas-vindas (tourPassos.ts).
export default async function TreinamentoPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  const { data: licoes } = await supabase
    .from("conteudo_ajuda")
    .select("id, modulo, ordem, titulo, texto, imagem_path, video_path, perfis")
    .eq("tipo", "licao")
    .eq("ativo", true)
    .order("modulo", { ascending: true })
    .order("ordem", { ascending: true });

  const licoesVisiveis = (licoes ?? []).filter(
    (l) => !l.perfis || l.perfis.length === 0 || l.perfis.includes(perfil as Perfil)
  );

  const modulosMap = new Map<string, { nome: string; licoes: typeof licoesVisiveis }>();
  for (const licao of licoesVisiveis) {
    const nome = licao.modulo ?? "Geral";
    if (!modulosMap.has(nome)) modulosMap.set(nome, { nome, licoes: [] });
    modulosMap.get(nome)!.licoes.push(licao);
  }
  const modulos = Array.from(modulosMap.values());

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Central de Treinamento</h1>
        <p className="mt-1 text-sm text-slate-500">
          Um guia por módulo pra você (ou seu time) aprender a usar a plataforma sem depender de
          treinamento humano. Dúvida que não está aqui? Pergunte no{" "}
          <a href="/assistente" className="text-frota-600 hover:underline">
            Assistente FNI
          </a>
          .
        </p>
      </div>
      <TreinamentoExplorer modulos={modulos} />
    </div>
  );
}
