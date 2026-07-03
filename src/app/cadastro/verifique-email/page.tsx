import Link from "next/link";
import { AuthShell, AuthCard } from "@/components/AuthShell";

// Exibida quando o projeto tem confirmação de e-mail habilitada no Supabase
// Auth — nesse caso, criarContaTrial() (em ../actions.ts) não recebe uma
// sessão de volta, então não há como já cair direto no dashboard.
export default function VerifiqueEmailPage() {
  return (
    <AuthShell variant="compact" maxWidthClassName="max-w-md">
      <AuthCard>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white">Quase lá!</h2>
          <p className="mt-2 text-sm text-slate-400">
            Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta e
            começar a usar o FNI Pro-Frotas.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Não recebeu? Confira a caixa de spam ou{" "}
            <Link href="/login" className="font-medium text-frota-500 hover:underline">
              volte para o login
            </Link>{" "}
            para reenviar.
          </p>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
