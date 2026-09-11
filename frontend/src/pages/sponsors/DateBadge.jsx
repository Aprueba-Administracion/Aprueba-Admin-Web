export function checkExpired(dateStr) {
  if (!dateStr) return false;
  const expDate = new Date(`${dateStr}T23:59:59`);
  return expDate < new Date();
}

export function DateBadge({ dateStr, isEn }) {
  if (!dateStr) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: '0.78rem',
          background: 'rgba(148, 163, 184, 0.12)',
          color: '#64748b',
          fontWeight: 500,
        }}
      >
        ♾️ {isEn ? 'No limit' : 'Sin límite'}
      </span>
    );
  }

  const [y, m, d] = dateStr.split('-');
  const formatted = `${d}/${m}/${y}`;
  const isExp = checkExpired(dateStr);

  const expDate = new Date(`${dateStr}T23:59:59`);
  const diffDays = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
  const isSoon = !isExp && diffDays <= 3;

  if (isExp) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: '0.78rem',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          fontWeight: 600,
        }}
      >
        ⚠️ {isEn ? 'Expired' : 'Expiró'} ({formatted})
      </span>
    );
  }

  if (isSoon) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: '0.78rem',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#d97706',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          fontWeight: 500,
        }}
      >
        ⏳ {formatted}
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: '0.78rem',
        background: 'rgba(59, 130, 246, 0.1)',
        color: '#2563eb',
        fontWeight: 500,
      }}
    >
      📅 {formatted}
    </span>
  );
}
