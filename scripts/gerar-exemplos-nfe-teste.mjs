#!/usr/bin/env node
// Fase 27.96 — pedido do Daniel: "criar um repositório... com exemplos de
// XML de notas fiscais de abastecimentos para eu testar o fluxo. Podem ser
// notas que vão dar o match automático e outras que exibirão mensagens de
// pendências". Este "robô" gera XMLs de NFe (modelo 55) fictícios, mas
// estruturalmente válidos, cada um pensado pra exercitar um caminho
// diferente do fluxo de upload (Fase 27.94): match automático, sem
// correspondência, fora de tolerância, código ANP incorreto, NFe não
// autorizada, modelo inválido e correspondência ambígua.
//
// Os cenários de "match automático" e "ANP incorreto" apontam pra
// abastecimentos DEDICADOS (não aleatórios do robô de teste diário),
// criados especificamente pra este arquivo (sync_key começando com
// "teste-xml-exemplo-"), com combinações posto+cliente+combustível de
// baixíssimo volume — evita que o abastecimento "gêmeo" apareça no meio
// dos milhares de registros aleatórios do robô de teste diário e vire uma
// correspondência ambígua sem querer (isso realmente aconteceu numa
// primeira tentativa: Gasolina Comum/Etanol Aditivado no Posto Teste têm
// 1000+ abastecimentos pra este cliente, então CNPJ+quantidade±0,5L+valor
// ±2% quase sempre bate em mais de um). Cada cenário foi CONFERIDO rodando
// a RPC real (buscar_abastecimentos_candidatos_nota_fiscal) antes de
// fechar os valores abaixo — se você rodar o robô de abastecimentos de
// novo, é seguro, os IDs/sync_keys destes registros de teste não mudam.
//
// Uso: node scripts/gerar-exemplos-nfe-teste.mjs [pasta-de-saida]
// Sem argumento, salva em ./exemplos-nfe-teste (relativo ao diretório atual).

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const pastaSaida = process.argv[2] || "./exemplos-nfe-teste";
if (!existsSync(pastaSaida)) mkdirSync(pastaSaida, { recursive: true });

// ---------------------------------------------------------------------
// Chave de acesso da NFe: cUF(2) + AAMM(4) + CNPJ emitente(14) + mod(2) +
// serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1) = 44 dígitos, com o
// dígito verificador calculado pelo módulo 11 oficial (peso 2..9,
// repetindo), igual ao que a SEFAZ usa de verdade — pra gerar uma chave
// plausível mesmo sendo um XML de teste.
function calcularDV(chave43) {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function gerarChaveAcesso({ cnpjEmitente, serie, nNF, dataEmissao, cNF }) {
  const d = new Date(dataEmissao);
  const aamm = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0");
  const cnpjDigitos = cnpjEmitente.replace(/\D/g, "");
  const base =
    "31" + // cUF — Minas Gerais, mesmo do XML de exemplo original
    aamm +
    cnpjDigitos +
    "55" + // modelo
    String(serie).padStart(3, "0") +
    String(nNF).padStart(9, "0") +
    "1" + // tpEmis — normal
    String(cNF).padStart(8, "0");
  return base + String(calcularDV(base));
}

function formatarDataISO(iso) {
  return iso; // já vem no formato -03:00 esperado pelo <dhEmi>
}

// Fase 27.96 — achado testando os próprios exemplos gerados: o CNPJ do
// cliente de teste é propositalmente alfanumérico ("N6.SL9.PHV/0001-84",
// ver nota no topo do arquivo). Escrever o <CNPJ> do XML com
// .replace(/\D/g,"") (só dígitos) corta as letras e grava um valor de 8
// caracteres em vez dos 14 alfanuméricos esperados — o XML gerado nunca
// tinha o valor certo, então nem o fix em normalizarCnpj() (src/lib/nfe.ts)
// conseguia casar. Mesma normalização alfanumérica usada em toda parte
// (SQL: regexp_replace(upper(x),'[^0-9A-Z]','','g'); TS: normalizarCnpj).
function normalizarCnpj(v) {
  return String(v ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

// ---------------------------------------------------------------------
// Monta o XML no mesmo formato do exemplo real anexado pelo Daniel
// (nfeProc > NFe > infNFe, com protNFe/infProt anexado) — só os campos que
// o parser da FNI (src/lib/nfe.ts) realmente lê, sem o bloco de assinatura
// digital (não faz sentido num XML de teste, e o parser não valida isso).
function montarXml({
  chave,
  serie,
  nNF,
  dataEmissao,
  cnpjEmitente,
  nomeEmitente,
  cnpjDestinatario,
  nomeDestinatario,
  produtoNome,
  codigoAnp,
  descricaoAnp,
  quantidade,
  valorUnitario,
  valorTotal,
  cStat = "100",
  xMotivo = "Autorizado o uso da NF-e",
  modelo = "55",
}) {
  const vProd = valorTotal.toFixed(2);
  const vUnCom = valorUnitario.toFixed(6);
  const qCom = quantidade.toFixed(4);

  return `<?xml version="1.0" encoding="UTF-8" ?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${chave}" versao="4.00"><ide><cUF>31</cUF><cNF>${chave.slice(35, 43)}</cNF><natOp>VENDA DE COMBUSTIVEL</natOp><mod>${modelo}</mod><serie>${serie}</serie><nNF>${nNF}</nNF><dhEmi>${formatarDataISO(
    dataEmissao
  )}</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>3126901</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${chave.slice(
    -1
  )}</cDV><tpAmb>1</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>fni-teste-1.0</verProc></ide><emit><CNPJ>${normalizarCnpj(
    cnpjEmitente
  )}</CNPJ><xNome>${nomeEmitente}</xNome><enderEmit><xLgr>RUA DE TESTE</xLgr><nro>100</nro><xBairro>CENTRO</xBairro><cMun>3126901</cMun><xMun>FREI INOCENCIO</xMun><UF>MG</UF><CEP>35112000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit><IE>ISENTO</IE><CRT>3</CRT></emit><dest><CNPJ>${normalizarCnpj(
    cnpjDestinatario
  )}</CNPJ><xNome>${nomeDestinatario}</xNome><enderDest><xLgr>AV DE TESTE</xLgr><nro>200</nro><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01000000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderDest><indIEDest>9</indIEDest></dest><det nItem="1"><prod><cProd>1</cProd><cEAN>SEM GTIN</cEAN><xProd>${produtoNome}</xProd><NCM>27101921</NCM><CFOP>5929</CFOP><uCom>L</uCom><qCom>${qCom}</qCom><vUnCom>${vUnCom}</vUnCom><vProd>${vProd}</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>L</uTrib><qTrib>${qCom}</qTrib><vUnTrib>${vUnCom}</vUnTrib><indTot>1</indTot><comb><cProdANP>${codigoAnp}</cProdANP><descANP>${descricaoAnp}</descANP><UFCons>SP</UFCons></comb></prod><imposto><vTotTrib>0.00</vTotTrib><ICMS><ICMS40><orig>0</orig><CST>40</CST></ICMS40></ICMS><PIS><PISNT><CST>04</CST></PISNT></PIS><COFINS><COFINSNT><CST>04</CST></COFINSNT></COFINS></imposto></det><total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${vProd}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${vProd}</vNF><vTotTrib>0.00</vTotTrib></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag><detPag><tPag>99</tPag><xPag>PRO FROTAS</xPag><vPag>${vProd}</vPag></detPag></pag><infAdic><infCpl>XML DE TESTE GERADO PELO ROBO DE EXEMPLOS FNI (Fase 27.96) - NAO E UMA NFE REAL</infCpl></infAdic></infNFe></NFe><protNFe versao="4.00"><infProt Id="ID1${chave.slice(
    1
  )}"><tpAmb>1</tpAmb><verAplic>fni-teste-1.0</verAplic><chNFe>${chave}</chNFe><dhRecbto>${formatarDataISO(
    dataEmissao
  )}</dhRecbto><nProt>1${chave.slice(1, 15)}</nProt><cStat>${cStat}</cStat><xMotivo>${xMotivo}</xMotivo></infProt></protNFe></nfeProc>`;
}

// ---------------------------------------------------------------------
// Dados fixos dos 2 postos/1 cliente de teste já usados em todas as fases
// anteriores (ver README, Fase 27.77 em diante).
const POSTO_TESTE = { cnpj: "11.222.333/0001-44", nome: "Posto Teste Ltda" };
const POSTO_TESTE_2 = { cnpj: "22.333.444/0001-55", nome: "Posto Teste 2 Ltda" };
const CLIENTE_TESTE = { cnpj: "N6.SL9.PHV/0001-84", nome: "Transportes de Cargas Testes Ltda" };
const CLIENTE_CNPJ_INEXISTENTE = "99.888.777/0001-66"; // não cadastrado — propositalmente

let numeroNf = 90001;
function proximoNumeroNf() {
  return numeroNf++;
}

const cenarios = [
  {
    arquivo: "01-match-automatico-diesel-s10-aditivado.xml",
    descricao:
      "Match automático — bate exatamente com o abastecimento de teste #165866 (Posto Teste Ltda). Resultado esperado: \"NF-e validada e vinculada com sucesso.\"",
    dados: {
      posto: POSTO_TESTE,
      cliente: CLIENTE_TESTE,
      dataEmissao: "2026-07-09T13:20:00-03:00",
      produtoNome: "DIESEL S10 ADITIVADO",
      codigoAnp: "820101033",
      descricaoAnp: "OLEO DIESEL B S10 - ADITIVADO",
      quantidade: 52.4,
      valorUnitario: 6.912,
      valorTotal: 362.19,
    },
  },
  {
    arquivo: "02-match-automatico-diesel-s500-aditivado.xml",
    descricao:
      "Match automático — bate exatamente com o abastecimento de teste #165867 (Posto Teste 2 Ltda). Resultado esperado: \"NF-e validada e vinculada com sucesso.\"",
    dados: {
      posto: POSTO_TESTE_2,
      cliente: CLIENTE_TESTE,
      dataEmissao: "2026-07-09T13:40:00-03:00",
      produtoNome: "DIESEL S500 ADITIVADO",
      codigoAnp: "820101013",
      descricaoAnp: "OLEO DIESEL B S500 - ADITIVADO",
      quantidade: 61.7,
      valorUnitario: 6.423,
      valorTotal: 396.3,
    },
  },
  {
    arquivo: "03-match-automatico-gasolina-octanagem.xml",
    descricao:
      "Match automático — bate exatamente com o abastecimento #165108 (Posto Teste 2 Ltda, um dos milhares gerados pelo robô diário). Resultado esperado: \"NF-e validada e vinculada com sucesso.\"",
    dados: {
      posto: POSTO_TESTE_2,
      cliente: CLIENTE_TESTE,
      dataEmissao: "2026-07-09T20:16:13-03:00",
      produtoNome: "GASOLINA ALTA OCTANAGEM",
      codigoAnp: "320102003",
      descricaoAnp: "GASOLINA C PREMIUM",
      quantidade: 30.62,
      valorUnitario: 7.957,
      valorTotal: 243.64,
    },
  },
  {
    arquivo: "04-pendencia-sem-correspondencia-cnpj-nao-cadastrado.xml",
    descricao:
      'Pendência — CNPJ do destinatário não corresponde a nenhum cliente cadastrado, então nenhum abastecimento é encontrado. Resultado esperado: "Nenhum abastecimento correspondente foi encontrado" (a tela mostra os dados extraídos do XML, incluindo esse CNPJ, pra você conferir).',
    dados: {
      posto: POSTO_TESTE,
      cliente: { cnpj: CLIENTE_CNPJ_INEXISTENTE, nome: "EMPRESA SEM CADASTRO NA FNI LTDA" },
      dataEmissao: "2026-07-09T19:01:17-03:00",
      produtoNome: "GASOLINA COMUM",
      codigoAnp: "320102001",
      descricaoAnp: "GASOLINA C COMUM",
      quantidade: 25.79,
      valorUnitario: 6.731,
      valorTotal: 173.59,
    },
  },
  {
    arquivo: "05-pendencia-sem-correspondencia-quantidade-nao-bate.xml",
    descricao:
      'Pendência — CNPJ emitente/destinatário válidos, mas quantidade/valor não batem com NENHUM abastecimento dentro da tolerância (0,5 L / 2%). Resultado esperado: "Nenhum abastecimento correspondente foi encontrado".',
    dados: {
      posto: POSTO_TESTE_2,
      cliente: CLIENTE_TESTE,
      dataEmissao: "2026-07-09T15:46:15-03:00",
      produtoNome: "GASOLINA ALTA OCTANAGEM",
      codigoAnp: "320102003",
      descricaoAnp: "GASOLINA C PREMIUM",
      quantidade: 999.0, // propositalmente muito fora de qualquer abastecimento real
      valorUnitario: 7.866,
      valorTotal: 7858.13,
    },
  },
  {
    arquivo: "06-pendencia-codigo-anp-incorreto.xml",
    descricao:
      "Pendência — CNPJ/quantidade/valor batem exatamente com o abastecimento de teste #165865 (Diesel S-500 Comum), mas o código ANP informado no XML é o da Gasolina Comum. O sistema acha o abastecimento (só 1 candidato) e SÓ NA HORA DE GRAVAR percebe que o código ANP não bate com o combustível do abastecimento. Resultado esperado: \"O código ANP da NF-e não corresponde ao combustível deste abastecimento.\"",
    dados: {
      posto: POSTO_TESTE,
      cliente: CLIENTE_TESTE,
      dataEmissao: "2026-07-09T15:10:00-03:00",
      produtoNome: "DIESEL S500 COMUM",
      codigoAnp: "320102001", // errado de propósito — é código de Gasolina Comum
      descricaoAnp: "GASOLINA C COMUM",
      quantidade: 45.21,
      valorUnitario: 6.105,
      valorTotal: 276.01,
    },
  },
  {
    arquivo: "07-pendencia-nfe-nao-autorizada.xml",
    descricao:
      'Pendência — NFe com protocolo de CANCELAMENTO (cStat 101), não autorizada para uso. Rejeitada na hora de ler o XML, antes de qualquer busca no banco. Resultado esperado: mensagem de erro explicando que a NF-e não está autorizada pela SEFAZ.',
    dados: {
      posto: POSTO_TESTE_2,
      cliente: CLIENTE_TESTE,
      dataEmissao: "2026-07-09T17:08:29-03:00",
      produtoNome: "GASOLINA ADITIVADA",
      codigoAnp: "320102002",
      descricaoAnp: "GASOLINA C ADITIVADA",
      quantidade: 26.65,
      valorUnitario: 6.041,
      valorTotal: 160.99,
      cStat: "101",
      xMotivo: "Cancelamento de NF-e homologado",
    },
  },
  {
    arquivo: "08-pendencia-modelo-invalido.xml",
    descricao:
      'Pendência — XML é modelo 65 (NFC-e), não modelo 55 (NF-e) — rejeitado antes de qualquer busca no banco. Resultado esperado: mensagem de erro dizendo que só NF-e modelo 55 é aceita.',
    dados: {
      posto: POSTO_TESTE,
      cliente: CLIENTE_TESTE,
      dataEmissao: "2026-07-09T15:53:09-03:00",
      produtoNome: "GASOLINA COMUM",
      codigoAnp: "320102001",
      descricaoAnp: "GASOLINA C COMUM",
      quantidade: 20.31,
      valorUnitario: 5.836,
      valorTotal: 118.53,
      modelo: "65",
    },
  },
  {
    arquivo: "09-ambiguo-duas-correspondencias.xml",
    descricao:
      'Ambíguo — valores (100,1 L, R$ 651,00) caem dentro da tolerância dos abastecimentos de teste #165860 E #165861 (criados propositalmente próximos um do outro, mesmo posto/cliente/produto). Resultado esperado: "Mais de um abastecimento corresponde a esta NF-e — escolha o certo", com as 2 opções listadas pra você clicar.',
    dados: {
      posto: POSTO_TESTE,
      cliente: CLIENTE_TESTE,
      dataEmissao: "2026-07-09T14:00:00-03:00",
      produtoNome: "DIESEL S10 COMUM",
      codigoAnp: "820101034",
      descricaoAnp: "OLEO DIESEL B S10 - COMUM",
      quantidade: 100.1,
      valorUnitario: 6.505,
      valorTotal: 651.0,
    },
  },
];

const resumo = [];
for (const cenario of cenarios) {
  const { posto, cliente, dataEmissao, produtoNome, codigoAnp, descricaoAnp, quantidade, valorUnitario, valorTotal, cStat, xMotivo, modelo } =
    cenario.dados;
  const serie = "1";
  const nNF = proximoNumeroNf();
  const cNF = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const chave = gerarChaveAcesso({ cnpjEmitente: posto.cnpj, serie, nNF, dataEmissao, cNF });

  const xml = montarXml({
    chave,
    serie,
    nNF,
    dataEmissao,
    cnpjEmitente: posto.cnpj,
    nomeEmitente: posto.nome,
    cnpjDestinatario: cliente.cnpj,
    nomeDestinatario: cliente.nome,
    produtoNome,
    codigoAnp,
    descricaoAnp,
    quantidade,
    valorUnitario,
    valorTotal,
    cStat,
    xMotivo,
    modelo,
  });

  writeFileSync(join(pastaSaida, cenario.arquivo), xml, "utf8");
  resumo.push(`${cenario.arquivo}\n  ${cenario.descricao}\n  NF nº ${nNF}, chave ${chave}`);
}

writeFileSync(
  join(pastaSaida, "LEIA-ME.txt"),
  `Exemplos de XML de NF-e para testar o upload de Notas Fiscais (Fase 27.94)
Gerados por scripts/gerar-exemplos-nfe-teste.mjs em ${new Date().toLocaleString("pt-BR")}

Estes XMLs são FICTÍCIOS (não são NF-e reais autorizadas pela SEFAZ) — servem só pra
testar o fluxo de upload/validação em /notas-fiscais, logado como usuário do POSTO
emitente de cada arquivo:
  - Posto Teste Ltda (CNPJ 11.222.333/0001-44): arquivos 01, 04, 05, 06, 08, 09
  - Posto Teste 2 Ltda (CNPJ 22.333.444/0001-55): arquivos 02, 03, 07

${resumo.join("\n\n")}

Dicas extras:
  - Pra testar a mensagem de "NF-e já cadastrada", envie qualquer um dos arquivos
    que teve sucesso (01, 02 ou 03) uma segunda vez.
  - Os arquivos 04 e 05 mostram a MESMA mensagem na tela ("Nenhum abastecimento
    correspondente foi encontrado") por motivos diferentes — CNPJ do cliente não
    cadastrado vs. quantidade que não bate com nada. É proposital: o sistema não
    sabe distinguir os dois casos de antemão, só sabe dizer "não achei" — por isso
    a tela sempre mostra os dados extraídos do XML, pra você mesmo perceber qual
    campo está errado.
`,
  "utf8"
);

console.log(`Gerados ${cenarios.length} XMLs + LEIA-ME.txt em ${pastaSaida}`);
