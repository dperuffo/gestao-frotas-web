import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ImportForm } from "./_components/ImportForm";

export default function ImportarCentrosCustoPage() {
  return (
    <div>
      <CabecalhoPagina
        titulo="Importar Centros de Custo em Lote"
        descricao="Envie uma planilha Excel (.xlsx) para cadastrar vários centros de custo de uma vez."
        acoes={
          <Link href="/centros-custo/importar/modelo" className="btn-secondary">
            Baixar modelo (Excel)
          </Link>
        }
      />

      <div className="mb-6 card p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Colunas do arquivo:</p>
        <p className="mt-1">
          <code>nome</code> e <code>cnpj_cliente</code> (CNPJ do cliente já cadastrado) são
          obrigatórias. <code>codigo</code>, <code>responsavel</code> e <code>descricao</code> são
          opcionais.
        </p>
      </div>

      <ImportForm />

      <div className="mt-6">
        <Link href="/centros-custo" className="text-sm text-frota-600 hover:underline">
          ← Voltar para a lista de centros de custo
        </Link>
      </div>
    </div>
  );
}
