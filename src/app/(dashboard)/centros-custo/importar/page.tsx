import Link from "next/link";
import { ImportForm } from "./_components/ImportForm";

export default function ImportarCentrosCustoPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Importar Centros de Custo em Lote</h1>
          <p className="mt-1 text-sm text-slate-500">
            Envie uma planilha Excel (.xlsx) para cadastrar vários centros de custo de uma vez.
          </p>
        </div>
        <Link href="/centros-custo/importar/modelo" className="btn-secondary">
          Baixar modelo (Excel)
        </Link>
      </div>

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
