import { Fragment } from "react";

// Renderizador bem simples pro "texto" das lições (armazenado como texto
// puro na tabela conteudo_ajuda, com convenções leves em vez de markdown
// de verdade — decisão deliberada de não trazer uma lib de markdown nova
// só pra isso): parágrafos separados por linha em branco, **negrito**, e
// linhas começando com "- " viram lista.
export function TextoFormatado({ texto }: { texto: string }) {
  const blocos = texto.split(/\n\s*\n/).filter(Boolean);

  return (
    <>
      {blocos.map((bloco, i) => {
        const linhas = bloco.split("\n").map((l) => l.trim()).filter(Boolean);
        const ehLista = linhas.length > 0 && linhas.every((l) => l.startsWith("- "));

        if (ehLista) {
          return (
            <ul key={i} className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {linhas.map((l, j) => (
                <li key={j}>{formatarNegrito(l.slice(2))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="my-3 text-sm leading-relaxed text-slate-700">
            {formatarNegrito(linhas.join(" "))}
          </p>
        );
      })}
    </>
  );
}

function formatarNegrito(texto: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**")) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{parte}</Fragment>;
  });
}
