"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, AlertTriangle } from "lucide-react";
import { buscarNomeEmpresaAtualAcao } from "./clienteAtualActions";

// Fase Indicador-Cliente-Atual (27/09/2026, pedido do Daniel: um usuário
// de grupo econômico "ficou confuso em relação à identificação de qual
// cliente ... estava navegando e visualizando"). Achado: o único lugar que
// mostrava o cliente selecionado era um seletor solto no MEIO do conteúdo
// de cada página (~150 telas, cada uma com o seu, em posição diferente) —
// some de vista ao rolar, e nem toda tela tem um visível o tempo todo.
//
// Este badge fica dentro do <aside> do menu, que já é sticky (nunca sai de
// vista, mesmo rolando a página) — lê o MESMO ?empresa= da URL que todas
// as páginas já usam (resolverEmpresaAtual/empresaParam, ~150 arquivos),
// então funciona em qualquer tela sem precisar tocar nelas uma por uma.
// useSearchParams() reage sozinho a cada navegação/troca de cliente.
// 03/10/2026 — achado do Daniel: ao fazer drill down (cartões, gráficos e
// linhas que abrem uma tela de detalhe) o indicador voltava pra "Nenhum
// cliente selecionado", porque nem todo link de detalhe repete ?empresa= na
// URL. Agora o último cliente escolhido fica guardado na sessão da aba e é
// usado como reserva quando a URL não traz o parâmetro — mostrado como
// "Último cliente" pra deixar claro que não veio da tela atual. Se a URL
// trouxer ?empresa=, ela sempre prevalece (e atualiza o guardado).
const CHAVE_SESSAO = "fni:cliente-atual";

export function IndicadorClienteAtual({ temMultiplasEmpresas }: { temMultiplasEmpresas: boolean }) {
  const searchParams = useSearchParams();
  const empresaDaUrl = searchParams.get("empresa");
  const [empresaGuardada, setEmpresaGuardada] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);

  // Guarda/recupera a seleção (sessionStorage pode falhar em modo restrito).
  useEffect(() => {
    try {
      if (empresaDaUrl) {
        window.sessionStorage.setItem(CHAVE_SESSAO, empresaDaUrl);
        setEmpresaGuardada(empresaDaUrl);
      } else {
        setEmpresaGuardada(window.sessionStorage.getItem(CHAVE_SESSAO));
      }
    } catch {
      setEmpresaGuardada(empresaDaUrl);
    }
  }, [empresaDaUrl]);

  const empresaId = empresaDaUrl ?? empresaGuardada;
  const ehReserva = !empresaDaUrl && !!empresaGuardada;

  useEffect(() => {
    if (!empresaId) {
      setNome(null);
      return;
    }
    let vivo = true;
    setNome(null);
    buscarNomeEmpresaAtualAcao(empresaId).then((n) => {
      if (vivo) setNome(n);
    });
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  // Quem só enxerga uma empresa não tem ambiguidade nenhuma pra resolver
  // (resolverEmpresaAtual já auto-seleciona a única e nem usa ?empresa= na
  // URL nesse caso) — não faz sentido poluir o menu com o badge aqui.
  if (!temMultiplasEmpresas) return null;

  if (!empresaId) {
    return (
      <div className="menu-item-extra mx-5 mb-3 flex items-center gap-1.5 rounded-lg border border-status-atencao/40 bg-status-atencao/10 px-2.5 py-1.5 text-[11px] font-medium text-status-atencao">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Nenhum cliente selecionado</span>
      </div>
    );
  }

  return (
    <div
      className="menu-item-extra mx-5 mb-3 flex items-center gap-1.5 rounded-lg border border-accento/30 bg-white px-2.5 py-1.5 text-[11px] font-medium text-frota-800 shadow-sm dark:border-accento/40 dark:bg-slate-800 dark:text-slate-100"
      title={ehReserva ? `Último cliente selecionado: ${nome ?? ""}` : (nome ?? undefined)}
    >
      <Building2 className="h-3.5 w-3.5 shrink-0 text-accento" />
      <span className="truncate">
        {ehReserva && <span className="mr-1 font-normal text-slate-400">Último:</span>}
        {nome ?? "Carregando..."}
      </span>
    </div>
  );
}
