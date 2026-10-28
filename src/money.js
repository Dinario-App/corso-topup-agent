// All money is handled as integer US cents. Floats only appear at the edges
// (parsing what the AI or a person typed, and the PayPal Agent Toolkit input).

export function dollarsToCents(value) {
  if (typeof value === 'string') value = value.replace(/[$,\s]/g, '');
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  // Reject amounts with more than two decimals, e.g. 10.005.
  if (Math.abs(cents - n * 100) > 1e-6) return null;
  return cents;
}

export function centsToDollars(cents) {
  return Number((cents / 100).toFixed(2));
}

export function formatUSD(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
}

// Service fee = flat + percent of amount, rounded half up to the cent.
export function serviceFeeCents(amountCents, { flatCents = 0, percent = 0 } = {}) {
  return flatCents + Math.round((amountCents * percent) / 100);
}
