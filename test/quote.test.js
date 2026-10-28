import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuote, cleanPurpose, presentQuote } from '../src/quote.js';
import { testConfig } from './helpers.js';

const topup = (amount_usd, purpose = 'Trip budget') => ({ action: 'topup', amount_usd, purpose, reply: 'ok' });

test('prices a valid top-up in dollars with no fee by default', () => {
  const r = buildQuote(topup(25), testConfig(), 0);
  assert.equal(r.ok, true);
  const view = presentQuote(r.quote);
  assert.equal(view.amount, '$25.00');
  assert.equal(view.fee, '$0.00');
  assert.equal(view.total, '$25.00');
  assert.deepEqual(view.lines, [
    { label: 'Top-up: Trip budget', amount: '$25.00' },
    { label: 'Service fee', amount: '$0.00' },
  ]);
  assert.equal(r.quote.status, 'drafted');
});

test('adds a configured service fee to the total', () => {
  const r = buildQuote(topup(25), testConfig({ TOPUP_SERVICE_FEE_FLAT_USD: '0.30', TOPUP_SERVICE_FEE_PERCENT: '2' }), 0);
  assert.equal(r.quote.feeCents, 80);
  assert.equal(presentQuote(r.quote).total, '$25.80');
});

test('enforces limits regardless of what the AI returned', () => {
  assert.equal(buildQuote(topup(0.5), testConfig(), 0).kind, 'limit');
  assert.equal(buildQuote(topup(10000), testConfig(), 0).kind, 'limit');
  assert.equal(buildQuote(topup(-5), testConfig(), 0).kind, 'clarify');
  assert.equal(buildQuote(topup(null), testConfig(), 0).kind, 'clarify');
  assert.equal(buildQuote(topup(10.123), testConfig(), 0).kind, 'clarify');
});

test('passes clarify and decline through without a quote', () => {
  const r = buildQuote({ action: 'clarify', amount_usd: null, purpose: null, reply: 'How much?' }, testConfig(), 0);
  assert.deepEqual(r, { ok: false, kind: 'clarify', reply: 'How much?' });
});

test('cleans purpose labels', () => {
  assert.equal(cleanPurpose('  <b>Trip</b>\n budget '), 'bTrip/b budget');
  assert.equal(cleanPurpose('x'.repeat(100)).length, 60);
  assert.equal(cleanPurpose('   '), null);
  assert.equal(cleanPurpose(42), null);
});
