import { UFS, ESTADO_PARA_UF } from "./constants";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

// Ano/mês/dia direto da string "YYYY-MM-DD" (ou "YYYY-MM-DDT...") sem passar
// por `new Date()` — evitar isso é proposital: `new Date("2026-06-01")` é
// interpretado como meia-noite UTC, e em fuso negativo (Brasil, UTC-3) vira
// "2026-05-31 21:00" no horário local, deslocando dia/mês/ano quando lido de
// volta via getDate()/getMonth()/getFullYear(). String slicing não sofre
// disso. Usar sempre que precisar comparar/filtrar por ano ou mês a partir
// de uma coluna `date` do Postgres.
export function anoMesDeIso(value: string): { ano: number; mes: number; dia: number } {
  return { ano: Number(value.slice(0, 4)), mes: Number(value.slice(5, 7)), dia: Number(value.slice(8, 10)) };
}

// Mesma lógica do formatDate, mas sem o bug de fuso — formata "YYYY-MM-DD"
// pra "DD/MM/YYYY" via string, sem instanciar Date.
export function formatarDataBr(value: string | null | undefined): string {
  if (!value) return "—";
  const { ano, mes, dia } = anoMesDeIso(value);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

// Versão curta (DD/MM) usada em eixos de gráfico.
export function formatarDataCurta(value: string | null | undefined): string {
  if (!value) return "—";
  const { mes, dia } = anoMesDeIso(value);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

// Fase 27.62 — data/hora (não só data) pra colunas "atualizado em" de
// auditoria (preços, negociações). Ao contrário de formatarDataBr, aqui
// `new Date()` é correto: o valor é timestamptz (um instante de verdade),
// não uma coluna `date` pura — o bug de fuso do formatDate só existe pra
// datas sem horário, lidas como meia-noite UTC.
export function formatarDataHoraBr(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function formatCNPJ(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "—";
}

// Fase Fuso-Horario-Abastecimento (29/08/2026, pedido do Daniel: confusão de
// horário entre abastecimentos lançados na web e no PWA). Todo campo
// "data/hora do abastecimento" digitado por um humano (input datetime-local
// no formulário web, ou texto de planilha) é sempre horário de Brasília
// puro, SEM fuso — passar isso direto pra `new Date(texto)` é ambíguo,
// porque o parser usa o fuso do PROCESSO Node que roda o parse, não o do
// usuário: no notebook do dev (America/Sao_Paulo) dava certo, no container
// do servidor (que pode rodar em UTC) o mesmo texto virava um instante 3h
// adiantado. Fixamos a leitura em -03:00 (Brasil não tem mais horário de
// verão desde 2019 — é um offset fixo o ano inteiro), nunca dependendo do
// fuso de quem roda o código. Aceita "AAAA-MM-DDTHH:mm"/"AAAA-MM-DD HH:mm"
// (com ou sem segundos) ou só "AAAA-MM-DD" (assume 00:00).
export function dataHoraBrParaIso(value: string | null | undefined): string | null {
  const texto = (value ?? "").trim().replace(" ", "T");
  if (!texto) return null;
  const comHora = texto.includes("T") ? texto : `${texto}T00:00`;
  const data = new Date(`${comHora}-03:00`);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

// Normaliza um CNPJ para comparação: remove pontuação (ponto, barra, traço,
// espaço) e deixa tudo maiúsculo. Importante: a partir de 2026 a Receita
// Federal passou a emitir CNPJs alfanuméricos (com letras, não só números),
// então NÃO dá para simplesmente remover letras como antes — isso juntaria
// CNPJs diferentes que só coincidem nos números.
export function normalizarCNPJ(value: string | null | undefined): string {
  return (value ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

// Fase CPF-obrigatorio-fonte (28/08/2026) — normaliza CPF pros 11 dígitos
// puros (aceita com ou sem pontuação, e recompõe zero à esquerda perdido
// quando o valor de origem veio como número). Sequências degeneradas (todo
// dígito igual) ou de tamanho errado viram null: não vale gravar um CPF que
// claramente não é um CPF real. Usado por toda entrada de abastecimento
// (PróFrotas, planilha, lançamento manual web) pra manter o mesmo critério.
export function normalizarCPF(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const digitos = String(value).replace(/\D/g, "").padStart(11, "0");
  if (digitos.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(digitos)) return null;
  return digitos;
}

// Normaliza nomes de município/estado para comparação entre fontes
// diferentes (a planilha oficial da ANP vem em maiúsculas sem acento; os
// cadastros dos postos vêm com a grafia original) — maiúsculas, sem acento,
// sem espaços duplicados.
export function normalizarTexto(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Resolve a UF (sigla, 2 letras) a partir de um valor bruto que pode já vir
// como sigla ("SP") OU como nome completo do estado ("São Paulo") — algumas
// planilhas de origem (ex: postos_gf.xlsx) usam o nome completo na coluna
// "UF". Se não conseguir resolver, devolve o valor normalizado mesmo assim
// (evita perder o dado, só não fica no formato padrão de sigla).
export function resolverUf(valorBruto: string | null | undefined): string | null {
  const bruto = (valorBruto ?? "").trim();
  if (!bruto) return null;

  const siglaDireta = bruto.toUpperCase();
  if ((UFS as readonly string[]).includes(siglaDireta)) return siglaDireta;

  const nomeNormalizado = normalizarTexto(bruto);
  return ESTADO_PARA_UF[nomeNormalizado] ?? nomeNormalizado;
}
