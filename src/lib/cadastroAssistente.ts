import { CLASSIFICACAO, TIPO_PORTE_VEICULO } from "@/lib/constants";

// Cadastro de veículo e motorista pelo Assistente FNI: validação e normalização
// compartilhadas entre a PROPOSTA (ferramenta do modelo) e a CONFIRMAÇÃO (server
// action). Nada aqui grava. Excluir de verdade não existe: "inativar" mantém o
// cadastro e o histórico (abastecimentos, multas, fretes).

export type EntidadeCadastro = "veiculo" | "motorista";
export type AcaoCadastro = "criar" | "alterar" | "inativar" | "reativar";

export type CamposCadastro = Record<string, string | number | null>;

export type CadastroValido = {
  entidade: EntidadeCadastro;
  acao: AcaoCadastro;
  // Veículo: placa atual (7 caracteres). Motorista: CPF (11 dígitos) ou nome.
  identificador: string;
  campos: CamposCadastro;
};

const ROTULOS: Record<EntidadeCadastro, Record<string, string>> = {
  veiculo: {
    placa: "Placa",
    marca: "Marca",
    modelo: "Modelo",
    ano_modelo: "Ano do modelo",
    ano_fabricacao: "Ano de fabricação",
    hodometro_atual: "Hodômetro (km)",
    combustivel: "Combustível",
    tanque: "Tanque (L)",
    autonomia: "Autonomia (km/l)",
    cor: "Cor",
    chassi: "Chassi",
    renavam: "Renavam",
    uf_veiculo: "UF",
    municipio: "Município",
    numero_eixos: "Eixos",
    classificacao: "Classificação",
    tipo: "Porte",
  },
  motorista: {
    nome_completo: "Nome completo",
    cpf: "CPF",
    telefone: "Telefone",
    email: "E-mail",
    cnh: "CNH",
    cnh_vencimento: "Vencimento da CNH",
    exame_toxicologico_vencimento: "Vencimento do toxicológico",
    aso_vencimento: "Vencimento do ASO",
    classificacao: "Classificação",
  },
};

export function rotuloCampo(entidade: EntidadeCadastro, campo: string): string {
  return ROTULOS[entidade][campo] ?? campo;
}

export function normalizarPlaca(valor: unknown): string {
  return String(valor ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Placa antiga (ABC1234) ou Mercosul (ABC1D23).
export function placaValida(placa: string): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa);
}

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9), 10) === Number(cpf[9]) && digito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

const texto = (v: unknown, max: number): string | null => {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
};

function numero(v: unknown, min: number, max: number, inteiro = false): number | null | "invalido" {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max || (inteiro && !Number.isInteger(n))) return "invalido";
  return n;
}

function data(v: unknown): string | null | "invalido" {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "invalido";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return "invalido";
  const ano = Number(iso.slice(0, 4));
  return ano < 1990 || ano > 2100 ? "invalido" : iso;
}

// Normaliza os campos de um veículo. Campos desconhecidos são ignorados.
function camposVeiculo(entrada: Record<string, unknown>): CamposCadastro | string {
  const out: CamposCadastro = {};
  const anoAtual = new Date().getFullYear();
  for (const [k, v] of Object.entries(entrada)) {
    switch (k) {
      case "placa": {
        const p = normalizarPlaca(v);
        if (!placaValida(p)) return "Placa inválida (use o formato ABC1234 ou ABC1D23).";
        out.placa = p;
        break;
      }
      case "marca": out.marca = texto(v, 60); break;
      case "modelo": out.modelo = texto(v, 80); break;
      case "cor": out.cor = texto(v, 30); break;
      case "combustivel": out.combustivel = texto(v, 40); break;
      case "chassi": {
        const c = String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (c && c.length !== 17) return "Chassi inválido (deve ter 17 caracteres).";
        out.chassi = c || null;
        break;
      }
      case "renavam": {
        const r = String(v ?? "").replace(/\D/g, "");
        if (r && (r.length < 9 || r.length > 11)) return "Renavam inválido (9 a 11 dígitos).";
        out.renavam = r || null;
        break;
      }
      case "uf_veiculo": {
        const u = String(v ?? "").trim().toUpperCase();
        if (u && !/^[A-Z]{2}$/.test(u)) return "UF inválida (use a sigla, ex.: SP).";
        out.uf_veiculo = u || null;
        break;
      }
      case "municipio": out.municipio = texto(v, 80); break;
      case "ano_modelo":
      case "ano_fabricacao": {
        const n = numero(v, 1950, anoAtual + 1, true);
        if (n === "invalido") return `${rotuloCampo("veiculo", k)} inválido.`;
        out[k] = n;
        break;
      }
      case "hodometro_atual": {
        const n = numero(v, 0, 5_000_000);
        if (n === "invalido") return "Hodômetro inválido.";
        out.hodometro_atual = n;
        break;
      }
      case "tanque": {
        const n = numero(v, 1, 2000);
        if (n === "invalido") return "Capacidade do tanque inválida (1 a 2000 L).";
        out.tanque = n;
        break;
      }
      case "autonomia": {
        const n = numero(v, 0.1, 100);
        if (n === "invalido") return "Autonomia inválida (0,1 a 100 km/l).";
        out.autonomia = n;
        break;
      }
      case "numero_eixos": {
        const n = numero(v, 1, 12, true);
        if (n === "invalido") return "Número de eixos inválido (1 a 12).";
        out.numero_eixos = n;
        break;
      }
      case "classificacao": {
        const c = CLASSIFICACAO.find((x) => x.toLowerCase() === String(v ?? "").trim().toLowerCase());
        if (!c) return `Classificação inválida (use ${CLASSIFICACAO.join(" ou ")}).`;
        out.classificacao = c;
        break;
      }
      case "tipo": {
        const t = TIPO_PORTE_VEICULO.find((x) => x.toLowerCase() === String(v ?? "").trim().toLowerCase());
        if (!t) return `Porte inválido (use ${TIPO_PORTE_VEICULO.join(" ou ")}).`;
        out.tipo = t;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function camposMotorista(entrada: Record<string, unknown>): CamposCadastro | string {
  const out: CamposCadastro = {};
  for (const [k, v] of Object.entries(entrada)) {
    switch (k) {
      case "nome_completo": {
        const n = texto(v, 120);
        if (!n || n.length < 3) return "Nome completo inválido.";
        out.nome_completo = n;
        break;
      }
      case "cpf": {
        const c = String(v ?? "").replace(/\D/g, "");
        if (!cpfValido(c)) return "CPF inválido.";
        out.cpf = c;
        break;
      }
      case "telefone": {
        const t = String(v ?? "").replace(/\D/g, "");
        if (t && (t.length < 10 || t.length > 13)) return "Telefone inválido (com DDD).";
        out.telefone = t || null;
        break;
      }
      case "email": {
        const e = String(v ?? "").trim().toLowerCase();
        if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "E-mail inválido.";
        out.email = e || null;
        break;
      }
      case "cnh": {
        const c = String(v ?? "").replace(/\D/g, "");
        if (c && c.length !== 11) return "CNH inválida (11 dígitos).";
        out.cnh = c || null;
        break;
      }
      case "cnh_vencimento":
      case "exame_toxicologico_vencimento":
      case "aso_vencimento": {
        const d = data(v);
        if (d === "invalido") return `${rotuloCampo("motorista", k)} inválido (use DD/MM/AAAA).`;
        out[k] = d;
        break;
      }
      case "classificacao": {
        const c = CLASSIFICACAO.find((x) => x.toLowerCase() === String(v ?? "").trim().toLowerCase());
        if (!c) return `Classificação inválida (use ${CLASSIFICACAO.join(" ou ")}).`;
        out.classificacao = c;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

const ENTIDADES: EntidadeCadastro[] = ["veiculo", "motorista"];
const ACOES: AcaoCadastro[] = ["criar", "alterar", "inativar", "reativar"];

// Devolve o cadastro normalizado ou uma mensagem de erro (string).
export function validarCadastro(e: {
  entidade: unknown;
  acao: unknown;
  identificador?: unknown;
  campos?: unknown;
}): CadastroValido | string {
  const entidade = ENTIDADES.find((x) => x === e.entidade);
  if (!entidade) return "Entidade inválida (use veiculo ou motorista).";
  const acao = ACOES.find((x) => x === e.acao);
  if (!acao) return "Ação inválida (use criar, alterar, inativar ou reativar).";

  const bruto = e.campos && typeof e.campos === "object" && !Array.isArray(e.campos) ? (e.campos as Record<string, unknown>) : {};
  const campos = entidade === "veiculo" ? camposVeiculo(bruto) : camposMotorista(bruto);
  if (typeof campos === "string") return campos;

  if (acao === "criar") {
    if (entidade === "veiculo" && !campos.placa) return "Informe a placa do veículo.";
    if (entidade === "motorista" && (!campos.nome_completo || !campos.cpf)) return "Informe o nome completo e o CPF do motorista.";
    return { entidade, acao, identificador: String(entidade === "veiculo" ? campos.placa : campos.cpf), campos };
  }

  // alterar / inativar / reativar: precisa dizer QUAL cadastro.
  let identificador = "";
  if (entidade === "veiculo") {
    identificador = normalizarPlaca(e.identificador);
    if (!placaValida(identificador)) return "Informe a placa do veículo que será alterado (formato ABC1234 ou ABC1D23).";
  } else {
    const bruta = String(e.identificador ?? "").trim();
    const digitos = bruta.replace(/\D/g, "");
    identificador = digitos.length === 11 ? digitos : bruta.replace(/\s+/g, " ");
    if (identificador.length < 3) return "Informe o CPF ou o nome do motorista.";
  }

  if (acao === "alterar" && Object.keys(campos).length === 0) return "Informe ao menos um campo para alterar.";
  if (acao !== "alterar") return { entidade, acao, identificador, campos: {} };
  return { entidade, acao, identificador, campos };
}

export type MudancaCadastro = { campo: string; rotulo: string; de: string; para: string };

const formatar = (v: unknown): string => (v === null || v === undefined || v === "" ? "(vazio)" : String(v));

// Compara o cadastro atual com os campos propostos; só devolve o que realmente muda.
export function calcularMudancas(
  entidade: EntidadeCadastro,
  atual: Record<string, unknown>,
  campos: CamposCadastro
): MudancaCadastro[] {
  const mudancas: MudancaCadastro[] = [];
  for (const [campo, novo] of Object.entries(campos)) {
    const antigo = atual[campo] ?? null;
    const vazioAntigo = antigo === null || antigo === "";
    const vazioNovo = novo === null || novo === "";
    const igual =
      vazioAntigo || vazioNovo
        ? vazioAntigo && vazioNovo
        : typeof novo === "number"
          ? Number(antigo) === novo
          : String(antigo) === String(novo);
    if (!igual) {
      mudancas.push({ campo, rotulo: rotuloCampo(entidade, campo), de: formatar(antigo), para: formatar(novo) });
    }
  }
  return mudancas;
}

export function descreverCadastro(
  v: CadastroValido,
  alvo: string,
  mudancas: MudancaCadastro[]
): string {
  const quem = v.entidade === "veiculo" ? `o veículo ${alvo}` : `o motorista ${alvo}`;
  switch (v.acao) {
    case "criar":
      return `Cadastrar ${v.entidade === "veiculo" ? "o veículo" : "o motorista"} ${alvo}.`;
    case "alterar":
      return `Alterar ${quem}: ${mudancas.map((m) => `${m.rotulo} (${m.de} → ${m.para})`).join("; ")}.`;
    case "inativar":
      return `Inativar ${quem}. O cadastro e o histórico são mantidos; ${v.entidade === "veiculo" ? "o veículo" : "o motorista"} deixa de aparecer como ativo.`;
    case "reativar":
      return `Reativar ${quem}.`;
  }
}
