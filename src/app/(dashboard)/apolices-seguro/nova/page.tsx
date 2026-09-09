import { redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ApoliceForm } from "../_components/ApoliceForm";

export default async function NovaApolicePage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaId } = await searchParams;
  if (!empresaId) redirect("/apolices-seguro");

  return (
    <div>
      <CabecalhoPagina titulo="Nova Apólice de Seguro" />
      <ApoliceForm empresaId={empresaId} />
    </div>
  );
}
