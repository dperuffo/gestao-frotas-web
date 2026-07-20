"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ItemAjuda = { titulo: string; texto: string };

// Fase Central-Treinamento (20/07/2026) — conteúdo de ajuda contextual
// (ícone "?") deixou de ser hardcoded em src/lib/ajuda/conteudo.ts e
// passou a viver na tabela conteudo_ajuda (tipo='contextual'), editável
// via tela de admin (/administracao/central-conteudo) sem precisar de
// deploy. Este módulo busca TODAS as chaves de uma vez só (não uma
// consulta por ícone — a tela pode ter dezenas de <AjudaIcon> juntos) e
// cacheia em memória pelo resto da sessão do navegador; se o admin editar
// um texto, o usuário vê a versão nova no próximo carregamento de página.
let cachePromise: Promise<Record<string, ItemAjuda>> | null = null;

async function carregarConteudoAjuda(): Promise<Record<string, ItemAjuda>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conteudo_ajuda")
    .select("chave, titulo, texto")
    .eq("tipo", "contextual")
    .eq("ativo", true);

  if (error) {
    console.error("Falha ao carregar conteúdo de ajuda:", error.message);
    return {};
  }
  const mapa: Record<string, ItemAjuda> = {};
  for (const linha of data ?? []) {
    mapa[linha.chave] = { titulo: linha.titulo, texto: linha.texto };
  }
  return mapa;
}

function buscarConteudoAjuda(): Promise<Record<string, ItemAjuda>> {
  if (!cachePromise) {
    cachePromise = carregarConteudoAjuda();
  }
  return cachePromise;
}

// Hook usado pelo AjudaIcon — devolve o item da chave pedida assim que o
// cache carregar (undefined enquanto carrega ou se a chave não existir,
// mesmo comportamento fail-safe de antes: nunca quebra a tela).
export function useItemAjuda(chave: string): ItemAjuda | undefined {
  const [item, setItem] = useState<ItemAjuda | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    buscarConteudoAjuda().then((mapa) => {
      if (!cancelado) setItem(mapa[chave]);
    });
    return () => {
      cancelado = true;
    };
  }, [chave]);

  return item;
}
