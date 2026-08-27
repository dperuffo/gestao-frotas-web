import { redirect } from "next/navigation";
import { ApoliceForm } from "../_components/ApoliceForm";

export default async function NovaApolicePage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaId } = await searchParams;
  if (!empresaId) redirect("/apolices-seguro");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Nova Apólice de Seguro</h1>
      </div>
      <ApoliceForm empresaId={empresaId} />
    </div>
  );
}
