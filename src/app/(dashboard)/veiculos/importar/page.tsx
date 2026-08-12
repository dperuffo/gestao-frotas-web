import Link from "next/link";
import { ImportForm } from "./_components/ImportForm";

export default function ImportarVeiculosPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Importar Veículos em Lote</h1>
          <p className="mt-1 text-sm text-slate-500">
            Envie uma planilha Excel (.xlsx) para cadastrar vários veículos de uma vez.
          </p>
        </div>
        <Link href="/veiculos/importar/modelo" className="btn-secondary">
          Baixar modelo (Excel)
        </Link>
      </div>

      <div className="mb-6 card p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Colunas do arquivo:</p>
        <p className="mt-1">
          <code>placa</code> e <code>cnpj_cliente</code> (CNPJ do cliente já cadastrado) são
          obrigatórias. Todas as demais (<code>marca</code>, <code>modelo</code>,{" "}
          <code>tipo_veiculo</code>, <code>tipo</code>: Leve ou Pesado,{" "}
          <code>classificacao</code>: Próprio ou Agregado,{" "}
          <code>motor</code>, <code>ano_modelo</code>, <code>ano_fabricacao</code>,{" "}
          <code>combustivel</code>, <code>tanque</code>, <code>autonomia</code>,{" "}
          <code>hodometro_atual</code>, <code>numero_eixos</code>, <code>capacidade_kg</code>,{" "}
          <code>cor</code>, <code>chassi</code>,{" "}
          <code>renavam</code>, <code>municipio</code>, <code>uf_veiculo</code>,{" "}
          <code>centro_custo</code> — nome exato de um centro de custo já cadastrado,{" "}
          <code>valor_aquisicao</code>, <code>data_aquisicao</code> — formato dd/mm/aaaa,{" "}
          <code>valor_residual_estimado</code> e <code>vida_util_anos</code> — usados no TCO e
          no Patrimônio) são opcionais.
        </p>
      </div>

      <ImportForm />

      <div className="mt-6">
        <Link href="/veiculos" className="text-sm text-frota-600 hover:underline">
          ← Voltar para a lista de veículos
        </Link>
      </div>
    </div>
  );
}
