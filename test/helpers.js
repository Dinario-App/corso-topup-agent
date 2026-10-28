import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

export const testConfig = (env = {}) => loadConfig({ PUBLIC_BASE_URL: 'http://test.local', ...env });

// Fake of the gateway in src/paypal.js. Records calls so tests can assert
// exactly when (and whether) money-moving calls happen.
// Options default to the happy path; override one to simulate a PayPal answer.
// `captureError` makes captureOrder throw; `afterError` is the capture that a
// follow-up getOrder then reports (null: PayPal shows no capture), and
// `reconcileError` makes that follow-up getOrder throw too. `beforeGetOrder(n)`
// is awaited at the start of the n-th getOrder call (0-based), so a test can
// hold a lookup open with a deferred() and control the interleaving exactly.
export function fakePayPal({
  approvedValue,
  approvedCurrency = 'USD',
  orderStatus = 'APPROVED',
  captureStatus = 'COMPLETED',
  captureValue,
  captureCurrency = 'USD',
  captureError = null,
  afterError = null,
  reconcileError = null,
  captureDelayMs = 0,
  beforeGetOrder = null,
} = {}) {
  const calls = [];
  let created = null;
  let captured = null;
  let captureFailed = false;
  let getOrderCount = 0;
  return {
    calls,
    async createOrder(quote, urls) {
      calls.push(['createOrder', quote.totalCents, urls]);
      created = { orderId: 'ORDER1234567890ABCDE', value: (quote.totalCents / 100).toFixed(2) };
      return { orderId: created.orderId, approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER1234567890ABCDE', status: 'PAYER_ACTION_REQUIRED' };
    },
    async getOrder(id) {
      calls.push(['getOrder', id]);
      const n = getOrderCount++;
      if (beforeGetOrder) await beforeGetOrder(n);
      if (captureFailed && reconcileError) throw reconcileError;
      return {
        orderId: id,
        status: captured ? 'COMPLETED' : orderStatus,
        currency: approvedCurrency,
        value: approvedValue ?? created.value,
        capture: captured ?? { captureId: null, captureStatus: null, currency: null, value: null },
      };
    },
    async captureOrder(id) {
      calls.push(['captureOrder', id]);
      if (captureDelayMs) await new Promise((r) => setTimeout(r, captureDelayMs));
      if (captureError) {
        captured = afterError;
        captureFailed = true;
        throw captureError;
      }
      return { status: 'COMPLETED', captureId: 'CAP123', captureStatus, currency: captureCurrency, value: captureValue ?? created.value };
    },
  };
}

// A promise plus its resolve/reject, for holding a fake call open.
export function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
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
