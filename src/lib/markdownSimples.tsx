import type { ReactNode } from "react";

// Fase Central-Avisos (28/07/2026) — "markdown simples" (negrito, links,
// listas, título), decisão do Daniel em vez de subir a régua pra um editor
// WYSIWYG ou depender de uma lib de markdown completa. Parser próprio, sem
// dependência nova e sem dangerouslySetInnerHTML — importa porque o campo
// `corpo` é texto livre digitado pelo admin, mas renderizado no navegador de
// QUALQUER cliente da plataforma (mesmo cuidado que já vale pra qualquer
// conteúdo dinâmico exibido como HTML).
//
// Suporta, linha a linha:
//   # Título          -> <h3>
//   - item de lista    -> <li> (linhas consecutivas viram um <ul>)
//   linha em branco    -> quebra de parágrafo
//   qualquer outra     -> parágrafo (linhas consecutivas juntam com <br/>)
// E, dentro de qualquer linha de texto:
//   **negrito**        -> <strong>
//   [texto](url)       -> <a target="_blank" rel="noopener noreferrer">, só http(s)
export function renderMarkdownSimples(texto: string): ReactNode {
  const linhas = (texto ?? "").split("\n");
  const blocos: ReactNode[] = [];
  let paragrafoAtual: string[] = [];
  let listaAtual: string[] = [];

  function fecharParagrafo() {
    if (paragrafoAtual.length === 0) return;
    const linhasParagrafo = paragrafoAtual;
    blocos.push(
      <p key={`p-${blocos.length}`}>
        {linhasParagrafo.map((linha, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {renderInline(linha)}
          </span>
        ))}
      </p>
    );
    paragrafoAtual = [];
  }

  function fecharLista() {
    if (listaAtual.length === 0) return;
    const itensLista = listaAtual;
    blocos.push(
      <ul key={`ul-${blocos.length}`} className="list-disc space-y-1 pl-5">
        {itensLista.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listaAtual = [];
  }

  for (const linhaRaw of linhas) {
    const linha = linhaRaw.trimEnd();
    if (linha.trim() === "") {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    if (linha.startsWith("# ")) {
      fecharParagrafo();
      fecharLista();
      blocos.push(
        <h3 key={`h-${blocos.length}`} className="text-base font-semibold text-slate-900">
          {renderInline(linha.slice(2))}
        </h3>
      );
      continue;
    }
    if (linha.startsWith("- ")) {
      fecharParagrafo();
      listaAtual.push(linha.slice(2));
      continue;
    }
    fecharLista();
    paragrafoAtual.push(linha);
  }
  fecharParagrafo();
  fecharLista();

  return <>{blocos}</>;
}

// Negrito (**texto**) e links ([texto](url)) dentro de uma única linha —
// link sempre abre em nova aba (rel=noopener, mesmo cuidado de qualquer link
// externo na aplicação) e só aceita http(s), pra não virar vetor de
// javascript:/data: URL.
function renderInline(linha: string): ReactNode {
  const partes: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;
  let ultimoIndice = 0;
  let match: RegExpExecArray | null;
  let chave = 0;

  while ((match = regex.exec(linha)) !== null) {
    if (match.index > ultimoIndice) {
      partes.push(linha.slice(ultimoIndice, match.index));
    }
    if (match[1] !== undefined) {
      partes.push(<strong key={chave++}>{match[1]}</strong>);
    } else if (match[2] !== undefined && match[3] !== undefined) {
      partes.push(
        <a
          key={chave++}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-frota-600 underline hover:text-frota-700"
        >
          {match[2]}
        </a>
      );
    }
    ultimoIndice = regex.lastIndex;
  }
  if (ultimoIndice < linha.length) {
    partes.push(linha.slice(ultimoIndice));
  }
  return partes;
}
