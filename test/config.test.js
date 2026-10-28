import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('defaults to sandbox with $1-$500 limits and no fee', () => {
  const c = loadConfig({});
  assert.deepEqual(c.limits, { minCents: 100, maxCents: 50000 });
  assert.deepEqual(c.fee, { flatCents: 0, percent: 0 });
  assert.equal(c.anthropic.model, 'claude-opus-5-5');
});

test('refuses any PayPal environment other than sandbox', () => {
  assert.throws(() => loadConfig({ PAYPAL_ENVIRONMENT: 'live' }), /sandbox-only/);
  assert.throws(() => loadConfig({ PAYPAL_ENVIRONMENT: 'production' }), /sandbox-only/);
  assert.doesNotThrow(() => loadConfig({ PAYPAL_ENVIRONMENT: 'Sandbox' }));
});

test('rejects bad limits and fees', () => {
  assert.throws(() => loadConfig({ TOPUP_MIN_USD: '50', TOPUP_MAX_USD: '10' }));
  assert.throws(() => loadConfig({ TOPUP_SERVICE_FEE_PERCENT: '-1' }));
  assert.throws(() => loadConfig({ TOPUP_SERVICE_FEE_FLAT_USD: 'x' }));
});
