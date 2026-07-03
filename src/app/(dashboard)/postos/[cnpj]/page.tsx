import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { resolverPrecosVigentes } from "@/lib/precoVigente";
import { PostoForm } from "../_components/PostoForm";
import { ExcluirPosto } from "../_components/ExcluirPosto";
import { ToggleAtivoPosto } from "../_components/ToggleAtivoPosto";
import { RegistrarPrecoForm } from "../_components/RegistrarPrecoForm";
import { ExcluirPreco } from "../_components/ExcluirPreco";

export default async function EditarPostoPage({ params }: { params: Promise<{ cnpj: string }> }) {
  const { cnpj } = await params;
  const supabase = await createClient();

  const { data: posto } = await supabase.from("postos_gf").select("*").eq("cnpj", cnpj).maybeSingle();
  if (!posto) notFound();

  const { data: empresa } = posto.empresa_id
    ? await supabase.from("empresas").select("nome").eq("id", posto.empresa_id).maybeSingle()
    : { data: null };

  const { data: precos } = await supabase
    .from("historico_precos")
    .select("id, combustivel, preco, data_ref, fonte")
    .eq("cnpj", cnpj)
    .order("combustivel")
    .order("data_ref", { ascending: false });

  // O preço vigente de cada combustível é o registro mais recente (maior data_ref) —
  // como a lista já vem ordenada por data_ref desc, o primeiro que aparece por
  // combustível é o vigente.
  type LinhaPreco = { id: number; combustivel: string; preco: number; data_ref: string; fonte: string | null };
  const vigentes = new Map<string, LinhaPreco>();
  for (const p of precos ?? []) {
    if (!vigentes.has(p.combustivel)) vigentes.set(p.combustivel, p);
  }

  // Preço "próprio" do posto (preco_posto.xlsx) sempre prevalece; quando não
  // existe para uma categoria de combustível, cai para a estimativa oficial
  // da ANP (município → estado → Brasil).
  const precosResolvidos = await resolverPrecosVigentes(
    supabase,
    { municipio: posto.municipio, uf: posto.uf },
    Array.from(vigentes.values()).map((p) => ({ combustivel: p.combustivel, preco: p.preco, data_ref: p.data_ref }))
  );

  const ROTULO_FONTE: Record<string, string> = {
    gf: "próprio do posto",
    anp_municipio: "estimativa ANP (município)",
    anp_estado: "estimativa ANP (estado)",
    anp_brasil: "estimativa ANP (Brasil)",
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Editar Posto Revendedor</h1>
          {!posto.ativo && (
            <p className="mt-1 text-sm font-medium text-amber-700">
              Bloqueado pelo gestor de frota — não deve ser usado para abastecimento.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ToggleAtivoPosto cnpj={posto.cnpj} ativo={posto.ativo} />
          <ExcluirPosto cnpj={posto.cnpj} />
        </div>
      </div>

      <div className="mb-6">
        <PostoForm posto={posto} empresas={[]} nomeEmpresaAtual={empresa?.nome} />
      </div>

      <section className="card mb-6 p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">
          Dados da importação em lote
        </h2>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <Info label="Bandeira" valor={posto.bandeira} />
          <Info label="Grupo econômico" valor={posto.grupo_economico} />
          <Info label="Rede" valor={posto.rede} />
          <Info
            label="Endereço"
            valor={[posto.logradouro, posto.numero, posto.complemento, posto.bairro, posto.cep]
              .filter(Boolean)
              .join(", ") || null}
          />
          <Info label="Contato" valor={[posto.nome_contato, posto.telefone_contato].filter(Boolean).join(" — ") || null} />
          <Info
            label="Responsável"
            valor={[posto.nome_responsavel, posto.telefone_responsavel].filter(Boolean).join(" — ") || null}
          />
          <Info label="Status na origem" valor={[posto.status_pdv, posto.situacao_pdv].filter(Boolean).join(" / ") || null} />
          <Info label="Habilitado em" valor={posto.data_habilitacao ? formatDate(posto.data_habilitacao) : null} />
          <Info label="Outros serviços" valor={posto.outros_servicos} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {posto.possui_restaurante && <span className="badge-ativo">Restaurante</span>}
          {posto.possui_banheiro && <span className="badge-ativo">Banheiro</span>}
          {posto.possui_estacionamento && <span className="badge-ativo">Estacionamento</span>}
          {posto.possui_troca_oleo && <span className="badge-ativo">Troca de óleo</span>}
          {posto.possui_internet && <span className="badge-ativo">Internet</span>}
          {posto.arla && <span className="badge-ativo">ARLA 32{posto.tipo_arla ? ` (${posto.tipo_arla})` : ""}</span>}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Combustíveis e preços vigentes</h2>

        {precosResolvidos.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {precosResolvidos.map((p) => (
              <div
                key={`${p.categoria}__${p.combustivelGf ?? ""}`}
                className={
                  "rounded-lg border p-3 " +
                  (p.fonte === "gf" ? "border-slate-200" : "border-dashed border-amber-200 bg-amber-50/40")
                }
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {p.combustivelGf ?? p.categoria}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {p.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
                <p className="text-xs text-slate-400">
                  em {formatDate(p.dataRef)} — {ROTULO_FONTE[p.fonte]}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mb-4 border-t border-slate-100 pt-4">
          <RegistrarPrecoForm cnpj={cnpj} empresaId={posto.empresa_id} />
        </div>

        {precos && precos.length > 0 ? (
          <div className="overflow-x-auto border-t border-slate-100 pt-4">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Combustível</th>
                  <th className="py-2">Preço</th>
                  <th className="py-2">Data</th>
                  <th className="py-2">Fonte</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {precos.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 text-slate-700">{p.combustivel}</td>
                    <td className="py-2 text-slate-700">
                      {p.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="py-2 text-slate-600">{formatDate(p.data_ref)}</td>
                    <td className="py-2 text-slate-600">{p.fonte ?? "—"}</td>
                    <td className="py-2">
                      <ExcluirPreco id={p.id} cnpj={cnpj} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border-t border-slate-100 pt-4 text-sm text-slate-400">
            Nenhum preço registrado ainda para este posto.
          </p>
        )}
      </section>
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-slate-700">{valor || "—"}</p>
    </div>
  );
}
