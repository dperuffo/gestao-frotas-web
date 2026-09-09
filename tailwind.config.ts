import type { Config } from "tailwindcss";

// Fase Design-ProFrotas-Divergencias (09/09/2026, pedido do Daniel: gostou
// do visual do relatório HTML de divergências de pagamento ProFrotas —
// laranja/slate, cards arredondados com sombra suave, header em gradiente —
// e pediu redesign completo do painel com essa linguagem, substituindo o
// Swiss Minimalism monocromático/reto da fase anterior.
//
// MESMOS nomes de token de antes (`frota-*`/`accento`) de propósito, 3ª vez
// seguida: usados em ~150 telas via `bg-frota-500`/`text-frota-600`/
// `focus:ring-frota-500`/`bg-accento`. Redefinir só os valores aqui
// recolore o app inteiro sem precisar tocar em cada arquivo.
//
// `frota` agora é a escala slate (--slate #4e5d77 do HTML de referência) —
// usada pra texto de título/estrutura e pro gradiente do header. `accento`
// agora é o laranja (--orange #de6024 / --orange-dark #b84917) — o único
// acento decorativo/CTA do tema, igual o taupe fazia antes (mesma função,
// cor nova), usado em card top-border, badges de destaque, links, botão
// primário.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        frota: {
          950: "#2b3444", // slate escurecido — texto de maior ênfase
          900: "#333c4d", // ponta escura do gradiente do header
          800: "#3d495f", // ponta escura do gradiente do header (--slate escuro do HTML de ref.)
          700: "#4e5d77", // --slate do HTML de referência — títulos (h2/h3), ícones do menu
          600: "#66748d", // ponta clara do gradiente do header
          500: "#4e5d77", // ação principal / foco — mesmo slate de título (funciona em botão secundário e anéis de foco)
          100: "#e7eaef", // fundo claro tingido de slate (hover sutil, trilho de abas)
          50: "#f0f0f0", // --wash do HTML de referência — fundo de página
        },
        status: {
          ativo: "#4db956", // --green do HTML de referência
          atencao: "#e0a020",
          inativo: "#d94f4f", // --red do HTML de referência
        },
        accento: {
          DEFAULT: "#de6024", // --orange do HTML de referência — único acento decorativo do tema
          light: "#f0997b",
          dark: "#b84917", // --orange-dark — hover/estados escuros do acento
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // HTML de referência: cards/cases 14px, painéis/facts 10-12px,
        // badges sempre pill (rounded-full, já nativo do Tailwind) — bem
        // mais arredondado que a fase Swiss anterior (2/4/8px).
        xl: "14px", // usado por .card/.btn-primary/.input (globals.css)
        "2xl": "12px",
        "3xl": "20px",
      },
      boxShadow: {
        // --shadow do HTML de referência: sombra difusa e suave (tingida
        // de slate, não preto puro) — substitui o "0 2px 12px rgba(0,0,0,.06)"
        // mais achatado do Swiss Minimalism.
        card: "0 12px 32px rgba(78, 93, 119, .12)",
      },
    },
  },
  plugins: [],
};

export default config;
