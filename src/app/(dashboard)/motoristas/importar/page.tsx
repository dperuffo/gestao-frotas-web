import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ImportForm } from "./_components/ImportForm";

export default function ImportarMotoristasPage() {
  return (
    <div>
      <CabecalhoPagina
        titulo="Importar Motoristas em Lote"
        descricao="Envie uma planilha Excel (.xlsx) para cadastrar vários motoristas de uma vez."
        acoes={
          <Link href="/motoristas/importar/modelo" className="btn-secondary">
            Baixar modelo (Excel)
          </Link>
        }
      />

      <div className="mb-6 card p-4 text-sm text-slate-600 dark:text-slate-300">
        <p className="font-medium text-slate-700 dark:text-slate-300">Colunas do arquivo:</p>
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
