"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Fase Design-System-Corporate-Blue (26/08/2026) — fix de produção: o menu
// lateral (GrupoMenuLateral.tsx) precisa de usePathname() pra saber qual
// item destacar como "ativo", mas usePathname só existe em Client
// Component. A primeira tentativa marcou o GrupoMenuLateral inteiro como
// "use client" — quebrou em produção com "Functions cannot be passed
// directly to Client Components" (digest 2873064123), porque os itens de
// menu (montados em layout.tsx, Server Component) carregam `icon:
// LucideIcon`, uma função/componente, e funções não podem atravessar a
// borda Server→Client como valor de prop (só como Server Action). Corrigido
// isolando o "use client" só neste componente-folha: ele recebe apenas
// primitivos (href, classNames) e `children` já renderizado no servidor
// (ícone + label + badge), que React sabe serializar através da borda
// (é o padrão "slot" — o filho já foi resolvido em elementos antes de
// cruzar pro client bundle, não carrega mais nenhuma referência a função).
export function ItemMenuAtivo({
  href,
  dataTour,
  className,
  classNameAtivo,
  children,
}: {
  href: string;
  dataTour?: string;
  className: string;
  classNameAtivo: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const ativo = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} data-tour={dataTour} className={`${className} ${ativo ? classNameAtivo : ""}`}>
      {children}
    </Link>
  );
}
