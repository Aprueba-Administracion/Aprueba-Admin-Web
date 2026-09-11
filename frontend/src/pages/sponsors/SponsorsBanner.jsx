// Banner con la ilustración de libros y birrete en marca de agua idéntico a la captura
export function SponsorsBanner({ title, subtitle }) {
  return (
    <div
      className="sp-banner"
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: 110,
        padding: '24px 30px',
        borderRadius: 18,
        background: 'var(--banner-grad)',
        border: '1px solid var(--banner-border)',
        boxShadow: '0 4px 20px var(--banner-shadow)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Ilustración de libros + birrete dibujada en SVG con estilo marca de agua */}
      <svg
        className="sp-banner-illustration"
        viewBox="0 0 160 170"
        style={{
          position: 'absolute',
          left: 12,
          bottom: -15,
          width: 140,
          height: 140,
          pointerEvents: 'none',
          opacity: 0.55,
        }}
      >
        {/* Birrete */}
        <polygon points="75,20 135,42 75,64 15,42" fill="#b9d6f3" stroke="#8faece" strokeWidth="2.5" />
        <path d="M40,52 L40,78 C40,92 110,92 110,78 L110,52" fill="#cbe2f8" stroke="#8faece" strokeWidth="2.5" />
        <path d="M125,48 L142,66 L142,95" fill="none" stroke="#8faece" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="142" cy="98" r="4" fill="#8faece" />

        {/* Libro 1 */}
        <path d="M28,92 L122,92 C126,92 129,95 129,99 L129,112 C129,116 126,119 122,119 L28,119 C24,119 21,116 21,112 L21,99 C21,95 24,92 28,92 Z" fill="#ffffff" stroke="#9bbde0" strokeWidth="2" />
        <line x1="32" y1="92" x2="32" y2="119" stroke="#9bbde0" strokeWidth="2" />

        {/* Libro 2 */}
        <path d="M22,121 L128,121 C132,121 135,124 135,128 L135,141 C135,145 132,148 128,148 L22,148 C18,148 15,145 15,141 L15,128 C15,124 18,121 22,121 Z" fill="#ffffff" stroke="#9bbde0" strokeWidth="2" />
        <line x1="26" y1="121" x2="26" y2="148" stroke="#9bbde0" strokeWidth="2" />

        {/* Libro 3 base */}
        <path d="M16,150 L134,150 C138,150 141,153 141,157 L141,168 L9,168 L9,157 C9,153 12,150 16,150 Z" fill="#ffffff" stroke="#9bbde0" strokeWidth="2" />
        <line x1="20" y1="150" x2="20" y2="168" stroke="#9bbde0" strokeWidth="2" />
      </svg>

      {/* Ondas decorativas translúcidas de fondo derecho (se atenúan en modo oscuro vía CSS) */}
      <svg
        className="sp-banner-wave"
        viewBox="0 0 300 120"
        style={{
          position: 'absolute',
          right: -20,
          top: -10,
          width: 260,
          height: 140,
          pointerEvents: 'none',
        }}
      >
        <path d="M0,40 Q80,10 160,50 T320,30 L320,120 L0,120 Z" fill="url(#waveGrad)" />
        <defs>
          <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#b4d5f8" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>

      {/* Textos alineados dejando espacio a la ilustración izquierda */}
      <div className="sp-banner-text" style={{ position: 'relative', zIndex: 2, paddingLeft: 105 }}>
        <h1
          style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 800,
            color: 'var(--banner-title)',
            letterSpacing: '-0.02em',
            fontFamily: 'inherit',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: '5px 0 0 0',
            fontSize: '0.88rem',
            color: 'var(--banner-sub)',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
