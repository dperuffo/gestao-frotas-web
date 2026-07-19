import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import {
  listarDocumentacao,
  gerarUrlAssinada,
  TIPOS_DOCUMENTO_EMPRESA,
  LABEL_TIPO_DOCUMENTO,
  LABEL_STATUS_DOCUMENTACAO,
  type DocumentoEmpresa,
  type StatusDocumentacao,
} from "@/lib/empresasDocumentos";
import { SlotDocumento } from "./_components/SlotDocumento";
import { SecaoSocios } from "./_components/SecaoSocios";
import { BotaoEnviarParaAnalise } from "./_components/BotaoEnviarParaAnalise";

type SearchParams = { empresa?: string };

const COR_STATUS: Record<StatusDocumentacao, string> = {
  nao_iniciada: "bg-slate-100 text-slate-600",
  pendente: "bg-amber-100 text-amber-700",
  aprovada: "bg-green-100 text-green-700",
  rejeitada: "bg-red-100 text-red-700",
};

// Fase 27.149 — pedido do Daniel: "mecanismo para que o usuario consiga
// fazer o upload de documentos para checagem pelo admin e liberação para
// uso da plataforma" — Contrato Social/Estatuto, documentos pessoais dos
// sócios (CPF, RG ou CNH, comprovante de endereço) e comprovante de
// endereço da empresa. Aprovada pelo admin (ver /documentos-empresas),
// libera criar/aderir a Redes de Postos ou Grupos Econômicos e aceitar/
// criar negociações — mesmo espírito do gate de assinatura obrigatória já
// usado em /negociacoes (Fase 27.125). Vale tanto pra posto quanto pra
// cliente — sem seletor de segmento, igual /minha-empresa.
export default async function DocumentosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semEmpresaEscolhida = empresas.length > 1 && !empresaSelecionada;

  if (!empresaSelecionada) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Documentos</h1>
        </div>
        {semEmpresaEscolhida ? (
          <form className="mb-4 flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
              <select name="empresa" className="input text-sm">
                <option value="">Selecione...</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary text-sm">
              Trocar
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma empresa vinculada a este usuário.</p>
        )}
      </div>
    );
  }

  const situacao = await listarDocumentacao(supabase, empresaSelecionada);

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Documentos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Documentação societária e cadastral{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
            Aprovada pelo admin, libera criar/aderir a Redes de Postos ou Grupos Econômicos e aceitar/criar
            negociações.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${COR_STATUS[situacao.status]}`}>
          {LABEL_STATUS_DOCUMENTACAO[situacao.status]}
        </span>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
            <select name="empresa" defaultValue={empresaSelecionada} className="input text-sm">
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Trocar
          </button>
        </form>
      )}

      {situacao.status === "rejeitada" && situacao.motivoRejeicao && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Motivo da rejeição:</strong> {situacao.motivoRejeicao}
        </div>
      )}
      {situacao.status === "pendente" && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Documentação enviada, aguardando análise do admin.
        </div>
      )}
      {situacao.status === "aprovada" && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Documentação aprovada — nenhuma pendência.
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">Documentos da empresa</h2>
        <div className="mt-3 space-y-2">
          {TIPOS_DOCUMENTO_EMPRESA.map((tipo) => {
            const doc = documentosEmpresa.get(tipo);
            return (
              <SlotDocumento
                key={tipo}
                empresaId={empresaSelecionada}
                tipo={tipo}
                socioId={null}
                label={LABEL_TIPO_DOCUMENTO[tipo]}
                documento={doc ? { id: doc.id, nomeArquivo: doc.nomeArquivo, url: urlsPorDocumento.get(doc.id) ?? null } : null}
              />
            );
          })}
        </div>
      </div>

      <SecaoSocios
        empresaId={empresaSelecionada}
        socios={situacao.socios}
        documentosPorSocio={documentosPorSocio}
        urlsPorDocumento={urlsPorDocumento}
      />

      <div className="card mt-6 p-6">
        <BotaoEnviarParaAnalise empresaId={empresaSelecionada} status={situacao.status} />
      </div>
    </div>
  );
}
