// Stub usado só nos testes (ver vitest.config.ts, alias "server-only") —
// fora do Next.js (rodando com `vitest run`, Node puro) o pacote real
// "server-only" não existe/não precisa existir: ele é resolvido pelo
// bundler do Next em tempo de build, não por npm install. Os arquivos que
// importam "server-only" (logger.ts, cache.ts etc.) continuam podendo ser
// testados normalmente — a proteção real "nunca rodar no navegador" segue
// valendo em produção, isto aqui é só pra não quebrar o teste.
export {};
