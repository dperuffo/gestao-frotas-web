import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BotaoFavoritoMenu } from "./BotaoFavoritoMenu";

// Fase reorganizacao-menu (04/08/2026, pedido do Daniel: "Fazer uma sugestao
// de reorganizacao do menu" / "Organizacao de temas iguais" — a seção
// Operação tinha crescido, fase após fase, até virar uma lista só de 33
// itens sem nenhuma subdivisão, bem mais desbalanceada que Cadastros (9) e a
// antiga Gestão (11); "Acho que esta bastante confuso para o usuario") —
// componente único que renderiza QUALQUER grupo temático do menu lateral
// (cliente ou posto), extraído do bloco que antes era copiado quase
// idêntico pra cada seção (Gestão/Cadastros/Operação) dentro de
// layout.tsx. Badges por item viram um lookup (`badges[item.href]`) em vez
// de um `item.href === "/x" && contagem > 0` por seção — motivo real: com
// 10 grupos novos, repetir esses condicionais em cada um teria multiplicado
// o mesmo bug-prone copy/paste que já existia (achado ao revisar o arquivo
// antes desta fase: o badge de `/antifraude` em menuOperacao já era código
// morto, porque a rota saiu do menu faz tempo e ninguém tinha limpado).
// Fase Ícones-Padrão-Menu (04/08/2026, pedido do Daniel: "adotar o mesmo
// padrão de ícone" pra Central de Ajuda e Assistente FNI) — a "Assistente
// FNI" costumava usar a logo da marca (`logo: true`, campo removido aqui)
// em vez de um ícone lucide-react como todo o resto do menu; padronizado
// pra `icon: Bot` como qualquer outro item.
export type ItemMenuLateral = { href: string; label: string; icon?: LucideIcon };

export function GrupoMenuLateral({
  titulo,
  itens,
  badges,
  tourPorHref,
  dataTourTitulo,
  favoritos,
  primeiro = false,
}: {
  titulo: string;
  itens: ItemMenuLateral[];
  badges?: Record<string, number>;
  tourPorHref?: Record<string, string>;
  dataTourTitulo?: string;
  // Fase reorganizacao-menu — o cabeçalho do primeiro grupo de cada menu
  // (Visão Geral) não tem a margem superior que separa os demais entre si
  // (mesmo espaçamento que "Gestão" já tinha antes de virar vários grupos).
  // Passado explicitamente em vez de detectar via CSS `:first-child` porque
  // o grupo "Roteirização e Abastecimento" precisa ficar dentro de um
  // `<div data-tour="menu-operacao">` (ver layout.tsx) — o que o tornaria o
  // "primeiro filho" desse `<div>` sem realmente ser o primeiro grupo do
  // menu, quebrando a detecção via CSS.
  primeiro?: boolean;
  // Fase Acesso-Rápido-Favoritos (04/08/2026, pedido do Daniel: "mecanismo
  // de acesso rápido... favoritos... usar inteligência artificial pra
  // posicionar as abas mais utilizadas") — hrefs atualmente no acesso
  // rápido deste usuário (fixados manualmente ou sugeridos por frecência),
  // só pra desenhar a estrela cheia/vazia ao lado de cada item. Opcional
  // porque o bloco de Administração em layout.tsx é renderizado à parte
  // (sem passar por este componente) e ficou fora desta primeira rodada.
  favoritos?: Set<string>;
}) {
  if (itens.length === 0) return null;

  return (
    <>
      <p
        data-tour={dataTourTitulo}
        className={`mb-2 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 ${primeiro ? "" : "mt-6"}`}
      >
        {titulo}
      </p>
      <ul className="space-y-1">
        {itens.map((item) => {
          const badge = badges?.[item.href] ?? 0;
          return (
            <li key={item.href} className="group flex items-center gap-1">
              <Link
                href={item.href}
                data-tour={tourPorHref?.[item.href]}
                className="flex flex-1 items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              >
                <span className="flex items-center gap-2">
                  {item.icon && <item.icon className="h-4 w-4 shrink-0 text-slate-300" />}
                  {item.label}
                </span>
                {badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                    {badge}
                  </span>
                )}
              </Link>
              {favoritos && <BotaoFavoritoMenu href={item.href} favoritadoInicial={favoritos.has(item.href)} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}
