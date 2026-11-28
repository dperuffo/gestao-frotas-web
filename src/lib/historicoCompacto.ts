// Histórico bruto de preços de postos em formato COMPACTO (RPC historico_precos_compacto).
// Motivo: a RPC antiga (historico_precos_detalhado) devolvia ~77 mil linhas e o PostgREST
// truncava a resposta, escondendo os meses mais recentes. Agora o banco manda tudo num
// JSON único (sem corte de linhas) com dicionários de postos e combustíveis: ~2 MB em vez
// de ~11 MB. Cada linha = [idxPosto, idxCombustivel, dias desde 2000-01-01, preço].
export type HistoricoCompacto = {
  postos: [string, string | null, string | null, string | null][]; // [cnpj, razaoSocial, municipio, uf]
  combustiveis: string[];
  linhas: [number, number, number, number][];
};

export type RegistroHistorico = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  combustivel: string;
  dataRef: string;
  preco: number;
};

const BASE_MS = Date.UTC(2000, 0, 1);

export const HISTORICO_COMPACTO_VAZIO: HistoricoCompacto = { postos: [], combustiveis: [], linhas: [] };

export function normalizarHistoricoCompacto(valor: unknown): HistoricoCompacto {
  if (!valor || typeof valor !== "object") return HISTORICO_COMPACTO_VAZIO;
  const v = valor as Partial<HistoricoCompacto>;
  return {
    postos: Array.isArray(v.postos) ? v.postos : [],
    combustiveis: Array.isArray(v.combustiveis) ? v.combustiveis : [],
    linhas: Array.isArray(v.linhas) ? v.linhas : [],
  };
}

export function descompactarHistorico(c: HistoricoCompacto): RegistroHistorico[] {
  const datas = new Map<number, string>();
  return c.linhas.map(([ip, ic, dias, preco]) => {
    let dataRef = datas.get(dias);
    if (dataRef === undefined) {
      dataRef = new Date(BASE_MS + dias * 86_400_000).toISOString().slice(0, 10);
      datas.set(dias, dataRef);
    }
    const [cnpj, razaoSocial, municipio, uf] = c.postos[ip];
    return { cnpj, razaoSocial, municipio, uf, combustivel: c.combustiveis[ic], dataRef, preco: Number(preco) };
  });
}
