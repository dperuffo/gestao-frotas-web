// Validação da regra de consumo (km/l) — compartilhada pela tela de Parâmetros de
// uso (conceitualmente), pelo Assistente FNI (proposta) e pela confirmação.
export type EntradaRegraConsumo = {
  marcaContem?: string | null;
  placa?: string | null;
  consumoMinimo: number;
  consumoMaximo: number;
  percentualTanqueMinimo?: number | null;
};

export type RegraConsumoValida = {
  marcaContem: string | null;
  placa: string | null;
  consumoMinimo: number;
  consumoMaximo: number;
  percentualTanqueMinimo: number;
};

// Devolve a regra normalizada ou uma mensagem de erro (string).
export function validarRegraConsumo(e: EntradaRegraConsumo): RegraConsumoValida | string {
  // marca: só letras/números/espaço/hífen (vira ILIKE no banco — nada de curingas)
  const marca = (e.marcaContem ?? "").trim().replace(/\s+/g, " ");
  const placa = (e.placa ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (Boolean(marca) === Boolean(placa)) return "Informe a marca/modelo OU a placa (apenas um dos dois).";
  if (marca && !/^[\p{L}\p{N} -]{2,40}$/u.test(marca)) return "Marca/modelo inválido (use letras e números, 2 a 40 caracteres).";
  if (placa && !/^[A-Z0-9]{7}$/.test(placa)) return "Placa inválida.";
  const { consumoMinimo: min, consumoMaximo: max } = e;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return "Informe o consumo mínimo e máximo (km/l).";
  if (min < 0 || max < min || max > 100) return "Faixa de consumo inválida (mínimo ≥ 0, máximo ≥ mínimo e ≤ 100 km/l).";
  const pct = e.percentualTanqueMinimo ?? 50;
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return "O percentual mínimo do tanque deve ficar entre 0 e 100.";
  return {
    marcaContem: marca || null,
    placa: placa || null,
    consumoMinimo: min,
    consumoMaximo: max,
    percentualTanqueMinimo: pct,
  };
}

export function descreverRegraConsumo(r: RegraConsumoValida): string {
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const alvo = r.placa ? `o veículo ${r.placa}` : `veículos cuja marca/modelo contém “${r.marcaContem}”`;
  return `Para ${alvo}: bloquear o abastecimento quando o consumo estimado ficar fora de ${fmt(r.consumoMinimo)} a ${fmt(r.consumoMaximo)} km/l (avaliado só se o abastecimento encher ao menos ${fmt(r.percentualTanqueMinimo)}% do tanque e houver hodômetro atual e anterior).`;
}
