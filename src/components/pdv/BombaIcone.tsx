// Ícone de bomba de combustível desenhado em SVG (sem dependência de fonte
// de ícones). O visor mostra o número do bico; a cor vem de `currentColor`.
export function BombaIcone({ numero, className = "h-16 w-16" }: { numero: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={className} fill="none" aria-hidden="true">
      {/* base */}
      <rect x="6" y="64" width="38" height="5" rx="2.5" fill="currentColor" opacity="0.35" />
      {/* corpo */}
      <rect x="9" y="6" width="32" height="58" rx="5" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="2.5" />
      {/* visor */}
      <rect x="14" y="12" width="22" height="16" rx="3" fill="currentColor" />
      <text
        x="25"
        y="24.5"
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fill="#fff"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {numero}
      </text>
      {/* painel */}
      <rect x="14" y="34" width="22" height="3" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="14" y="40" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.5" />
      {/* mangueira e bico */}
      <path d="M41 22 H49 a5 5 0 0 1 5 5 V48 a3.5 3.5 0 0 0 7 0 V30 l-4 -6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="57.5" cy="48" r="1.6" fill="currentColor" />
    </svg>
  );
}
