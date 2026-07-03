import Image from "next/image";
import { Fuel, Route, BarChart3, Truck } from "lucide-react";

const FEATURES = [
  { icon: Fuel, label: "Rede de Postos" },
  { icon: Route, label: "Roteirização" },
  { icon: BarChart3, label: "Inteligência" },
  { icon: Truck, label: "Análise Frota" },
];

// Cabeçalho compartilhado das 3 telas públicas de autenticação (login,
// MFA, cadastro) — reproduz o mesmo lockup de marca da landing page
// (fxgestaodefrotasonline.com) e do mockup de referência aprovado pelo
// usuário: logo num cartão claro (o PNG tem traço em azul-marinho escuro,
// então precisa de fundo claro pra não "sumir" sobre o bg-frota-950),
// título grande, badge de posicionamento, e o selo "ACESSO SEGURO" no
// rodapé — tudo pra deixar claro que é o ambiente oficial da FNI.
//
// variant="full": usado só no /login (primeira impressão, tela mais
// "solene"). variant="compact": usado em /mfa-setup e /cadastro, que já
// têm formulário longo — mantém a marca em destaque sem empurrar o
// conteúdo pra fora da tela.
export function AuthLogoHeader({ variant = "full" }: { variant?: "full" | "compact" }) {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <div className="rounded-2xl border border-white/10 bg-white/95 px-8 py-6 shadow-lg shadow-frota-950/40 backdrop-blur">
        <Image
          src="/logo-fni.png"
          alt="Fleet Network Intelligence"
          width={1132}
          height={441}
          priority
          className="h-auto w-52"
        />
      </div>

      <h1 className="mt-5 text-2xl font-bold text-white sm:text-3xl">Fleet Network Intelligence</h1>

      <span className="mt-3 inline-flex items-center rounded-full border border-frota-600/40 bg-frota-800/60 px-4 py-1.5 text-xs font-semibold text-frota-300 sm:text-sm">
        Plataforma estratégica de inteligência de rede
      </span>

      {variant === "full" && (
        <>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            Transformando dados em decisões de rede. Análise de postos, roteirização e gestão de
            frota.
          </p>

          <div className="mt-6 grid grid-cols-4 gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-frota-800/50">
                  <Icon className="h-5 w-5 text-frota-400" strokeWidth={1.75} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-6 flex w-full max-w-xs items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          Acesso seguro
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  );
}
