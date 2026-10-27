import { dollarsToCents } from './money.js';

// Loads settings from the environment. This app only ever talks to the PayPal
// sandbox: there is no setting that points it at live PayPal.
export function loadConfig(env = process.env) {
  const paypalEnv = (env.PAYPAL_ENVIRONMENT || 'sandbox').trim().toLowerCase();
  if (paypalEnv !== 'sandbox') {
    throw new Error(
      `PAYPAL_ENVIRONMENT is "${env.PAYPAL_ENVIRONMENT}". This app is sandbox-only; set it to "sandbox" or remove it.`,
    );
  }

  const minCents = dollarsToCents(env.TOPUP_MIN_USD ?? '1');
  const maxCents = dollarsToCents(env.TOPUP_MAX_USD ?? '500');
  const feeFlatCents = dollarsToCents(env.TOPUP_SERVICE_FEE_FLAT_USD ?? '0');
  const feePercent = Number(env.TOPUP_SERVICE_FEE_PERCENT ?? '0');
  if (minCents === null || maxCents === null || minCents < 1 || maxCents < minCents) {
    throw new Error('TOPUP_MIN_USD / TOPUP_MAX_USD must be dollar amounts with min <= max.');
  }
  if (feeFlatCents === null || feeFlatCents < 0 || !Number.isFinite(feePercent) || feePercent < 0 || feePercent > 20) {
    throw new Error('TOPUP_SERVICE_FEE_FLAT_USD must be >= 0 and TOPUP_SERVICE_FEE_PERCENT between 0 and 20.');
  }

  return {
    port: Number(env.PORT || 3000),
    publicBaseUrl: (env.PUBLIC_BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
    paypal: {
      clientId: env.PAYPAL_CLIENT_ID || '',
      clientSecret: env.PAYPAL_CLIENT_SECRET || '',
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY || '',
      model: env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    },
    limits: { minCents, maxCents },
    fee: { flatCents: feeFlatCents, percent: feePercent },
    quoteTtlMs: 15 * 60 * 1000,
  };
}
