export function TierBadge({ tier }) {
  const styles = {
    Gold: {
      background: 'rgba(234, 179, 8, 0.15)',
      color: '#d97706',
      border: '1px solid rgba(234, 179, 8, 0.35)',
    },
    Silver: {
      background: 'rgba(148, 163, 184, 0.15)',
      color: '#64748b',
      border: '1px solid rgba(148, 163, 184, 0.35)',
    },
    Bronze: {
      background: 'rgba(180, 83, 9, 0.15)',
      color: '#b45309',
      border: '1px solid rgba(180, 83, 9, 0.35)',
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
