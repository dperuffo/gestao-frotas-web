"use client";

// Fase Avisos-Reaparecer-Login (18/08/2026, pedido do Daniel: "mesmo que o
// usuario clique no X para fechar o aviso, ele deve ser reapresentado no
// próximo login da aplicação, respeitando o prazo estipulado na criação do
// aviso ou inativacão") — achado real: o dispensar (botão X) do
// AvisoBannerFixo.tsx era só um `useState` em memória, que resetava em
// qualquer F5/navegação — cedo demais, mas também não garantia reaparecer
// exatamente "no próximo login" se a aba ficasse aberta.
//
// Agora o dispensar fica em sessionStorage (sobrevive a F5 dentro da MESMA
// sessão do navegador, mas é limpo automaticamente quando a aba/janela
// fecha) e, pra cobrir o caso de logout+login sem fechar a aba,
// limparAvisosDispensados() é chamado explicitamente em todo fluxo de
// logout (ver BotaoSair.tsx e MonitorInatividade.tsx). O aviso só some de
// vez quando expira (data_expiracao) ou é desativado pelo admin/empresa —
// isso já é filtrado no servidor, em listarAvisosAcao().
const CHAVE = "fni_avisos_dispensados";

function ler(): Set<string> {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE);
    return new Set(bruto ? (JSON.parse(bruto) as string[]) : []);
  } catch {
    // sessionStorage indisponível (modo privado, quota etc.) — segue sem
    // persistência, só em memória do componente.
    return new Set();
  }
}

export function obterAvisosDispensados(): Set<string> {
  if (typeof window === "undefined") return new Set();
  return ler();
}

export function dispensarAviso(id: string): Set<string> {
  if (typeof window === "undefined") return new Set([id]);
  const atual = ler();
  atual.add(id);
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify(Array.from(atual)));
  } catch {
    // ignora — dispensa fica só em memória até o próximo reload.
  }
  return atual;
}

export function limparAvisosDispensados(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    // ignora
  }
}
