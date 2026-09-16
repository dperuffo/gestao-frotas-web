import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { TabelaPendencias, type MotoristaOpcao, type PendenciaAbastecimento } from "./_components/TabelaPendencias";

// Fase Fila-Motorista-Abastecimento-Externo (16/09/2026, pedido do Daniel:
// nome completo + CPF do motorista é obrigatório em todo abastecimento —
// regra de negócio confirmada com o Daniel). A maioria dos pontos de entrada
// já bloqueia isso na origem (lançamento manual, importação XLSX, PróFrotas —
// ver Fase CPF-obrigatorio-fonte). Mas dois canais são integrações EXTERNAS
// que a FNI não controla — não dá pra simplesmente rejeitar a transação
// porque o provedor não manda motorista:
//   - Hub genérico de integrações (cartão de combustível — Ticket Log, Alelo,
//     Repom etc.) — /api/integracoes/abastecimentos
//   - ERP de automação de posto (o próprio posto lança em nome do cliente
//     que atendeu) — /api/integracoes/abastecimentos-fornecidos
// Decisão do Daniel: ACEITAR o registro mesmo sem motorista (rejeitar
// derrubaria o integrador, que não tem como corrigir isso na hora), mas
// deixá-lo nesta fila pra alguém completar manualmente depois. Ambos os
// canais caem na mesma tabela, `abastecimentos_externos` (ver comentário no
// topo de cada rota) — é a ÚNICA fonte desta fila:
//   - PróFrotas (profrotas_abastecimentos) já foi resolvida numa fase
//     anterior — a fonte agora garante motorista, então não entra aqui.
//   - O histórico antigo de profrotas_abastecimentos com sync_key "robo-..."
//     (robô de teste de negociação com postos, ver AbastecimentoForm.tsx) é
//     dado de teste, não abastecimento real de cliente — deixado de fora de
//     propósito pra esta fila mostrar só o que precisa de revisão humana de
//     verdade (confirmado por SQL: profrotas_abastecimentos não tem nenhuma
//     linha real de integração sem motorista fora desses dois casos).
//
// Mesma estrutura de autorização de /cadastros-pendentes: Server Component,
// sem client admin, RLS de abastecimentos_externos (tenant_all) já restringe
// cada usuário à própria empresa — o filtro por empresaSelecionada abaixo é
// só pra resolver QUAL empresa mostrar quando o usuário/admin enxerga mais
// de uma, não uma checagem de segurança adicional.
const LIMITE_LISTAGEM = 200;

export default async function AbastecimentosSemMotoristaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let pendencias: PendenciaAbastecimento[] = [];
  let motoristas: MotoristaOpcao[] = [];
  let totalPendencias = 0;
  let erro: string | null = null;

  if (empresaSelecionada) {
    const { count } = await supabase
      .from("abastecimentos_externos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaSelecionada)
      .or("motorista_nome.is.null,motorista_cpf.is.null");
    totalPendencias = count ?? 0;

    const { data, error: erroPendencias } = await supabase
      .from("abastecimentos_externos")
      .select("id, codigo_abastecimento, data_abastecimento, placa, posto_nome, provedor, quantidade, valor_total")
      .eq("empresa_id", empresaSelecionada)
      .or("motorista_nome.is.null,motorista_cpf.is.null")
      .order("data_abastecimento", { ascending: false })
      .limit(LIMITE_LISTAGEM);
    if (erroPendencias) erro = erroPendencias.message;
    pendencias = data ?? [];

    const { data: motoristasEmpresa, error: erroMotoristas } = await supabase
      .from("motoristas")
      .select("id, nome_completo, cpf")
      .eq("empresa_id", empresaSelecionada)
      .order("nome_completo");
    if (erroMotoristas) erro = erro ?? erroMotoristas.message;
    motoristas = motoristasEmpresa ?? [];
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Abastecimentos Sem Motorista"
        descricao={`Abastecimentos aceitos via integração (cartão de combustível ou ERP de posto) sem nome/CPF do motorista — complete pra sair da lista${nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.`}
      />

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione um cliente...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
          {empresas.length > 1 ? "Selecione um cliente acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      ) : (
        <>
          {erro && <p className="mb-4 text-sm text-red-600">Erro ao carregar: {erro}</p>}

          {totalPendencias > LIMITE_LISTAGEM && (
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Mostrando os {LIMITE_LISTAGEM} mais recentes de {totalPendencias} pendências — resolva estes e recarregue a
              página pra ver os próximos.
            </p>
          )}

          <TabelaPendencias pendenciasIniciais={pendencias} motoristas={motoristas} />
        </>
      )}
    </div>
  );
}
