#!/usr/bin/env node
// Fase P0-QA — pedido do Daniel: "é possível gerar massas de testes para
// testes de QA da aplicação?" (ele ainda não tem empresa registrada, nem
// certificado A1, nem cliente-piloto transportadora pra rodar homologação).
//
// Este robô é o irmão do gerar-exemplos-nfe-teste.mjs (Fase 27.96), mas
// para CT-e (modelo 57): gera XMLs FICTÍCIOS porém estruturalmente
// válidos, cada um exercitando um caminho diferente do parser
// src/lib/cte.ts e do fluxo de upload em /fretes/[id] (FretesDocumentos):
// autorizado (happy path), sem protocolo, rejeitado pela SEFAZ, cancelado,
// modelo errado, chave inválida e XML quebrado.
//
// A chave de acesso usa o dígito verificador módulo 11 OFICIAL (mesmo
// cálculo da SEFAZ) e os CNPJs fictícios têm dígitos verificadores
// corretos — assim a massa continua servindo quando o fluxo de EMISSÃO
// (Fase P0.2 do plano) validar esses campos de verdade.
//
// IMPORTANTE: nenhum destes XMLs tem valor fiscal. Não têm assinatura
// digital e os CNPJs são inventados. Servem só para QA do app.
//
// Uso: node scripts/gerar-exemplos-cte-teste.mjs [pasta-de-saida]
// Sem argumento, salva em ./exemplos-cte-teste (relativo ao diretório atual).

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const pastaSaida = process.argv[2] || "./exemplos-cte-teste";
if (!existsSync(pastaSaida)) mkdirSync(pastaSaida, { recursive: true });

// ---------------------------------------------------------------------
// Chave de acesso do CT-e — MESMA regra da NF-e (44 dígitos, DV módulo 11):
// cUF(2) + AAMM(4) + CNPJ emitente(14) + mod(2=57) + serie(3) + nCT(9) +
// tpEmis(1) + cCT(8) + cDV(1).
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

function gerarChaveAcesso({ cUF, cnpjEmitente, serie, nCT, dataEmissao, cCT }) {
  const d = new Date(dataEmissao);
  const aamm = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0");
  const base =
    cUF +
    aamm +
    cnpjEmitente.replace(/\D/g, "") +
    "57" + // modelo CT-e
    String(serie).padStart(3, "0") +
    String(nCT).padStart(9, "0") +
    "1" + // tpEmis — normal
    String(cCT).padStart(8, "0");
  return base + String(calcularDV(base));
}

// CNPJ fictício com dígitos verificadores corretos (algoritmo oficial da
// Receita) a partir de uma raiz de 8 dígitos + filial 0001. O parser atual
// não valida DV, mas a emissão real (P0.2) e o provedor fiscal validam —
// massa já nasce pronta pra essa fase.
function gerarCnpj(raiz8) {
  const base12 = raiz8 + "0001";
  const calc = (nums, pesos) => {
    const soma = nums.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = calc(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calc(base12 + dv1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base12 + String(dv1) + String(dv2);
}

// Emitente fictício padrão: a "Transportadora Teste FNI" (MG, cUF 31 —
// mesmo estado usado nos exemplos de NF-e da Fase 27.96).
const TRANSPORTADORA = {
  cnpj: gerarCnpj("11222333"),
  nome: "TRANSPORTADORA TESTE FNI LTDA",
};

// ---------------------------------------------------------------------
// Monta o envelope <cteProc><CTe><infCte>... + <protCTe> — só os campos que
// o parser da FNI (src/lib/cte.ts) realmente lê, mais um grupo <rem>/<dest>
// enxuto por realismo (o layout oficial exige; o parser de hoje ignora,
// mas a P0.2 vai passar a ler). Sem bloco de assinatura digital, igual à
// decisão já registrada no gerador de NF-e.
function montarXml({
  chave,
  serie,
  nCT,
  dataEmissao,
  cfop = "6352",
  natOp = "PRESTACAO DE SERVICO DE TRANSPORTE",
  modal = "01", // rodoviário
  municipioInicio,
  ufInicio,
  municipioFim,
  ufFim,
  valorPrestacao,
  valorReceber,
  comProtocolo = true,
  cStat = "100",
  xMotivo = "Autorizado o uso do CT-e",
  modelo = "57",
  remetente,
  destinatario,
}) {
  const vTPrest = valorPrestacao.toFixed(2);
  const vRec = (valorReceber ?? valorPrestacao).toFixed(2);
  const rem = remetente ?? { cnpj: gerarCnpj("44555666"), nome: "EMBARCADOR TESTE LTDA" };
  const dest = destinatario ?? { cnpj: gerarCnpj("77888999"), nome: "DESTINATARIO TESTE SA" };

  const cteInterno = `<CTe xmlns="http://www.portalfiscal.inf.br/cte"><infCte Id="CTe${chave}" versao="4.00"><ide><cUF>31</cUF><cCT>${chave.slice(
    35,
    43
  )}</cCT><CFOP>${cfop}</CFOP><natOp>${natOp}</natOp><mod>${modelo}</mod><serie>${serie}</serie><nCT>${nCT}</nCT><dhEmi>${dataEmissao}</dhEmi><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${chave.slice(
    -1
  )}</cDV><tpAmb>2</tpAmb><tpCTe>0</tpCTe><procEmi>0</procEmi><verProc>fni-teste-1.0</verProc><modal>${modal}</modal><tpServ>0</tpServ><cMunIni>3106200</cMunIni><xMunIni>${municipioInicio}</xMunIni><UFIni>${ufInicio}</UFIni><cMunFim>3550308</cMunFim><xMunFim>${municipioFim}</xMunFim><UFFim>${ufFim}</UFFim><retira>1</retira><indIEToma>1</indIEToma><toma3><toma>0</toma></toma3></ide><emit><CNPJ>${TRANSPORTADORA.cnpj}</CNPJ><IE>0623456789012</IE><xNome>${TRANSPORTADORA.nome}</xNome><enderEmit><xLgr>RODOVIA DE TESTE</xLgr><nro>1000</nro><xBairro>DISTRITO INDUSTRIAL</xBairro><cMun>3106200</cMun><xMun>BELO HORIZONTE</xMun><CEP>30000000</CEP><UF>MG</UF></enderEmit><CRT>3</CRT></emit><rem><CNPJ>${rem.cnpj}</CNPJ><IE>ISENTO</IE><xNome>${rem.nome}</xNome><enderReme><xLgr>RUA DO EMBARCADOR</xLgr><nro>50</nro><xBairro>CENTRO</xBairro><cMun>3106200</cMun><xMun>BELO HORIZONTE</xMun><CEP>30110000</CEP><UF>MG</UF><cPais>1058</cPais><xPais>BRASIL</xPais></enderReme></rem><dest><CNPJ>${dest.cnpj}</CNPJ><IE>ISENTO</IE><xNome>${dest.nome}</xNome><enderDest><xLgr>AVENIDA DO DESTINATARIO</xLgr><nro>200</nro><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><CEP>01000000</CEP><UF>SP</UF><cPais>1058</cPais><xPais>BRASIL</xPais></enderDest></dest><vPrest><vTPrest>${vTPrest}</vTPrest><vRec>${vRec}</vRec></vPrest><imp><ICMS><ICMS00><CST>00</CST><vBC>${vTPrest}</vBC><pICMS>12.00</pICMS><vICMS>${(
    valorPrestacao * 0.12
  ).toFixed(2)}</vICMS></ICMS00></ICMS></imp></infCte></CTe>`;

  if (!comProtocolo) {
    return `<?xml version="1.0" encoding="UTF-8" ?>${cteInterno}`;
  }

  return `<?xml version="1.0" encoding="UTF-8" ?><cteProc xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">${cteInterno}<protCTe versao="4.00"><infProt><tpAmb>2</tpAmb><verAplic>MG4.00</verAplic><chCTe>${chave}</chCTe><dhRecbto>${dataEmissao}</dhRecbto><nProt>131260000000${String(
    nCT
  ).padStart(3, "0")}</nProt><digVal>fni-teste</digVal><cStat>${cStat}</cStat><xMotivo>${xMotivo}</xMotivo></infProt></protCTe></cteProc>`;
}

// ---------------------------------------------------------------------
// Cenários — cada arquivo com o resultado esperado no upload documentado.
const dataBase = "2026-07-20T10:30:00-03:00";
const arquivos = [];

function salvar(nome, conteudo, esperado) {
  writeFileSync(join(pastaSaida, nome), conteudo, "utf8");
  arquivos.push({ nome, esperado });
}

// 1) Happy path — CT-e autorizado, BH → SP, R$ 4.850,00.
{
  const chave = gerarChaveAcesso({ cUF: "31", cnpjEmitente: TRANSPORTADORA.cnpj, serie: 1, nCT: 101, dataEmissao: dataBase, cCT: 10000101 });
  salvar(
    "01-cte-autorizado-basico.xml",
    montarXml({ chave, serie: 1, nCT: 101, dataEmissao: dataBase, municipioInicio: "BELO HORIZONTE", ufInicio: "MG", municipioFim: "SAO PAULO", ufFim: "SP", valorPrestacao: 4850.0 }),
    "ACEITO — vincula ao frete: nº 101, série 1, R$ 4.850,00, BH/MG → São Paulo/SP."
  );
}

// 2) Autorizado com adiantamento — vRec menor que vTPrest (30% já pago),
// pra conferir que a tela mostra os DOIS valores (prestação x a receber).
{
  const chave = gerarChaveAcesso({ cUF: "31", cnpjEmitente: TRANSPORTADORA.cnpj, serie: 1, nCT: 102, dataEmissao: dataBase, cCT: 10000102 });
  salvar(
    "02-cte-autorizado-com-adiantamento.xml",
    montarXml({ chave, serie: 1, nCT: 102, dataEmissao: dataBase, municipioInicio: "BELO HORIZONTE", ufInicio: "MG", municipioFim: "SAO PAULO", ufFim: "SP", valorPrestacao: 12300.0, valorReceber: 8610.0 }),
    "ACEITO — R$ 12.300,00 de prestação, R$ 8.610,00 a receber (70%, casa com percentual_adiantamento=30 do frete)."
  );
}

// 3) Sem protocolo — <CTe> solto, sem <protCTe>. O parser exige o envelope
// completo (mesmo critério rígido da NF-e: só documento AUTORIZADO).
{
  const chave = gerarChaveAcesso({ cUF: "31", cnpjEmitente: TRANSPORTADORA.cnpj, serie: 1, nCT: 103, dataEmissao: dataBase, cCT: 10000103 });
  salvar(
    "03-cte-sem-protocolo.xml",
    montarXml({ chave, serie: 1, nCT: 103, dataEmissao: dataBase, municipioInicio: "BELO HORIZONTE", ufInicio: "MG", municipioFim: "SAO PAULO", ufFim: "SP", valorPrestacao: 3000.0, comProtocolo: false }),
    "REJEITADO — mensagem pedindo o XML completo (cteProc) com o protocolo da SEFAZ."
  );
}

// 4) Rejeitado pela SEFAZ — cStat 302 (Uso Denegado por irregularidade do
// destinatário é 301/302 na NF-e; no CT-e usamos um código de rejeição
// genérico plausível pra exercitar a mensagem "status ≠ 100").
{
  const chave = gerarChaveAcesso({ cUF: "31", cnpjEmitente: TRANSPORTADORA.cnpj, serie: 1, nCT: 104, dataEmissao: dataBase, cCT: 10000104 });
  salvar(
    "04-cte-rejeitado-sefaz.xml",
    montarXml({ chave, serie: 1, nCT: 104, dataEmissao: dataBase, municipioInicio: "BELO HORIZONTE", ufInicio: "MG", municipioFim: "SAO PAULO", ufFim: "SP", valorPrestacao: 2500.0, cStat: "228", xMotivo: "Rejeicao: Data de emissao muito atrasada" }),
    "REJEITADO — 'CT-e não autorizado pela SEFAZ (status 228: Data de emissao muito atrasada)'."
  );
}

// 5) Cancelado — cStat 101. Também deve ser recusado (só 100 entra).
{
  const chave = gerarChaveAcesso({ cUF: "31", cnpjEmitente: TRANSPORTADORA.cnpj, serie: 1, nCT: 105, dataEmissao: dataBase, cCT: 10000105 });
  salvar(
    "05-cte-cancelado.xml",
    montarXml({ chave, serie: 1, nCT: 105, dataEmissao: dataBase, municipioInicio: "BELO HORIZONTE", ufInicio: "MG", municipioFim: "SAO PAULO", ufFim: "SP", valorPrestacao: 1800.0, cStat: "101", xMotivo: "Cancelamento de CT-e homologado" }),
    "REJEITADO — status 101 (cancelado) não é documento válido pra vincular."
  );
}

// 6) Modelo errado — estrutura de CT-e mas <mod>55 (NF-e). Exercita a
// mensagem 'Este XML não é um CT-e (modelo \"55\")'.
{
  const chave = gerarChaveAcesso({ cUF: "31", cnpjEmitente: TRANSPORTADORA.cnpj, serie: 1, nCT: 106, dataEmissao: dataBase, cCT: 10000106 });
  salvar(
    "06-modelo-errado-55.xml",
    montarXml({ chave, serie: 1, nCT: 106, dataEmissao: dataBase, municipioInicio: "BELO HORIZONTE", ufInicio: "MG", municipioFim: "SAO PAULO", ufFim: "SP", valorPrestacao: 900.0, modelo: "55" }),
    "REJEITADO — modelo 55 (NF-e) enviado onde se espera CT-e (modelo 57)."
  );
}

// 7) Chave inválida — Id com 43 dígitos (um a menos). Exercita a validação
// de comprimento/formato da chave.
{
  const chaveBoa = gerarChaveAcesso({ cUF: "31", cnpjEmitente: TRANSPORTADORA.cnpj, serie: 1, nCT: 107, dataEmissao: dataBase, cCT: 10000107 });
  const xml = montarXml({ chave: chaveBoa, serie: 1, nCT: 107, dataEmissao: dataBase, municipioInicio: "BELO HORIZONTE", ufInicio: "MG", municipioFim: "SAO PAULO", ufFim: "SP", valorPrestacao: 700.0 }).replace(`CTe${chaveBoa}`, `CTe${chaveBoa.slice(0, 43)}`);
  salvar("07-chave-invalida-43-digitos.xml", xml, "REJEITADO — chave de acesso com 43 dígitos (esperado 44).");
}

// 8) XML quebrado — tag não fechada. Achado real validando esta massa: o
// fast-xml-parser TOLERA XML truncado (não lança erro), então este caso
// não cai no catch de "XML mal formado" — cai na validação de chave de
// acesso ("CTe123" tem 3 dígitos). O resultado pro usuário é o mesmo:
// upload rejeitado.
salvar(
  "08-xml-quebrado.xml",
  `<?xml version="1.0" encoding="UTF-8" ?><cteProc><CTe><infCte Id="CTe123"><ide><mod>57</mod>`,
  "REJEITADO — chave de acesso inválida (parser tolera o XML truncado e barra na chave)."
);

// ---------------------------------------------------------------------
const leiame = [
  "# Massa de testes de CT-e — gerada por scripts/gerar-exemplos-cte-teste.mjs",
  "",
  "XMLs FICTÍCIOS (sem valor fiscal, sem assinatura digital, CNPJs inventados",
  `com DV válido). Emitente fictício: ${TRANSPORTADORA.nome} — CNPJ ${TRANSPORTADORA.cnpj}.`,
  "",
  "Como usar: abra um frete em /fretes/[id] e envie cada arquivo na seção de",
  "documentos (CT-e). Resultado esperado por arquivo:",
  "",
  ...arquivos.map((a) => `- ${a.nome}: ${a.esperado}`),
  "",
].join("\n");
writeFileSync(join(pastaSaida, "LEIA-ME.md"), leiame, "utf8");

console.log(`${arquivos.length} XMLs + LEIA-ME.md gerados em ${pastaSaida}`);
for (const a of arquivos) console.log(`  - ${a.nome}`);
