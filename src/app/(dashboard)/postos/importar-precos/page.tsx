import Link from "next/link";
import { ImportForm } from "./_components/ImportForm";

export default function ImportarPrecosPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Importar Preços (preco_posto.xlsx)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Atualiza o histórico de preços por posto e combustível a partir da planilha recorrente
          da integração Pró-Frotas (aba &quot;Preços&quot;) — pensado para reenvio periódico.
        </p>
      </div>

      <div className="mb-6 card p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Sobre esta importação:</p>
        <p className="mt-1">
          Envie o arquivo como exportado (aba &quot;Preços&quot;). O CNPJ do posto é casado
          automaticamente com o cliente dono dele, quando já existir em Postos Revendedores. A
          data de referência usa a &quot;Data de Vigência&quot; e, se estiver vazia (&quot;-&quot;),
          cai para a &quot;Data de Atualização&quot;.
        </p>
        <p className="mt-2">
          Se a origem não for a integração Pró-Frotas, também aceitamos o{" "}
          <Link href="/postos/importar-precos/modelo-padrao" className="text-frota-600 hover:underline">
            modelo padrão de planilha
          </Link>{" "}
          (cabeçalho por nome de coluna — CNPJ, Combustível, Preço e Data de Vigência são
          obrigatórios) — baixe, preencha com o layout do seu sistema e envie normalmente abaixo.
        </p>
        <p className="mt-2">
          Usuário de cliente: só são atualizados preços de postos que já fazem parte da sua rede
          negociada — CNPJs fora dela são ignorados (não criam posto novo nem alteram preço de
          outra empresa).
        </p>
      </div>

      <ImportForm />

      <div className="mt-6">
        <Link href="/postos" className="text-sm text-frota-600 hover:underline">
          ← Voltar para a lista de postos
        </Link>
      </div>
    </div>
  );
}
