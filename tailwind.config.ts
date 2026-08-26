import type { Config } from "tailwindcss";

// Fase Design-System-Corporate-Blue (26/08/2026, pedido do Daniel: "quero
// fazer uma mudança geral no design... desde a landing page, passando pelo
// login, MFA e todas as telas... o tema Liquid Glass não foi bem aceito
// pelos usuários") — substitui a paleta e a "receita" visual do Liquid
// Glass (fundo escuro com anel de luz, blur/saturate pesado) pelo design.md
// fornecido pelo Daniel: "SaaS Enterprise Analytics" — corporativo, limpo,
// data-driven, tons de azul sobre branco, sem preto puro, sem
// glassmorphism exagerado (só sombra suave em cards).
//
// MESMOS nomes de token de antes (`frota-*`) de propósito: são usados em
// ~150 telas via classes como `bg-frota-500`/`text-frota-600`/
// `focus:ring-frota-500`. Redefinir só os valores aqui recolore o app
// inteiro sem precisar tocar em cada arquivo — mesmo princípio que já
// tornou `.card`/`.btn-primary` (globals.css) o ponto único de mudança.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        frota: {
          950: "#0F172A", // design.md "Dark Navy" (primary) — fundo do menu lateral/auth
          900: "#132038",
          800: "#1B2C4A",
          700: "#1E3A64",
          600: "#1E40AF", // design.md "Royal Blue" (secondary) — destaque/hover
          500: "#3B82F6", // design.md "Blue" (tertiary) — ação principal (botões, links, foco)
          100: "#DBEAFE",
          50: "#F8FAFC", // design.md "Light Grey" (accent) — fundo de página/superfície secundária
        },
        status: {
          ativo: "#16A34A",
          atencao: "#F59E0B",
          inativo: "#DC2626",
        },
      },
      fontFamily: {
        // design.md: Inter em tudo (display/body/labels); JetBrains Mono só
        // pra valores técnicos/código — aplicado pontualmente via
        // `font-mono` onde fizer sentido (ex: códigos de abastecimento),
        // não precisa virar o default do body.
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // design.md: sm 12px / md 24px / lg 36px — Tailwind já tem `rounded-xl`
        // = 12px por padrão (mantido); os 2 acima cobrem a escala completa.
        xl: "0.75rem",
        "2xl": "1.5rem", // 24px — design.md "md"
        "3xl": "2.25rem", // 36px — design.md "lg"
      },
    },
  },
  plugins: [],
};

export default config;
