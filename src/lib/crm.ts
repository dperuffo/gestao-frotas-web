// Fase Grupo 2 (Rodopar/Datapar, item 5) — CRM Comercial: funil de propostas
// e histórico de relacionamento pra ajudar o cliente da FNI (a
// transportadora) a vender mais frete pros clientes dele. Reaproveita o que
// já existe — cadastros_parceiros (papel='tomador') como carteira de
// clientes, cotacoes (status simulada/convertida/descartada) como funil de
// propostas — e adiciona só o que faltava: clientes_interacoes.
export const TIPO_INTERACAO_LABEL: Record<string, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  reuniao: "Reunião",
  visita: "Visita",
  outro: "Outro",
};

export const STATUS_PROPOSTA_LABEL: Record<string, string> = {
  simulada: "Em aberto",
  convertida: "Ganha",
  descartada: "Perdida",
};

export const STATUS_PROPOSTA_COR: Record<string, string> = {
  simulada: "badge-ativo",
  convertida: "bg-green-100 text-green-800",
  descartada: "badge-inativo",
};

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(valor: string | null | undefined): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("pt-BR");
}

export function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
}

export function formatarCnpjCpf(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 14) {
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  if (digitos.length === 11) {
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return valor;
}
