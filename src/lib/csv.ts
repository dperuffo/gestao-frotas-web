// Parser de CSV bem simples, sem depender de nenhuma biblioteca externa.
// Suporta campos entre aspas (com vírgula ou aspas escapadas como "").
// Não é um parser "à prova de tudo", mas cobre bem os casos de planilhas
// exportadas do Excel/Google Sheets em UTF-8 separadas por vírgula.
export function parseCSV(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let dentroDeAspas = false;

  // Normaliza quebras de linha do Windows e remove um possível BOM no início.
  const conteudo = texto.replace(/\r\n/g, "\n").replace(/^﻿/, "");

  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i];

    if (dentroDeAspas) {
      if (c === '"') {
        if (conteudo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      dentroDeAspas = true;
    } else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      campo = "";
      linha = [];
    } else {
      campo += c;
    }
  }

  // Último campo/linha, caso o arquivo não termine com quebra de linha.
  if (campo.length > 0 || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }

  // Remove linhas totalmente em branco (comuns no fim do arquivo).
  return linhas.filter((l) => l.some((valor) => valor.trim().length > 0));
}
