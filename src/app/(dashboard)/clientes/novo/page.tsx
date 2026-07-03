import { ClienteForm } from "../_components/ClienteForm";

export default function NovoClientePage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Cliente</h1>
      <ClienteForm />
    </div>
  );
}
