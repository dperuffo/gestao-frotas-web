import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ImportForm } from "./_components/ImportForm";

export default function ImportarAbastecimentosPage() {
  return (
    <div>
      <CabecalhoPagina
        titulo="Importar Abastecimentos em Lote"
        descricao="Para clientes que ainda não têm integração automática com o meio de pagamento (ex: PróFrotas). Outras integrações estão previstas para o futuro."
        acoes={
          <Link href="/abastecimentos/importar/modelo" className="btn-secondary">
            Baixar modelo (Excel)
          </Link>
        }
      />

      <div className="mb-6 card p-4 text-sm text-slate-600 dark:text-slate-300">
        <p className="font-medium text-slate-700 dark:text-slate-300">Colunas do arquivo:</p>
        <p className="mt-1">
          <code>cnpj_cliente</code> (CNPJ do cliente já cadastrado) é obrigatória. Todas as
          demais (<code>data_abastecimento</code> — formato AAAA-MM-DD HH:MM,{" "}
          <code>veiculo_placa</code>, <code>motorista_nome</code>, <code>hodometro</code>,{" "}
          <code>produto</code>, <code>litros</code>, <code>preco_litro</code>,{" "}
          <code>valor_total</code>, <code>posto_nome</code>, <code>posto_municipio</code> e{" "}
          <code>posto_uf</code>) são opcionais.
        </p>
      </div>

      <ImportForm />

      <div className="mt-6">
        <Link href="/abastecimentos" className="text-sm text-frota-600 hover:underline">
          ← Voltar para a lista de abastecimentos
        </Link>
      </div>
    </div>
  );
}
