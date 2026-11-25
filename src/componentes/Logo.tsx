/** Ícone do Orçamento CiviObra: blocos assentados em degraus, com a seta de avanço da obra. */
export function Logo({ tamanho = 38 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" role="img" aria-label="Orçamento CiviObra" style={{ flex: "none", filter: "drop-shadow(0 8px 16px rgba(242,140,40,0.45))" }}>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffa850" />
          <stop offset="1" stopColor="#e06f0c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#logo-g)" />
      <g fill="#fff">
        <rect x="10" y="40" width="20" height="10" rx="2.5" />
        <rect x="34" y="40" width="20" height="10" rx="2.5" opacity=".78" />
        <rect x="22" y="27" width="20" height="10" rx="2.5" />
        <rect x="34" y="14" width="20" height="10" rx="2.5" />
      </g>
      <path d="M11 30 L23 18" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity=".78" />
      <path d="M15 17.5 H23.5 V26" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity=".78" />
    </svg>
  );
}
