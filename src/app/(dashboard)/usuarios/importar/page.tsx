import Link from "next/link";
import { ImportForm } from "./_components/ImportForm";

export default function ImportarUsuariosPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Importar Usuários em Lote</h1>
          <p className="mt-1 text-sm text-slate-500">
            Envie uma planilha Excel (.xlsx) para cadastrar vários usuários de uma vez. Cada linha vira um
            convite por e-mail, igual ao cadastro individual.
          </p>
        </div>
        <Link href="/usuarios/importar/modelo" className="btn-secondary">
          Baixar modelo (Excel)
        </Link>
      </div>

      <div className="mb-6 card p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Colunas do arquivo:</p>
        <p className="mt-1">
          <code>nome</code>, <code>email</code> e <code>perfil</code> ({" "}
          admin, gestor_frota, analista ou posto) e <code>cnpj_cliente</code> (CNPJ do
          cliente já cadastrado) são obrigatórias. <code>cpf</code>, <code>telefone</code> e{" "}
          <code>segmento</code> (Frota ou Revenda) são opcionais.
        </p>
      </div>

      <ImportForm />

      <div className="mt-6">
        <Link href="/usuarios" className="text-sm text-frota-600 hover:underline">
          ← Voltar para a lista de usuários
        </Link>
      </div>
    </div>
  );
}
