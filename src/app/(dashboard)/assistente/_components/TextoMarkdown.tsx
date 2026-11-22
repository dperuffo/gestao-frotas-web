import type { ReactNode } from "react";

// Renderizador mínimo de markdown para as respostas do assistente: **negrito**,
// listas (- / * / 1.), tabelas simples com | e parágrafos. Nunca usa
// dangerouslySetInnerHTML — tudo vira elementos React (texto é escapado).
function inline(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) return <strong key={i}>{parte.slice(2, -2)}</strong>;
    if (parte.startsWith("`") && parte.endsWith("`") && parte.length > 2)
      return (
        <code key={i} className="rounded bg-black/5 px-1 text-[0.9em] dark:bg-white/10">
          {parte.slice(1, -1)}
        </code>
      );
    return parte;
  });
}

const ehLinhaTabela = (l: string) => l.trim().startsWith("|") && l.trim().endsWith("|");
const ehSeparadorTabela = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes("-");

export function TextoMarkdown({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  const blocos: ReactNode[] = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    if (ehLinhaTabela(l)) {
      const grupo: string[] = [];
      while (i < linhas.length && ehLinhaTabela(linhas[i])) grupo.push(linhas[i++]);
      const celulas = (x: string) => x.trim().slice(1, -1).split("|").map((c) => c.trim());
      const [cab, ...resto] = grupo;
      const corpo = resto.filter((r) => !ehSeparadorTabela(r));
      blocos.push(
        <div key={blocos.length} className="my-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-left dark:border-slate-600">
                {celulas(cab).map((c, k) => (
                  <th key={k} className="py-1 pr-3 font-medium">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpo.map((r, k) => (
                <tr key={k} className="border-b border-slate-200 last:border-0 dark:border-slate-700">
                  {celulas(r).map((c, j) => (
                    <td key={j} className="py-1 pr-3">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordenada = /^\s*\d+\./.test(l);
      const itens: string[] = [];
      while (i < linhas.length && /^\s*([-*]|\d+\.)\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      const Lista = ordenada ? "ol" : "ul";
      blocos.push(
        <Lista key={blocos.length} className={`my-1 ml-5 space-y-0.5 ${ordenada ? "list-decimal" : "list-disc"}`}>
          {itens.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </Lista>,
      );
      continue;
    }
    const paragrafo: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !ehLinhaTabela(linhas[i]) && !/^\s*([-*]|\d+\.)\s+/.test(linhas[i])) paragrafo.push(linhas[i++]);
    blocos.push(
      <p key={blocos.length} className="my-1">
        {inline(paragrafo.join(" "))}
      </p>,
    );
  }
  return <div className="text-sm leading-relaxed">{blocos}</div>;
}
