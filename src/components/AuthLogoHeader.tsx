import Image from "next/image";
import { Fuel, Route, BarChart3, Truck } from "lucide-react";

const FEATURES = [
  { icon: Fuel, label: "Rede de Postos" },
  { icon: Route, label: "Roteirização" },
  { icon: BarChart3, label: "Inteligência" },
  { icon: Truck, label: "Análise Frota" },
];

// Cabeçalho compartilhado das telas públicas de autenticação (login, MFA
// — tanto configuração quanto verificação —, cadastro) — reproduz o
// mesmo lockup de marca da landing page (fxgestaodefrotasonline.com).
//
// Fase Paleta-Clara (04/09/2026): antes o cartão do logo era claro
// (bg-white/95) só pra contrastar com o fundo escuro do AuthShell; agora
// que o AuthShell também é claro, mantém o cartão branco (o PNG da logo
// tem traço em azul-marinho, precisa de fundo bem claro pra não perder
// contraste) mas com borda/sombra na mesma linguagem do `.card` do resto
// do app, sem blur.
//
// variant="full": usado só no /login (primeira impressão, tela mais
// "solene"). variant="compact": usado em /mfa-setup e /cadastro, que já
// têm formulário longo — mantém a marca em destaque sem empurrar o
// conteúdo pra fora da tela.
export function AuthLogoHeader({ variant = "full" }: { variant?: "full" | "compact" }) {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
        <Image
          src="/logo-fni.png"
          alt="Fleet Network Intelligence"
          width={1132}
          height={441}
          priority
          className="h-auto w-52"
        />
      </div>

      <h1 className="mt-5 text-2xl font-bold text-frota-900 sm:text-3xl">Fleet Network Intelligence</h1>

      <span className="mt-3 inline-flex items-center rounded-full border border-accento/40 bg-accento/10 px-4 py-1.5 text-xs font-semibold text-frota-800 sm:text-sm">
        Plataforma estratégica de inteligência de rede
      </span>

      {variant === "full" && (
        <>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
            Transformando dados em decisões de rede. Análise de postos, roteirização e gestão de
            frota.
          </p>

          <div className="mt-6 grid grid-cols-4 gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white">
                  <Icon className="h-5 w-5 text-frota-700" strokeWidth={1.75} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-6 flex w-full max-w-xs items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          Acesso seguro
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  );
}
