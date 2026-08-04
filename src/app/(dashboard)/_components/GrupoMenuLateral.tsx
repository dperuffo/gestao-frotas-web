import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

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
export type ItemMenuLateral = { href: string; label: string; icon?: LucideIcon; logo?: boolean };

export function GrupoMenuLateral({
  titulo,
  itens,
  badges,
  tourPorHref,
  dataTourTitulo,
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
            <li key={item.href}>
              <Link
                href={item.href}
                data-tour={tourPorHref?.[item.href]}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              >
                <span className="flex items-center gap-2">
                  {item.logo && (
                    <Image
                      src="/logo-fni.png"
                      alt=""
                      width={24}
                      height={9}
                      className="inline-block h-auto w-5 align-middle object-contain"
                    />
                  )}
                  {item.icon && <item.icon className="h-4 w-4 shrink-0 text-slate-300" />}
                  {item.label}
                </span>
                {badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                    {badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
