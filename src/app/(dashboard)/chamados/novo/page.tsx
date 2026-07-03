import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { ChamadoForm } from "../_components/ChamadoForm";

// Fase 27.26 — achado real: um cliente novo (perfil não-admin, 1 única
// empresa vinculada) trava nessa tela com o erro genérico mascarado de
// produção do Next, de forma reproduzível (aconteceu de novo depois de
// reload, com outro usuário, e através de vários deploys com código
// diferente) — sem NENHUM rastro nos logs do Supabase (storage/auth/
// postgres) e sem nenhuma anomalia visível nos dados dela via SQL direto
// (empresa, vínculo, perfil e MFA, tudo normal). Isso indica que a falha
// não é no banco nem no RLS, e a mensagem mascarada da Next não estava
// ajudando a diagnosticar. Envolve a busca de dados em try/catch e mostra
// o erro REAL (mensagem completa) na tela em vez de deixar escapar pro
// crash genérico — isso não é a correção do bug em si, é uma forma de
// finalmente enxergar a causa real na próxima vez que acontecer.
export default async function NovoChamadoPage() {
  try {
    const supabase = await createClient();
    const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase);

    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Chamado</h1>
        <ChamadoForm empresas={empresas} empresaSelecionadaInicial={empresaSelecionada} />
      </div>
    );
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[chamados/novo] falha ao carregar a tela:", e);
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Chamado</h1>
        <div className="max-w-2xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Não foi possível carregar esta tela.</p>
          <p className="mt-1">Motivo: {mensagem}</p>
          {stack && (
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-red-700">
              {stack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
