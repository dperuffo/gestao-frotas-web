import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listarDocumentacao,
  gerarUrlAssinada,
  TIPOS_DOCUMENTO_EMPRESA,
  TIPOS_DOCUMENTO_SOCIO,
  LABEL_TIPO_DOCUMENTO,
  LABEL_STATUS_DOCUMENTACAO,
  type DocumentoEmpresa,
} from "@/lib/empresasDocumentos";
import { PainelRevisao } from "./_components/PainelRevisao";
import { BotaoVoltar } from "../../_components/BotaoVoltar";

// Fase 27.149 — detalhe da documentação de uma empresa, pra revisão do
// admin: todos os documentos (empresa + cada sócio) com link assinado pra
// visualizar/baixar (mesmo padrão de createSignedUrl já usado em
// /chamados/[id]), e o painel de decisão (aprovar/rejeitar) ao final.
export default async function DocumentosEmpresaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">Esta tela é exclusiva do time interno (perfil administrador).</p>
      </div>
    );
  }

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nome, cnpj, segmento")
    .eq("id", id)
    .maybeSingle();
  if (!empresa) notFound();

  const situacao = await listarDocumentacao(supabase, id);
  const urlsPorDocumento = new Map<string, string | null>(
    await Promise.all(
      situacao.documentos.map(async (d) => [d.id, await gerarUrlAssinada(supabase, d.storagePath)] as const)
    )
  );
  const documentosEmpresa = new Map(situacao.documentos.filter((d) => !d.socioId).map((d) => [d.tipo, d]));
  const documentosPorSocio = new Map<string, DocumentoEmpresa[]>();
  for (const d of situacao.documentos) {
    if (!d.socioId) continue;
    const lista = documentosPorSocio.get(d.socioId) ?? [];
    lista.push(d);
    documentosPorSocio.set(d.socioId, lista);
  }

  return (
    <div className="max-w-3xl">
      <BotaoVoltar href="/documentos-empresas" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{empresa.nome}</h1>
        <p className="mt-1 text-sm text-slate-500">
          CNPJ {empresa.cnpj ?? "—"} · {empresa.segmento === "Revenda" ? "Posto" : "Cliente"} · Status:{" "}
          {LABEL_STATUS_DOCUMENTACAO[situacao.status]}
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Documentos da empresa</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {TIPOS_DOCUMENTO_EMPRESA.map((tipo) => {
            const doc = documentosEmpresa.get(tipo);
            return (
              <li key={tipo} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-slate-700">{LABEL_TIPO_DOCUMENTO[tipo]}</span>
                {doc ? (
                  <a href={urlsPorDocumento.get(doc.id) ?? "#"} target="_blank" rel="noreferrer" className="text-frota-600 hover:underline">
                    Ver {doc.nomeArquivo}
                  </a>
                ) : (
                  <span className="text-amber-600">Não enviado</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-sm font-semibold text-slate-900">Sócios</h2>
        <div className="mt-3 space-y-4">
          {situacao.socios.map((s) => {
            const docs = documentosPorSocio.get(s.id) ?? [];
            return (
              <div key={s.id} className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                <p className="text-xs text-slate-500">CPF: {s.cpf}</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {TIPOS_DOCUMENTO_SOCIO.map((tipo) => {
                    const doc = docs.find((d) => d.tipo === tipo);
                    return (
                      <li key={tipo} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                        <span className="text-slate-700">{LABEL_TIPO_DOCUMENTO[tipo]}</span>
                        {doc ? (
                          <a href={urlsPorDocumento.get(doc.id) ?? "#"} target="_blank" rel="noreferrer" className="text-frota-600 hover:underline">
                            Ver {doc.nomeArquivo}
                          </a>
                        ) : (
                          <span className="text-amber-600">Não enviado</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {situacao.socios.length === 0 && <p className="text-sm text-slate-400">Nenhum sócio cadastrado.</p>}
        </div>
      </div>

      {situacao.status === "rejeitada" && situacao.motivoRejeicao && (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Motivo da rejeição anterior:</strong> {situacao.motivoRejeicao}
        </div>
      )}

      <div className="mt-6">
        <PainelRevisao empresaId={id} status={situacao.status} />
      </div>
    </div>
  );
}
