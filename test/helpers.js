import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

export const testConfig = (env = {}) => loadConfig({ PUBLIC_BASE_URL: 'http://test.local', ...env });

// Fake of the gateway in src/paypal.js. Records calls so tests can assert
// exactly when (and whether) money-moving calls happen.
export function fakePayPal({ approvedValue, orderStatus = 'APPROVED', captureStatus = 'COMPLETED' } = {}) {
  const calls = [];
  let created = null;
  return {
    calls,
    async createOrder(quote, urls) {
      calls.push(['createOrder', quote.totalCents, urls]);
      created = { orderId: 'ORDER1234567890ABCDE', value: (quote.totalCents / 100).toFixed(2) };
      return { orderId: created.orderId, approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER1234567890ABCDE', status: 'PAYER_ACTION_REQUIRED' };
    },
    async getOrder(id) {
      calls.push(['getOrder', id]);
      return { orderId: id, status: orderStatus, currency: 'USD', value: approvedValue ?? created.value };
    },
    async captureOrder(id) {
      calls.push(['captureOrder', id]);
      return { status: captureStatus, captureId: 'CAP123', captureStatus: 'COMPLETED', value: created.value };
    },
  };
}

export const fixedAgent = (intent) => ({ kind: 'fake', model: null, async interpret() { return intent; } });

export async function startApp(opts) {
  const app = createApp({ config: testConfig(), ...opts });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body) => {
    const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  const get = async (path) => {
    const res = await fetch(base + path, { redirect: 'manual' });
    const type = res.headers.get('content-type') || '';
    return { status: res.status, location: res.headers.get('location'), body: type.includes('json') ? await res.json() : await res.text() };
  };
  return { base, post, get, close: () => new Promise((r) => server.close(r)) };
}
