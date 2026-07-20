// Mesma lógica já usada (duplicada) em manutencao-preditiva/actions.ts e
// chamados/actions.ts — centralizada aqui pra novos uploads (ex.:
// central-conteudo/actions.ts) não precisarem copiar de novo. Os dois
// lugares antigos não foram tocados pra não arriscar regressão fora do
// escopo desta mudança.
export function sanitizarNomeParaStorage(nomeOriginal: string): string {
  const combinacoesDiacriticas = new RegExp("[̀-ͯ]", "g");
  const semAcentos = nomeOriginal.normalize("NFD").replace(combinacoesDiacriticas, "");
  const seguro = semAcentos.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return seguro.slice(-150) || "arquivo";
}
