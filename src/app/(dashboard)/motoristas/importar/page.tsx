import Link from "next/link";
import { ImportForm } from "./_components/ImportForm";

export default function ImportarMotoristasPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Importar Motoristas em Lote</h1>
          <p className="mt-1 text-sm text-slate-500">
            Envie uma planilha Excel (.xlsx) para cadastrar vários motoristas de uma vez.
          </p>
        </div>
        <Link href="/motoristas/importar/modelo" className="btn-secondary">
          Baixar modelo (Excel)
        </Link>
      </div>

      <div className="mb-6 card p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Colunas do arquivo:</p>
        <p className="mt-1">
          <code>nome_completo</code>, <code>cpf</code> e <code>cnpj_cliente</code> (CNPJ do
          cliente já cadastrado) são obrigatórias. <code>telefone</code>, <code>email</code>,{" "}
          <code>classificacao</code> (Próprio ou Agregado), <code>cnh</code>,{" "}
          <code>cnh_vencimento</code> (AAAA-MM-DD) e <code>centro_custo</code> (nome exato de um
          centro de custo já cadastrado) são opcionais.
        </p>
      </div>

      <ImportForm />

      <div className="mt-6">
        <Link href="/motoristas" className="text-sm text-frota-600 hover:underline">
          ← Voltar para a lista de motoristas
        </Link>
      </div>
    </div>
  );
}
