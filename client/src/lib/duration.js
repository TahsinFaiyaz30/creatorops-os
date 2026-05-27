export const formatDuration = secondsValue => {
  const seconds = Math.max(0, Math.floor(Number(secondsValue) || 0));
  if (seconds === 0) return '0 seconds';

  const units = [
    ['year', 365 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1]
  ];
  const parts = [];
  let remaining = seconds;

  for (const [label, size] of units) {
    const value = Math.floor(remaining / size);
    if (value === 0) continue;

    parts.push(`${value} ${label}${value === 1 ? '' : 's'}`);
    remaining -= value * size;
    if (parts.length === 2) break;
  }

  return parts.join(' ');
};
