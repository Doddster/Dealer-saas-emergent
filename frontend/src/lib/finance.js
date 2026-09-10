// Presentation-only finance math. Estimates only — no lender is connected.
export const TERMS = [48, 60, 72, 84];

export function monthlyPayment(principal, aprPct, months) {
  const p = Math.max(0, Number(principal) || 0);
  const n = Math.max(1, Number(months) || 1);
  const r = (Number(aprPct) || 0) / 100 / 12;
  if (p === 0) return 0;
  if (r === 0) return p / n;
  const factor = Math.pow(1 + r, n);
  return (p * r * factor) / (factor - 1);
}

export function totalOfPayments(principal, aprPct, months) {
  return monthlyPayment(principal, aprPct, months) * Math.max(1, Number(months) || 1);
}
