import Link from "next/link";

// Fase 27.34 — achado real: a aba "Por Rota" foi retirada da navegação (pra
// todos os perfis, inclusive admin) a pedido do Daniel; e a aba de
// planejamento de rota otimizada (antes também chamada "Roteirização",
// mesmo nome da seção inteira no menu lateral — confuso) passou a se chamar
// "Roteirizador Inteligente" pra ficar clara a diferença entre ela e as
// demais consultas.
const ABAS = [
  { href: "/roteirizacao", chave: "uf", label: "Por UF/Município" },
  { href: "/roteirizacao/posto", chave: "posto", label: "Consulta por Posto" },
  { href: "/roteirizacao/planejar", chave: "planejar", label: "Roteirizador Inteligente" },
  { href: "/roteirizacao/salvas", chave: "salvas", label: "Rotas Salvas" },
] as const;

// "rota" continua uma opção válida de `ativo` (não uma aba visível) porque
// consultas do tipo "Por Rota" salvas ANTES desta mudança continuam
// acessíveis a partir de "Rotas Salvas" — só a entrada da aba em si é que
// saiu da navegação principal.
export type AbaRoteirizacaoAtiva = (typeof ABAS)[number]["chave"] | "rota";

export function AbasRoteirizacao({ ativo }: { ativo: AbaRoteirizacaoAtiva }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
      {ABAS.map((aba) => (
        <Link
          key={aba.chave}
          href={aba.href}
          className={
            "border-b-2 px-3 py-2 text-sm font-medium " +
            (ativo === aba.chave
              ? "border-frota-600 text-frota-600"
              : "border-transparent text-slate-500 hover:text-slate-700")
          }
        >
          {aba.label}
        </Link>
      ))}
    </div>
  );
}
