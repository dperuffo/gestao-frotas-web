import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { listarDuplicidadesPlacaGrupoAcao, type VeiculoDuplicado } from "./actions";
import { GrupoDuplicidade } from "./_components/GrupoDuplicidade";

// Fase Duplicidade-Placas-Grupo (05/08/2026) — pedido do Daniel a partir do
// erro real "Já existe outro veículo cadastrado com a placa SUT8I32..." ao
// editar um veículo. Achamos 9 pares de placas duplicadas entre empresas do
// mesmo grupo econômico (cadastradas independentemente antes de entrarem pro
// grupo, então nunca passaram pela validação de create/edit). Pedido
// explícito: "resolver na aplicacao estes casos e casos novos se houverem" —
// esta tela lista tudo agrupado por placa e deixa o próprio gestor_frota
// corrigir a placa errada ou inativar o cadastro duplicado, sem precisar de
// mim rodando SQL manualmente cada vez que aparecer um caso novo.
export default async function DuplicidadePlacasGrupoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let duplicidades: VeiculoDuplicado[] = [];
  if (empresaSelecionada) {
    duplicidades = await listarDuplicidadesPlacaGrupoAcao(empresaSelecionada);
  }

  const grupos = new Map<string, VeiculoDuplicado[]>();
  for (const v of duplicidades) {
    const atual = grupos.get(v.placaNorm) ?? [];
    atual.push(v);
    grupos.set(v.placaNorm, atual);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Placas Duplicadas no Grupo Econômico</h1>
        <p className="mt-1 text-sm text-slate-500">
          Veículos com a mesma placa cadastrados em mais de uma empresa do mesmo grupo econômico ou rede de postos —
          geralmente porque as empresas já tinham cadastros próprios antes de entrarem pro grupo. Corrija a placa
          errada ou inative o cadastro duplicado.
          {nomeEmpresaSelecionada ? ` Mostrando: ${nomeEmpresaSelecionada}.` : ""}
        </p>
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-2">
        {empresas.length > 1 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione uma empresa...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        {empresas.length > 1 && (
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        )}
      </form>

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione uma empresa pra ver as placas duplicadas do grupo econômico dela.
        </p>
      )}

      {empresaSelecionada && grupos.size === 0 && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Nenhuma placa duplicada encontrada no grupo econômico desta empresa.
        </p>
      )}

      {empresaSelecionada && grupos.size > 0 && (
        <div className="space-y-4">
          {Array.from(grupos.values()).map((veiculos) => (
            <GrupoDuplicidade key={veiculos[0].placaNorm} veiculos={veiculos} />
          ))}
        </div>
      )}
    </div>
  );
}
