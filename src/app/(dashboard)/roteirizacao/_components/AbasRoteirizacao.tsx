import Link from "next/link";

// Fase 27.34 — achado real: a aba "Por Rota" foi retirada da navegação (pra
// todos os perfis, inclusive admin) a pedido do Daniel; e a aba de
// planejamento de rota otimizada (antes também chamada "Roteirização",
// mesmo nome da seção inteira no menu lateral — confuso) passou a se chamar
// "Roteirizador Inteligente" pra ficar clara a diferença entre ela e as
// demais consultas.
//
// Fase Seleção-Manual-de-Postos (28/07/2026) — a aba "Por Rota" volta pro
// menu, agora como "Escolher Postos Manualmente": deixou de ser só
// informativa (postos no corredor) e virou o modo manual do abastecimento,
// pedido por um gestor de frota — o gestor pede veículo, traça a rota e
// escolhe ele mesmo em quais postos abastecer, sem depender do algoritmo do
// Roteirizador Inteligente (ver FormPorRota.tsx).
const ABAS = [
  { href: "/roteirizacao", chave: "uf", label: "Por UF/Município" },
  { href: "/roteirizacao/posto", chave: "posto", label: "Consulta por Posto" },
  { href: "/roteirizacao/planejar", chave: "planejar", label: "Roteirizador Inteligente" },
  { href: "/roteirizacao/rota", chave: "rota", label: "Escolher Postos Manualmente" },
  { href: "/roteirizacao/salvas", chave: "salvas", label: "Rotas Salvas" },
] as const;

export type AbaRoteirizacaoAtiva = (typeof ABAS)[number]["chave"];

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
