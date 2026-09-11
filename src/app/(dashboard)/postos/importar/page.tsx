import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./_components/ImportForm";

export default async function ImportarPostosPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");

  return (
    <div>
      <CabecalhoPagina
        titulo="Importar Rede de Postos (postos_gf.xlsx)"
        descricao="Principal forma de cadastro dos postos revendedores: envie a planilha recorrente com a rede de postos credenciados/negociados de UM cliente por vez (o arquivo não traz o CNPJ do cliente — selecione abaixo)."
      />

      <div className="mb-6 card p-4 text-sm text-slate-600 dark:text-slate-300">
        <p className="font-medium text-slate-700 dark:text-slate-300">Sobre esta importação:</p>
        <p className="mt-1">
          Envie o arquivo exatamente como exportado do sistema de origem (aba &quot;Ponto de
          Venda&quot;, 43 colunas). Reenviar um CNPJ já existente atualiza os dados desse posto
          (upsert) e não altera se o gestor bloqueou o posto para abastecimento — esse bloqueio é
          feito manualmente na tela de cada posto e é preservado entre importações.
        </p>
        <p className="mt-2">
          Se a origem não for a integração Pró-Frotas, também aceitamos o{" "}
          <Link href="/postos/importar/modelo-padrao" className="text-frota-600 hover:underline">
            modelo padrão de planilha
          </Link>{" "}
          (cabeçalho por nome de coluna, só o CNPJ é obrigatório) — baixe, preencha com o layout
          do seu sistema e envie normalmente abaixo.
        </p>
      </div>

      <ImportForm empresas={empresas ?? []} />

      <div className="mt-6">
        <Link href="/postos" className="text-sm text-frota-600 hover:underline">
          ← Voltar para a lista de postos
        </Link>
      </div>
    </div>
  );
}
