import type { Config } from "tailwindcss";

// Fase Design-System-Swiss-Minimalism (27/08/2026, pedido do Daniel: "não
// gostei" da fase Corporate Blue de ontem — novo design.md: "Minimalism &
// Swiss Style", preto/branco/bege/cinza/taupe, cantos retos, tipografia
// grid-based, herança da Basel/Zurich school dos anos 50 — Daniel confirmou
// via pergunta explícita: substituir tudo de novo (não só a landing), e
// usar off-black/charcoal em vez do #000000 literal do front-matter,
// seguindo a própria seção Do's/Don'ts do arquivo ("No pure black").
//
// MESMOS nomes de token de antes (`frota-*`) de propósito, 2ª vez seguida:
// são usados em ~150 telas via `bg-frota-500`/`text-frota-600`/
// `focus:ring-frota-500`. Redefinir só os valores aqui recolore o app
// inteiro sem precisar tocar em cada arquivo.
//
// Token novo, `accento` (taupe #B38B6D) — o próprio design.md lista Taupe
// como "Extended palette, decorative use", separado da paleta funcional
// preto/branco/cinza. Em vez de forçar esse tom dentro da escala `frota`
// (que precisa ficar monocromática pra botões/inputs/foco baterem com o
// spec — "Primary Button: Accent color fill" = colors.primary = preto),
// isolado num token próprio, usado só em toques decorativos pontuais (CTA
// da landing, indicador de item ativo no menu).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        frota: {
          950: "#111111", // off-black (design.md pede #000000, mas o próprio arquivo diz "No pure black")
          900: "#1A1A1A",
          800: "#262626",
          700: "#404040",
          600: "#0D0D0D", // hover/darken do botão primário — mais escuro que o 500, ainda off-black
          500: "#171717", // ação principal (botões, links, foco) — "Primary Button: Accent color fill" = preto
          100: "#E5E5E5",
          50: "#F8FAFC", // design.md "Light Grey" (secondary surface) — fundo de página
        },
        status: {
          ativo: "#16A34A",
          atencao: "#F59E0B",
          inativo: "#DC2626",
        },
        accento: {
          DEFAULT: "#B38B6D", // design.md "Taupe" — único acento decorativo do tema
          light: "#C9A788",
        },
      },
      fontFamily: {
        // design.md pede só "sans-serif" genérico pra este tema — Inter já
        // atende (é uma sans-serif neutra, no espírito Helvetica/Swiss),
        // sem precisar trocar a fonte carregada em layout.tsx. JetBrains
        // Mono continua pra valores técnicos/código.
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // design.md (front-matter deste tema): sm 2px / md 4px / lg 8px —
        // "Base corner radius: 0px", "Sharp edges (0px) shape" (Botão
        // Primário, Cards). Cantos quase retos, bem diferente da escala
        // 12/24/36 da fase anterior (Corporate Blue).
        xl: "2px", // design.md "sm" — usado por .card/.btn-primary/.input (globals.css)
        "2xl": "4px", // design.md "md"
        "3xl": "8px", // design.md "lg"
      },
    },
  },
  plugins: [],
};

export default config;
