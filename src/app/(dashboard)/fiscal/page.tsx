import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { FormularioFiscal } from "./_components/FormularioFiscal";
import { FormularioCertificado } from "./_components/FormularioCertificado";

// Fase P0.1 (plano FNI_Plano_Implementacao_P0.md) — Configuração fiscal do
// emitente: dados pra emissão de CT-e/MDF-e via provedor de API fiscal.
// Multi-tenant: cada cliente transportadora configura o PRÓPRIO emitente
// (certificado A1 dele, série/numeração dele) — o FNI orquestra. Mesmo
// padrão de seleção de empresa de /antifraude (resolverEmpresaAtual +
// ?empresa=).

export default async function FiscalPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  const { data: fiscal } = empresaSelecionada
    ? await supabase.from("empresas_fiscal").select("*").eq("empresa_id", empresaSelecionada).maybeSingle()
    : { data: null };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Fiscal (CT-e / MDF-e)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configuração do emitente de documentos fiscais de transporte
          {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}. Em ambiente de homologação os
          documentos emitidos são de teste, sem valor fiscal.
        </p>
      </div>

      {empresas.length > 1 && (
        <div className="card mb-6 p-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Cliente</p>
          <div className="flex flex-wrap gap-2">
            {empresas.map((e) => (
              <Link
                key={e.id}
                href={`/fiscal?empresa=${e.id}`}
                className={`rounded-full border px-3 py-1 text-xs ${
                  e.id === empresaSelecionada
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {e.nome}
              </Link>
            ))}
          </div>
        </div>
      )}

      {semClienteEscolhido && (
        <div className="card p-6 text-sm text-slate-500">Escolha um cliente acima para configurar o fiscal dele.</div>
      )}

      {empresas.length === 0 && (
        <div className="card p-6 text-sm text-slate-500">
          Nenhuma empresa vinculada ao seu usuário — fale com um administrador.
        </div>
      )}

      {empresaSelecionada && (
        <div className="space-y-6">
          <FormularioFiscal
            empresaId={empresaSelecionada}
            dados={
              fiscal
                ? {
                    inscricao_estadual: fiscal.inscricao_estadual,
                    rntrc: fiscal.rntrc,
                    regime_tributario: fiscal.regime_tributario,
                    serie_cte: fiscal.serie_cte,
                    serie_mdfe: fiscal.serie_mdfe,
                    ambiente: fiscal.ambiente,
                    provedor: fiscal.provedor,
                  }
                : null
            }
          />

          <FormularioCertificado
            empresaId={empresaSelecionada}
            certificadoVencimento={fiscal?.certificado_vencimento ?? null}
            statusConexao={fiscal?.status_conexao ?? null}
            statusConexaoEm={fiscal?.status_conexao_em ?? null}
          />

          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-900">Como testar sem certificado (provedor simulado)</h2>
            <p className="mt-1 text-xs text-slate-500">
              Com o provedor <span className="font-medium">Simulador</span> selecionado, qualquer arquivo .pfx
              com mais de 100 bytes é aceito e o teste de conexão passa em homologação. Para exercitar os
              caminhos de erro no QA: use a senha <code className="rounded bg-slate-100 px-1">senha-errada</code>{" "}
              (senha inválida), um arquivo minúsculo (certificado corrompido) ou o ambiente Produção (o
              simulador nunca autoriza produção, de propósito). Os XMLs de teste de CT-e ficam em{" "}
              <code className="rounded bg-slate-100 px-1">scripts/gerar-exemplos-cte-teste.mjs</code>.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Fase P0.2 (emissão de CT-e pela tela do frete): use o CNPJ{" "}
              <code className="rounded bg-slate-100 px-1">11111111111111</code> como tomador ou destinatário pra
              simular rejeição da SEFAZ, ou valor da prestação zero/negativo. Cancelamento e carta de correção
              exigem justificativa/texto com pelo menos 15 caracteres — mesma regra real da SEFAZ.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
