// Usa las variables --gold/--silver/--bronze del manual de marca (definidas
// en styles.css) en vez de colores sueltos, para que el badge de nivel quede
// exactamente en la misma paleta que el resto de la consola.
export function TierBadge({ tier }) {
  const styles = {
    Gold: {
      background: 'var(--gold-bg)',
      color: 'var(--gold-ink)',
      border: '1px solid var(--gold-line)',
    },
    Silver: {
      background: 'var(--silver-bg)',
      color: 'var(--silver-ink)',
      border: '1px solid var(--silver-line)',
    },
    Bronze: {
      background: 'var(--bronze-bg)',
      color: 'var(--bronze-ink)',
      border: '1px solid var(--bronze-line)',
    },
  };

  const current = styles[tier] || styles.Bronze;

  return (
    <span
      className="tag"
      style={{
        ...current,
        fontWeight: 600,
        fontSize: '0.75rem',
        padding: '2px 8px',
        borderRadius: 9999,
      }}
    >
      {tier}
    </span>
  );
}
