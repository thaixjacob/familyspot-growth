/** Number / percentage / duration formatting shared by dashboard + email. */

export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Percentage change from `previous` to `current`, as a signed number (e.g. 12.4 = +12.4%). */
export function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Human label for a delta: "+12%", "-4%", "new", or "—". */
export function fmtDelta(current: number, previous: number): string {
  if (previous === 0 && current > 0) return 'new';
  const d = pctDelta(current, previous);
  if (d === null) return '—';
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(0)}%`;
}

/** "up" | "down" | "flat" — used to colour deltas. */
export function deltaDirection(current: number, previous: number): 'up' | 'down' | 'flat' {
  if (current === previous) return 'flat';
  return current > previous ? 'up' : 'down';
}
