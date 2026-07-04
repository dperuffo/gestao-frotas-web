// Fase 27.30 — achado real (confirmado pelo log de produção do Railway):
// depois de 4 tentativas de correção sem sucesso (todas no nosso próprio
// código), o log do servidor finalmente mostrou o erro de verdade, sem
// mascaramento:
//
//   ⚠️  Node.js 20 and below are deprecated and will no longer be supported
//   by @supabase/supabase-js. Please upgrade to Node.js 22 or later.
//   (node:15) ExperimentalWarning: buffer.File is an experimental feature
//   ⨯ ReferenceError: File is not defined
//       at l (.next/server/chunks/7545.js:1:17432)
//       at async m (.next/server/app/(dashboard)/chamados/[id]/page.js:1:16356)
//
// O erro nunca esteve no nosso código (enviarAnexoAcao, a página do chamado
// ou o layout do dashboard já estavam corretos) — é o próprio SDK do
// Supabase que usa a classe global `File` internamente ao fazer upload pro
// Storage. No Node 20 (versão que o Railway estava rodando, sem nenhum
// "engines" declarado no package.json pra pedir uma versão mais nova), essa
// classe só existe de forma experimental (`buffer.File`), não como global
// padrão — daí o `ReferenceError`. Isso também explica por que só quebrava
// ao ANEXAR/RESPONDER num chamado existente: só esse fluxo realmente chega
// a chamar `storage.upload()` de novo depois da abertura inicial nesse
// ambiente específico (a abertura de chamado com anexo tem sua própria
// falha silenciosa — Fase 27.18 — que mascarava o mesmo problema).
//
// Correção definitiva: `package.json` agora declara `"engines": { "node":
// "22.x" }`, pedindo pro Railway (Nixpacks) provisionar Node 22, onde
// `File` já é um global estável. Este arquivo é uma segunda camada de
// segurança (roda uma vez, na inicialização do servidor Next): garante que
// `File` exista como global MESMO que, por qualquer motivo, o ambiente
// ainda suba com uma versão mais antiga do Node.
export async function register() {
  if (typeof globalThis.File === "undefined") {
    const { File } = await import("node:buffer");
    // @ts-expect-error -- polyfill defensivo, ver comentário acima
    globalThis.File = File;
  }
}
