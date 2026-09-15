"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

type TemaSalvo = "light" | "dark" | "system";

// Fase Dark-Mode-Por-Conta (15/09/2026, pedido do Daniel: vincular a
// preferência de tema à CONTA do usuário, não só ao localStorage do
// navegador) — este componente não renderiza nada, só sincroniza o estado
// do next-themes (que por padrão só lê o localStorage do navegador) com o
// que está salvo em usuarios_app.tema_preferido pro usuário logado.
//
// Por quê aqui e não um fetch client-side num useEffect: `temaPreferidoBanco`
// já vem pronto do servidor (layout.tsx do dashboard já busca a linha do
// usuário em usuarios_app pra outras coisas — nome, perfil, tour — então
// pedir também tema_preferido não é uma chamada extra). Isso reduz o
// "flash" de trocar de tema depois que a página já carregou: o valor chega
// junto do primeiro HTML/hidratação, não depois de um round-trip adicional
// ao Supabase feito no browser. Ainda pode haver um flash mínimo — o
// next-themes aplica o tema do localStorage primeiro (script inline
// síncrono, evita FOUC) e só depois, já montado, este componente troca pro
// valor do banco se for diferente. Eliminar 100% exigiria fixar o tema num
// cookie lido no SSR, o que é mais complexo e não faz parte deste pedido.
//
// Só roda a sincronização UMA vez por carregamento de sessão (guarda por
// ref): depois disso, quem manda no tema é o próprio usuário via
// <ThemeToggle>, que já persiste a escolha de volta no banco — não
// queremos "puxar" o tema salvo de novo a cada navegação/remount e
// sobrescrever uma troca manual que ainda não deu tempo de round-trip com
// o servidor.
export function SincronizadorTema({
  temaPreferidoBanco,
}: {
  temaPreferidoBanco: TemaSalvo | null;
}) {
  const { theme, setTheme } = useTheme();
  const jaSincronizouRef = useRef(false);

  useEffect(() => {
    if (jaSincronizouRef.current) return;
    jaSincronizouRef.current = true;

    // Sem preferência salva no banco (usuário nunca configurou pela conta):
    // não mexe em nada, mantém o que o next-themes já resolveu localmente
    // (localStorage do navegador ou "system").
    if (!temaPreferidoBanco) return;

    if (temaPreferidoBanco !== theme) {
      setTheme(temaPreferidoBanco);
    }
    // Só quer rodar na montagem inicial (comparando com o theme que o
    // next-themes já tinha resolvido do localStorage nesse momento) — não a
    // cada troca de `theme` feita pelo próprio usuário depois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temaPreferidoBanco]);

  return null;
}
