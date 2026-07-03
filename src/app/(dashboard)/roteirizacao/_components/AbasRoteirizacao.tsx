import Link from "next/link";

const ABAS = [
  { href: "/roteirizacao", chave: "uf", label: "Por UF/Município" },
  { href: "/roteirizacao/rota", chave: "rota", label: "Por Rota" },
  { href: "/roteirizacao/posto", chave: "posto", label: "Consulta por Posto" },
  { href: "/roteirizacao/planejar", chave: "planejar", label: "Roteirização" },
  { href: "/roteirizacao/salvas", chave: "salvas", label: "Rotas Salvas" },
] as const;

export function AbasRoteirizacao({ ativo }: { ativo: (typeof ABAS)[number]["chave"] }) {
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
