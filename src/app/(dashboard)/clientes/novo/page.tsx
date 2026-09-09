import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ClienteForm } from "../_components/ClienteForm";

export default function NovoClientePage() {
  return (
    <div>
      <CabecalhoPagina titulo="Novo Cliente" />
      <ClienteForm />
    </div>
  );
}
