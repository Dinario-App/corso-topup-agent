import { randomUUID } from 'node:crypto';
import { dollarsToCents, formatUSD, serviceFeeCents } from './money.js';

// Turns the agent's draft intent into a priced quote. This is the trust
// boundary: whatever the AI said, the amount, limits and fees are checked here.

export function cleanPurpose(purpose) {
  if (typeof purpose !== 'string') return null;
  const cleaned = purpose.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return cleaned || null;
}

export function buildQuote(intent, config, now = Date.now()) {
  if (intent.action === 'decline' || intent.action === 'clarify') {
    return { ok: false, kind: intent.action, reply: intent.reply };
  }
  const amountCents = dollarsToCents(intent.amount_usd);
  if (amountCents === null || amountCents <= 0) {
    return { ok: false, kind: 'clarify', reply: 'How much do you want to add, in US dollars?' };
  }
  const { minCents, maxCents } = config.limits;
  if (amountCents < minCents || amountCents > maxCents) {
    return {
      ok: false,
      kind: 'limit',
      reply: `Top-ups can be from ${formatUSD(minCents)} to ${formatUSD(maxCents)}. You asked for ${formatUSD(amountCents)}.`,
    };
  }

  const purpose = cleanPurpose(intent.purpose);
  const feeCents = serviceFeeCents(amountCents, config.fee);
  const lines = [
    { label: purpose ? `Top-up: ${purpose}` : 'Top-up', cents: amountCents },
    { label: 'Service fee', cents: feeCents },
  ];
  return {
    ok: true,
    reply: intent.reply,
    quote: {
      id: randomUUID(),
      status: 'drafted',
      purpose,
      currency: 'USD',
      amountCents,
      feeCents,
      totalCents: amountCents + feeCents,
      lines,
      createdAt: now,
      expiresAt: now + config.quoteTtlMs,
      orderId: null,
      captureId: null,
      error: null,
    },
  };
}

// What the browser sees: dollar strings, never raw internals.
export function presentQuote(quote) {
  return {
    id: quote.id,
    status: quote.status,
    purpose: quote.purpose,
    currency: quote.currency,
    lines: quote.lines.map((l) => ({ label: l.label, amount: formatUSD(l.cents) })),
    amount: formatUSD(quote.amountCents),
    fee: formatUSD(quote.feeCents),
    total: formatUSD(quote.totalCents),
    expiresAt: new Date(quote.expiresAt).toISOString(),
    orderId: quote.orderId,
    captureId: quote.captureId,
    error: quote.error,
  };
}

// Quotes live in memory. Fine for a sandbox demo; a real service needs a database.
export class QuoteStore {
  #quotes = new Map();

  save(quote) {
    this.#quotes.set(quote.id, quote);
    return quote;
  }

  get(id) {
    return this.#quotes.get(id) ?? null;
  }

  findByOrderId(orderId) {
    for (const q of this.#quotes.values()) if (q.orderId === orderId) return q;
    return null;
  }
}
