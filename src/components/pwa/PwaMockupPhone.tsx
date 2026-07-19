// Fase PWA-Lembrete-Mobile (19/07) — pedido do Daniel: lembrete nas visões
// web de clientes/postos sobre o app mobile (PWA), com uma imagem da tela
// do app. Como não há um print salvo como asset no repositório, esta é uma
// ilustração vetorial (SVG) reproduzindo a tela de login real da PWA
// (mobile.fxgestaodefrotasonline.com) — mesma paleta "frota" do design
// system, logo estilizado (rede de pontos conectados), campos de
// e-mail/senha e o botão "Continuar com Google". Fica leve (sem imagem
// bitmap) e nítida em qualquer resolução/zoom.
export function PwaMockupPhone({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 520"
      className={className}
      role="img"
      aria-label="Tela de login do app FNI Gestão de Frotas no celular"
    >
      <defs>
        <linearGradient id="pwa-mockup-tela" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F2A4A" />
          <stop offset="100%" stopColor="#0B1220" />
        </linearGradient>
      </defs>

      {/* Moldura do celular */}
      <rect x="2" y="2" width="256" height="516" rx="34" fill="#111827" />
      <rect x="8" y="8" width="244" height="504" rx="28" fill="url(#pwa-mockup-tela)" />

      {/* Notch */}
      <rect x="105" y="8" width="50" height="16" rx="8" fill="#111827" />

      {/* Cartão branco com o logo */}
      <rect x="38" y="70" width="184" height="110" rx="16" fill="#ffffff" />
      {/* Logo: rede de pontos conectados (mesmo espírito do ícone FNI) */}
      <g transform="translate(58, 95)" stroke="#0E7490" strokeWidth="3" fill="none">
        <line x1="0" y1="40" x2="24" y2="15" />
        <line x1="24" y1="15" x2="24" y2="45" />
        <line x1="24" y1="45" x2="46" y2="20" />
        <line x1="24" y1="45" x2="10" y2="55" />
        <line x1="24" y1="45" x2="38" y2="58" />
      </g>
      <g transform="translate(58, 95)" fill="#0E7490">
        <circle cx="0" cy="40" r="4.5" />
        <circle cx="24" cy="15" r="7" />
        <circle cx="46" cy="20" r="4.5" />
        <circle cx="10" cy="55" r="4.5" />
        <circle cx="38" cy="58" r="4.5" />
      </g>
      <circle cx="82" cy="110" r="3.2" fill="#ffffff" />
      <text x="130" y="108" fontSize="15" fontWeight="700" fill="#0F2A4A" fontFamily="Arial, sans-serif">
        Fleet Network
      </text>
      <text x="130" y="126" fontSize="15" fontWeight="700" fill="#0F2A4A" fontFamily="Arial, sans-serif">
        Intelligence
      </text>

      {/* Título */}
      <text x="130" y="212" fontSize="20" fontWeight="700" fill="#ffffff" textAnchor="middle" fontFamily="Arial, sans-serif">
        Gestão de Frotas
      </text>
      <text x="130" y="232" fontSize="10.5" fill="#B9C4D6" textAnchor="middle" fontFamily="Arial, sans-serif">
        Plataforma de inteligência de rede
      </text>

      {/* Campo e-mail */}
      <rect x="30" y="256" width="200" height="34" rx="8" fill="none" stroke="#3E4C63" strokeWidth="1.5" />
      <text x="42" y="277" fontSize="11" fill="#8794A8" fontFamily="Arial, sans-serif">
        E-mail
      </text>

      {/* Campo senha */}
      <rect x="30" y="300" width="200" height="34" rx="8" fill="none" stroke="#3E4C63" strokeWidth="1.5" />
      <text x="42" y="321" fontSize="11" fill="#8794A8" fontFamily="Arial, sans-serif">
        Senha
      </text>

      {/* Botão Entrar */}
      <rect x="30" y="346" width="200" height="36" rx="9" fill="#0EA5E9" />
      <text x="130" y="369" fontSize="13" fontWeight="700" fill="#ffffff" textAnchor="middle" fontFamily="Arial, sans-serif">
        Entrar
      </text>

      {/* Divisor "ou" */}
      <line x1="30" y1="402" x2="112" y2="402" stroke="#3E4C63" strokeWidth="1" />
      <text x="130" y="406" fontSize="10" fill="#8794A8" textAnchor="middle" fontFamily="Arial, sans-serif">
        ou
      </text>
      <line x1="148" y1="402" x2="230" y2="402" stroke="#3E4C63" strokeWidth="1" />

      {/* Botão Google */}
      <rect x="30" y="420" width="200" height="36" rx="9" fill="#ffffff" />
      <circle cx="58" cy="438" r="6" fill="#0EA5E9" />
      <text x="140" y="442" fontSize="11.5" fontWeight="600" fill="#0F2A4A" textAnchor="middle" fontFamily="Arial, sans-serif">
        Continuar com Google
      </text>
    </svg>
  );
}
