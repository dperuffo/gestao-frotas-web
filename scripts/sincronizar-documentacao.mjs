// Copia os dois documentos HTML (Arquitetura FNI e Documentação FNI) da pasta
// Benchmark para dentro do app, como módulos TypeScript (mesmo padrão de
// src/app/_landing/legal/*.ts — o conteúdo vai junto no build, sem depender
// de arquivo em disco no servidor). Uso:
//   node scripts/sincronizar-documentacao.mjs "/Volumes/Daniel_Externo/Projetos/Benchmark"
// Ajustes aplicados na cópia (o original em Benchmark não muda):
//  - Mermaid vem de /vendor/mermaid.min.js (hospedado aqui; a CSP do site não
//    libera cdnjs).
//  - A referência ao arquivo "Arquitetura FNI.html" vira link para a rota.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pasta = process.argv[2];
if (!pasta) {
  console.error('Informe a pasta Benchmark: node scripts/sincronizar-documentacao.mjs "<pasta>"');
  process.exit(1);
}

const alvos = [
  { origem: "Arquitetura FNI.html", destino: "src/app/_docs/arquitetura.ts" },
  { origem: "Documentação FNI.html", destino: "src/app/_docs/funcional.ts" },
];

for (const { origem, destino } of alvos) {
  let html = readFileSync(join(pasta, origem), "utf8");
  html = html.replace(
    /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/mermaid\/[\d.]+\/mermaid\.min\.js/g,
    "/vendor/mermaid.min.js"
  );
  html = html.replace(
    "<code>Arquitetura FNI.html</code>",
    '<a href="/documentacao/arquitetura"><code>Arquitetura FNI</code></a>'
  );
  const conteudo =
    "// GERADO por scripts/sincronizar-documentacao.mjs — não editar à mão.\n" +
    `export const HTML: string = ${JSON.stringify(html)};\n`;
  writeFileSync(destino, conteudo);
  console.log(`${destino}: ${(html.length / 1024).toFixed(0)} KB`);
}
