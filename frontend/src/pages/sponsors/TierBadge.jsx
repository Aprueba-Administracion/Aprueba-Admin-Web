export function TierBadge({ tier }) {
  const tone = ['Gold', 'Silver', 'Bronze'].includes(tier) ? tier.toLowerCase() : 'bronze';
  return <span className={'tag sponsor-tier sponsor-tier-' + tone}>{tier}</span>;
}
