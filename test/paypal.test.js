import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayPalGateway, createToolkitTools, PayPalError } from '../src/paypal.js';
import { buildQuote } from '../src/quote.js';
import { testConfig } from './helpers.js';

function fakeTools(results) {
  const calls = [];
  const tool = (name) => ({ async execute(args) { calls.push([name, args]); return JSON.stringify(results[name]); } });
  return { calls, tools: { create_order: tool('create_order'), get_order: tool('get_order'), pay_order: tool('pay_order') } };
}

test('toolkit is pinned to the PayPal sandbox and exposes the order tools', () => {
  const tools = createToolkitTools({ clientId: 'placeholder', clientSecret: 'placeholder' });
  assert.equal(typeof tools.create_order.execute, 'function');
  assert.equal(typeof tools.pay_order.execute, 'function');
});

test('createOrder sends the quoted line items and returns the approval link', async () => {
  const { calls, tools } = fakeTools({
    create_order: { id: 'ORDER1', status: 'PAYER_ACTION_REQUIRED', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER1' }] },
  });
  const { quote } = buildQuote({ action: 'topup', amount_usd: 25, purpose: 'Trip budget', reply: '' }, testConfig({ TOPUP_SERVICE_FEE_FLAT_USD: '0.50' }), 0);
  const order = await createPayPalGateway(tools).createOrder(quote, { returnUrl: 'r', cancelUrl: 'c' });
  assert.deepEqual(order, { orderId: 'ORDER1', approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER1', status: 'PAYER_ACTION_REQUIRED' });
  assert.deepEqual(calls[0], ['create_order', {
    currencyCode: 'USD',
    items: [
      { name: 'Top-up: Trip budget', quantity: 1, itemCost: 25, itemTotal: 25 },
      { name: 'Service fee', quantity: 1, itemCost: 0.5, itemTotal: 0.5 },
    ],
    returnUrl: 'r',
    cancelUrl: 'c',
  }]);
});

test('zero fee lines are not sent to PayPal', async () => {
  const { calls, tools } = fakeTools({ create_order: { id: 'O', links: [{ rel: 'approve', href: 'h' }] } });
  const { quote } = buildQuote({ action: 'topup', amount_usd: 10, purpose: null, reply: '' }, testConfig(), 0);
  await createPayPalGateway(tools).createOrder(quote, { returnUrl: 'r', cancelUrl: 'c' });
  assert.deepEqual(calls[0][1].items, [{ name: 'Top-up', quantity: 1, itemCost: 10, itemTotal: 10 }]);
});

test('getOrder and captureOrder read the PayPal responses', async () => {
  const { tools } = fakeTools({
    get_order: { id: 'O', status: 'APPROVED', purchase_units: [{ amount: { currency_code: 'USD', value: '25.00' } }] },
    pay_order: { status: 'success', response: { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP', status: 'COMPLETED', amount: { value: '25.00' } }] } }] } },
  });
  const gw = createPayPalGateway(tools);
  assert.deepEqual(await gw.getOrder('O'), { orderId: 'O', status: 'APPROVED', currency: 'USD', value: '25.00', payerEmail: null });
  assert.deepEqual(await gw.captureOrder('O'), { status: 'COMPLETED', captureId: 'CAP', captureStatus: 'COMPLETED', value: '25.00' });
});

test('toolkit errors become PayPalError', async () => {
  const { tools } = fakeTools({ create_order: { error: { message: 'Client Authentication failed', type: 'paypal_error' } } });
  const { quote } = buildQuote({ action: 'topup', amount_usd: 10, purpose: null, reply: '' }, testConfig(), 0);
  await assert.rejects(createPayPalGateway(tools).createOrder(quote, {}), PayPalError);
});
