import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./_components/ImportForm";

export default async function ImportarPostosAnpPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          A atualização do universo de postos ANP é exclusiva do time interno (perfil
          administrador).
        </p>
      </div>
    );
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Atualizar Universo ANP"
        descricao={
          <>
            Envie a planilha <code>postos_anp.xlsx</code> (aba &quot;Postos ANP&quot;) com o cadastro nacional
            completo (cerca de 35 mil postos). A coluna &quot;Gestão de Frotas&quot; indica quais desses postos já
            fazem parte da rede negociada — é usada na tela de Postos para mostrar o que está ativo na solução.
          </>
        }
      />

      <div className="mb-6 card p-4 text-sm text-slate-600 dark:text-slate-300">
        <p className="font-medium text-slate-700 dark:text-slate-300">Colunas esperadas (cabeçalho da planilha):</p>
        <p className="mt-1">
          <code>UF</code>, <code>Município</code>, <code>Razão Social</code>,{" "}
          <code>CNPJ</code> (obrigatórias), e opcionalmente{" "}
          <code>Distribuidora / Bandeira</code>, <code>Gestão de Frotas</code>,{" "}
          <code>Endereço</code>, <code>Bairro</code>, <code>CEP</code>,{" "}
          <code>Autorização ANP</code>, <code>Situação</code>, <code>Status SIGAF</code>,{" "}
          <code>Latitude</code>, <code>Longitude</code>. Reenviar atualiza os postos já
          cadastrados (upsert por CNPJ) — é seguro reenviar a planilha inteira a cada
          atualização.
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
