"use server";

// Fase abre-import-precos-cliente (10/08/2026) — esta Server Action é uma
// "gêmea" órfã de /api/postos/importar-precos/route.ts: mesma lógica de
// importação de preço de posto, mas SEM NENHUMA checagem de permissão desde
// sempre (nunca recebeu a correção do achado C1, porque nenhuma tela do app
// chama esta função — a UI usa a rota de API, ver
// _components/ImportForm.tsx). Continuava, mesmo assim, invocável
// diretamente por qualquer usuário autenticado, com acesso de service role
// e zero filtro — gêmea não corrigida da mesma falha de segurança.
//
// Como não há nenhum caller no código (conferido por busca no repositório
// inteiro), desativamos em vez de reescrever: menos superfície de ataque
// pra manter sincronizada com a rota de verdade. Se algum dia precisar
// virar uma Server Action de novo, replicar a lógica de
// /api/postos/importar-precos/route.ts (permissão + escopo por empresa),
// não este arquivo.
export type ResultadoImportacaoPrecos =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; duplicadas: number };

export async function importarPrecos(
  _prev: ResultadoImportacaoPrecos | undefined,
  _formData: FormData
): Promise<ResultadoImportacaoPrecos> {
  return {
    erro: "Esta ação foi desativada. Use a importação em /postos/importar-precos.",
  };
}
