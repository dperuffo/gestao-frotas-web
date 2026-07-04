"use client";

import { alocarMotoristasEmLoteAcao, desalocarMotoristasEmLoteAcao } from "../actions";
import { SeletorAlocacaoEmMassa, type ItemAlocavel } from "./SeletorAlocacaoEmMassa";

type MotoristaOpcao = {
  id: string;
  nome_completo: string;
  cpf: string;
  centro_custo_nome: string | null;
};

// Fase 27.36 — achado real: motoristas ainda não tinham alocação em Centro
// de Custo pela própria tela do centro (só individualmente, editando cada
// motorista) — pedido do Daniel: "assim também em motoristas em centros de
// custos". Usa o mesmo seletor genérico de alocação em massa dos veículos
// (SeletorAlocacaoEmMassa.tsx). Diferente de veículos, motoristas não têm
// tabela de histórico de alocação — é só a coluna `centro_custo_id`, então
// as ações do servidor fazem um único UPDATE em lote (ver actions.ts).
export function AlocarMotoristaForm({
  centroCustoId,
  motoristasAlocados,
  motoristasDisponiveis,
}: {
  centroCustoId: string;
  motoristasAlocados: MotoristaOpcao[];
  motoristasDisponiveis: MotoristaOpcao[];
}) {
  const itensDisponiveis: ItemAlocavel[] = motoristasDisponiveis.map((m) => ({
    chave: m.id,
    label: m.nome_completo,
    subLabel: `${m.cpf}${m.centro_custo_nome ? ` · atualmente em ${m.centro_custo_nome}` : " · sem centro de custo"}`,
  }));
  const itensAlocados: ItemAlocavel[] = motoristasAlocados.map((m) => ({
    chave: m.id,
    label: m.nome_completo,
    subLabel: m.cpf,
  }));

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Motoristas alocados a este centro de custo</h2>
      <p className="mb-4 text-xs text-slate-500">
        Busque e marque quantos motoristas precisar — dá pra alocar ou remover vários de uma vez.
      </p>

      <SeletorAlocacaoEmMassa
        itensDisponiveis={itensDisponiveis}
        itensAlocados={itensAlocados}
        labelPlural="motorista"
        placeholderBusca="Buscar por nome ou CPF..."
        onAlocar={(ids) => alocarMotoristasEmLoteAcao(centroCustoId, ids)}
        onRemover={(ids) => desalocarMotoristasEmLoteAcao(centroCustoId, ids)}
      />
    </div>
  );
}
