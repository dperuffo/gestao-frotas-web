import type { Config } from "tailwindcss";

// Paleta de cores da Plataforma de Gestão de Frotas
// (definida na proposta técnica — Fase "UX/UI e Design System")
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        frota: {
          950: "#0B1220", // grafite/petróleo escuro — base de fundo/sidebar
          900: "#0F2A4A",
          800: "#123A63",
          700: "#155080",
          600: "#0E7490", // ciano petróleo — destaque secundário
          500: "#0EA5E9", // ciano — ações principais
          100: "#E0F2FE",
          50: "#F0F9FF",
        },
        status: {
          ativo: "#16A34A",
          atencao: "#F59E0B",
          inativo: "#DC2626",
        },
      },
      borderRadius: {
        xl: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
