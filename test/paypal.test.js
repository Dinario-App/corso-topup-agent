import test from 'node:test';
import { PayPalAgentToolkit } from '@paypal/agent-toolkit/ai-sdk';
import { createRequire } from 'node:module';

import assert from 'node:assert/strict';
import { createPayPalGateway, createToolkitTools, PayPalError } from '../src/paypal.js';
import { buildQuote } from '../src/quote.js';
import { testConfig } from './helpers.js';

// The toolkit uses the CommonJS Axios entry point.
const axios = createRequire(import.meta.url)('axios');

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
    pay_order: { status: 'success', response: { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP', status: 'COMPLETED', amount: { currency_code: 'USD', value: '25.00' } }] } }] } },
  });
  const gw = createPayPalGateway(tools);
  assert.deepEqual(await gw.getOrder('O'), {
    orderId: 'O', status: 'APPROVED', currency: 'USD', value: '25.00', payerEmail: null,
    capture: { captureId: null, captureStatus: null, currency: null, value: null },
  });
  assert.deepEqual(await gw.captureOrder('O'), { status: 'COMPLETED', captureId: 'CAP', captureStatus: 'COMPLETED', currency: 'USD', value: '25.00' });
});

test('captureOrder reports the captured amount, not the order amount', async () => {
  const { tools } = fakeTools({
    pay_order: {
      status: 'success',
      response: {
        status: 'COMPLETED',
        purchase_units: [{
          amount: { currency_code: 'USD', value: '25.00' },
          payments: { captures: [{ id: 'CAP', status: 'PENDING', amount: { currency_code: 'USD', value: '20.00' } }] },
        }],
      },
    },
  });
  assert.deepEqual(await createPayPalGateway(tools).captureOrder('O'), {
    status: 'COMPLETED', captureId: 'CAP', captureStatus: 'PENDING', currency: 'USD', value: '20.00',
  });
});

test('toolkit errors become PayPalError', async () => {
  const { tools } = fakeTools({ create_order: { error: { message: 'Client Authentication failed', type: 'paypal_error' } } });
  const { quote } = buildQuote({ action: 'topup', amount_usd: 10, purpose: null, reply: '' }, testConfig(), 0);
  await assert.rejects(createPayPalGateway(tools).createOrder(quote, {}), PayPalError);
});

test('getOrder reads a captured order through the real gateway', async () => {
  const { tools } = fakeTools({
    get_order: {
      id: 'O',
      status: 'COMPLETED',
      purchase_units: [{
        amount: { currency_code: 'USD', value: '25.00' },
        payments: { captures: [{ id: 'CAP', status: 'COMPLETED', amount: { currency_code: 'USD', value: '25.00' } }] },
      }],
    },
  });
  const order = await createPayPalGateway(tools).getOrder('O');
  assert.deepEqual(order.capture, { captureId: 'CAP', captureStatus: 'COMPLETED', currency: 'USD', value: '25.00' });
});

test('refuses a toolkit that points at live PayPal', () => {
  class LiveToolkit {
    client = { getBaseUrl: () => 'https://api-m.paypal.com' };
    getTools() { throw new Error('should not get this far'); }
  }
  assert.throws(() => createToolkitTools({ clientId: 'x', clientSecret: 'y' }, LiveToolkit), /not in sandbox mode/);
});

test('installed toolkit sandbox base URL matches the exact allowlist', () => {
  const toolkit = new PayPalAgentToolkit({
    clientId: 'placeholder', clientSecret: 'placeholder',
    configuration: { actions: { orders: { create: true, get: true, capture: true } }, context: { sandbox: true } },
  });
  assert.equal(toolkit.client.getBaseUrl(), 'https://api.sandbox.paypal.com');
});

for (const baseUrl of [
  'https://api-m.paypal.com/?x=sandbox.paypal.com',
  'https://sandbox.paypal.com.evil.tld',
  'not a URL',
  'https://api.sandbox.paypal.com.evil.tld',
  'https://api.sandbox.paypal.com@evil.tld',
]) {
  test(`refuses sandbox guard bypass: ${baseUrl}`, () => {
    let toolsRequested = false;
    class UnsafeToolkit {
      client = { getBaseUrl: () => baseUrl };
      getTools() { toolsRequested = true; return {}; }
    }
    assert.throws(() => createToolkitTools({ clientId: 'x', clientSecret: 'y' }, UnsafeToolkit), /not in sandbox mode/);
    assert.equal(toolsRequested, false);
  });
}

test('updated dependencies build an order through the real toolkit with mocked HTTP', async (t) => {
  const requests = [];
  const originalAdapter = axios.defaults.adapter;
  t.after(() => { axios.defaults.adapter = originalAdapter; });
  axios.defaults.adapter = async (config) => {
    requests.push(config);
    assert.equal(new URL(config.url).hostname, 'api.sandbox.paypal.com');
    const data = config.url.endsWith('/v1/oauth2/token')
      ? { access_token: 'test-only-token' }
      : { id: 'ORDER1', status: 'PAYER_ACTION_REQUIRED', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER1' }] };
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  const tools = createToolkitTools({ clientId: 'placeholder', clientSecret: 'placeholder' });
  const { quote } = buildQuote({ action: 'topup', amount_usd: 25, purpose: 'Trip budget', reply: '' }, testConfig({ TOPUP_SERVICE_FEE_FLAT_USD: '0.50' }), 0);
  const order = await createPayPalGateway(tools).createOrder(quote, { returnUrl: 'https://example.com/return', cancelUrl: 'https://example.com/cancel' });
  assert.equal(order.orderId, 'ORDER1');
  assert.equal(requests.length, 2);
  const request = requests[1];
  assert.equal(request.url, 'https://api.sandbox.paypal.com/v2/checkout/orders');
  const body = JSON.parse(request.data);
  assert.equal(body.purchase_units[0].amount.value, '25.5');
  assert.equal(body.purchase_units[0].amount.breakdown.item_total.value, '25.5');
});
