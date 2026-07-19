// Fase PWA-Lembrete-Mobile (19/07) — ilustração vetorial da tela de login
// do PWA Motorista ("Estrada que Cuida", estrada.fxgestaodefrotasonline.com)
// — mesmo espírito de PwaMockupPhone.tsx (app cliente/posto), mas com o
// tema claro real desse app (fundo branco, login por celular/DDD em vez de
// e-mail/senha).
export function PwaMockupPhoneMotorista({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 520"
      className={className}
      role="img"
      aria-label="Tela de login do app Estrada que Cuida no celular"
    >
      {/* Moldura do celular */}
      <rect x="2" y="2" width="256" height="516" rx="34" fill="#111827" />
      <rect x="8" y="8" width="244" height="504" rx="28" fill="#F8FAFC" />

      {/* Notch */}
      <rect x="105" y="8" width="50" height="16" rx="8" fill="#111827" />

      {/* Logo: rede de pontos conectados, mesmo espírito do ícone FNI */}
      <g transform="translate(90, 150)" stroke="#0E7490" strokeWidth="3.4" fill="none">
        <line x1="0" y1="48" x2="28" y2="18" />
        <line x1="28" y1="18" x2="28" y2="54" />
        <line x1="28" y1="54" x2="54" y2="24" />
        <line x1="28" y1="54" x2="12" y2="66" />
        <line x1="28" y1="54" x2="45" y2="70" />
      </g>
      <g transform="translate(90, 150)" fill="#0E7490">
        <circle cx="0" cy="48" r="5" />
        <circle cx="28" cy="18" r="8.5" />
        <circle cx="54" cy="24" r="5" />
        <circle cx="12" cy="66" r="5" />
        <circle cx="45" cy="70" r="5" />
      </g>

      {/* Título */}
      <text x="130" y="270" fontSize="21" fontWeight="700" fill="#0F172A" textAnchor="middle" fontFamily="Arial, sans-serif">
        Estrada que Cuida
      </text>
      <text x="130" y="292" fontSize="10.5" fill="#64748B" textAnchor="middle" fontFamily="Arial, sans-serif">
        Mais do que abastecer.
      </text>
      <text x="130" y="306" fontSize="10.5" fill="#64748B" textAnchor="middle" fontFamily="Arial, sans-serif">
        Cuidar de quem move o Brasil.
      </text>

      {/* Campo celular */}
      <rect x="30" y="332" width="200" height="36" rx="9" fill="none" stroke="#CBD5E1" strokeWidth="1.5" />
      <text x="46" y="355" fontSize="11" fill="#94A3B8" fontFamily="Arial, sans-serif">
        Seu celular (com DDD)
      </text>

      {/* Botão Continuar */}
      <rect x="30" y="380" width="200" height="38" rx="9" fill="#0EA5E9" />
      <text x="130" y="404" fontSize="13" fontWeight="700" fill="#ffffff" textAnchor="middle" fontFamily="Arial, sans-serif">
        Continuar
      </text>
    </svg>
  );
}
