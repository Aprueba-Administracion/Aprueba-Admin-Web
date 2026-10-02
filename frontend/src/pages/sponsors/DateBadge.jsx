export function checkExpired(dateStr) {
  if (!dateStr) return false;
  const expDate = new Date(`${dateStr}T23:59:59`);
  return expDate < new Date();
}

export function DateBadge({ dateStr, isEn }) {
  if (!dateStr) {
    return (
      <span className="date-badge-layout-1"
        
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
      <span className="date-badge-layout-2"
        
      >
        ⚠️ {isEn ? 'Expired' : 'Expiró'} ({formatted})
      </span>
    );
  }

  if (isSoon) {
    return (
      <span className="date-badge-layout-3"
        
      >
        ⏳ {formatted}
      </span>
    );
  }

  return (
    <span className="date-badge-layout-4"
      
    >
      📅 {formatted}
    </span>
  );
}
