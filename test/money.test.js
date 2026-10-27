import test from 'node:test';
import assert from 'node:assert/strict';
import { dollarsToCents, formatUSD, serviceFeeCents, centsToDollars } from '../src/money.js';

test('dollarsToCents parses numbers and dollar strings', () => {
  assert.equal(dollarsToCents(25), 2500);
  assert.equal(dollarsToCents('12.5'), 1250);
  assert.equal(dollarsToCents('$1,234.56'), 123456);
  assert.equal(dollarsToCents('10.005'), null);
  assert.equal(dollarsToCents('abc'), null);
});

test('formatUSD and centsToDollars', () => {
  assert.equal(formatUSD(2500), '$25.00');
  assert.equal(formatUSD(123456), '$1,234.56');
  assert.equal(formatUSD(5), '$0.05');
  assert.equal(centsToDollars(1250), 12.5);
});

test('serviceFeeCents combines flat and percent fees', () => {
  assert.equal(serviceFeeCents(2500), 0);
  assert.equal(serviceFeeCents(2500, { flatCents: 30, percent: 0 }), 30);
  assert.equal(serviceFeeCents(2500, { flatCents: 30, percent: 2.9 }), 30 + 73);
});
