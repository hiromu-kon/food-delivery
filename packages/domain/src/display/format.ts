const yenNumberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatYen(amount: number) {
  return `¥${yenNumberFormat.format(amount)}`;
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
