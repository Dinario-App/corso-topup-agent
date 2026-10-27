import test from 'node:test';
import assert from 'node:assert/strict';
import { fakePayPal, fixedAgent, startApp } from './helpers.js';

const TOPUP = { action: 'topup', amount_usd: 25, purpose: 'Trip budget', reply: "Here's your top-up." };

test('full flow: draft, approve, PayPal approval, pay', async (t) => {
  const paypal = fakePayPal();
  const app = await startApp({ agent: fixedAgent(TOPUP), paypal });
  t.after(app.close);

  const q = await app.post('/api/quote', { message: 'top up $25 for my trip budget' });
  assert.equal(q.status, 200);
  assert.equal(q.body.quote.total, '$25.00');
  assert.equal(q.body.quote.status, 'drafted');
  assert.equal(paypal.calls.length, 0, 'drafting never touches PayPal');
  const id = q.body.quote.id;

  const checkout = await app.post(`/api/quotes/${id}/checkout`, { confirm: true, total: '$25.00' });
  assert.equal(checkout.status, 200);
  assert.match(checkout.body.approveUrl, /^https:\/\/www\.sandbox\.paypal\.com\//);
  assert.deepEqual(paypal.calls[0], ['createOrder', 2500, {
    returnUrl: `http://test.local/paypal/return?quote=${id}`,
    cancelUrl: `http://test.local/paypal/cancel?quote=${id}`,
  }]);

  // Paying before PayPal approval is refused.
  const early = await app.post(`/api/quotes/${id}/pay`, { confirm: true });
  assert.equal(early.status, 409);

  const ret = await app.get(`/paypal/return?quote=${id}&token=ORDER1234567890ABCDE&PayerID=X`);
  assert.equal(ret.status, 303);
  assert.equal(ret.location, `/?quote=${id}`);
  assert.equal((await app.get(`/api/quotes/${id}`)).body.quote.status, 'payer_approved');
  assert.ok(!paypal.calls.some(([name]) => name === 'captureOrder'), 'returning from PayPal does not capture');

  const unconfirmed = await app.post(`/api/quotes/${id}/pay`, {});
  assert.equal(unconfirmed.status, 400);

  const paid = await app.post(`/api/quotes/${id}/pay`, { confirm: true });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.quote.status, 'completed');
  assert.equal(paid.body.quote.captureId, 'CAP123');

  const again = await app.post(`/api/quotes/${id}/pay`, { confirm: true });
  assert.equal(again.status, 409, 'cannot pay twice');
  assert.equal(paypal.calls.filter(([name]) => name === 'captureOrder').length, 1);
});

test('checkout needs explicit confirmation of the displayed total', async (t) => {
  const paypal = fakePayPal();
  const app = await startApp({ agent: fixedAgent(TOPUP), paypal });
  t.after(app.close);
  const { body } = await app.post('/api/quote', { message: 'x' });
  assert.equal((await app.post(`/api/quotes/${body.quote.id}/checkout`, { total: '$25.00' })).status, 400);
  assert.equal((await app.post(`/api/quotes/${body.quote.id}/checkout`, { confirm: true, total: '$20.00' })).status, 409);
  assert.equal(paypal.calls.length, 0);
});

test('an amount mismatch from PayPal blocks payment', async (t) => {
  const paypal = fakePayPal({ approvedValue: '250.00' });
  const app = await startApp({ agent: fixedAgent(TOPUP), paypal });
  t.after(app.close);
  const { body } = await app.post('/api/quote', { message: 'x' });
  const id = body.quote.id;
  await app.post(`/api/quotes/${id}/checkout`, { confirm: true, total: '$25.00' });
  await app.get(`/paypal/return?quote=${id}&token=ORDER1234567890ABCDE`);
  const q = (await app.get(`/api/quotes/${id}`)).body.quote;
  assert.equal(q.status, 'failed');
  assert.match(q.error, /Nothing was charged/);
  assert.equal((await app.post(`/api/quotes/${id}/pay`, { confirm: true })).status, 409);
});

test('a return with the wrong order token is rejected', async (t) => {
  const paypal = fakePayPal();
  const app = await startApp({ agent: fixedAgent(TOPUP), paypal });
  t.after(app.close);
  const { body } = await app.post('/api/quote', { message: 'x' });
  const id = body.quote.id;
  await app.post(`/api/quotes/${id}/checkout`, { confirm: true, total: '$25.00' });
  await app.get(`/paypal/return?quote=${id}&token=SOMEOTHERORDER123456`);
  assert.equal((await app.get(`/api/quotes/${id}`)).body.quote.status, 'failed');
});

test('cancel in PayPal leaves nothing to pay', async (t) => {
  const paypal = fakePayPal();
  const app = await startApp({ agent: fixedAgent(TOPUP), paypal });
  t.after(app.close);
  const { body } = await app.post('/api/quote', { message: 'x' });
  const id = body.quote.id;
  await app.post(`/api/quotes/${id}/checkout`, { confirm: true, total: '$25.00' });
  assert.equal((await app.get(`/paypal/cancel?quote=${id}&token=ORDER1234567890ABCDE`)).status, 303);
  assert.equal((await app.get(`/api/quotes/${id}`)).body.quote.status, 'cancelled');
  assert.equal((await app.post(`/api/quotes/${id}/pay`, { confirm: true })).status, 409);
});

test('clarify, decline and over-limit replies create no quote', async (t) => {
  for (const [intent, kind] of [
    [{ action: 'clarify', amount_usd: null, purpose: null, reply: 'How much?' }, 'clarify'],
    [{ action: 'decline', amount_usd: null, purpose: null, reply: 'I only do top-ups.' }, 'decline'],
    [{ ...TOPUP, amount_usd: 5000 }, 'limit'],
  ]) {
    const app = await startApp({ agent: fixedAgent(intent), paypal: fakePayPal() });
    const r = await app.post('/api/quote', { message: 'x' });
    await app.close();
    assert.equal(r.status, 200);
    assert.equal(r.body.kind, kind);
    assert.equal(r.body.quote, null);
  }
});

test('input validation and missing PayPal config', async (t) => {
  const app = await startApp({ agent: fixedAgent(TOPUP), paypal: null });
  t.after(app.close);
  assert.equal((await app.post('/api/quote', { message: '' })).status, 400);
  assert.equal((await app.post('/api/quote', { message: 'x'.repeat(501) })).status, 400);
  const { body } = await app.post('/api/quote', { message: 'x' });
  assert.equal((await app.post(`/api/quotes/${body.quote.id}/checkout`, { confirm: true, total: '$25.00' })).status, 503);
  assert.equal((await app.get('/api/quotes/nope')).status, 404);
  const status = (await app.get('/api/status')).body;
  assert.equal(status.sandbox, true);
  assert.equal(status.paypalConfigured, false);
});

test('expired quotes cannot be checked out', async (t) => {
  let clock = 0;
  const paypal = fakePayPal();
  const app = await startApp({ agent: fixedAgent(TOPUP), paypal, now: () => clock });
  t.after(app.close);
  const { body } = await app.post('/api/quote', { message: 'x' });
  clock = 16 * 60 * 1000;
  assert.equal((await app.post(`/api/quotes/${body.quote.id}/checkout`, { confirm: true, total: '$25.00' })).status, 410);
  assert.equal(paypal.calls.length, 0);
});

test('serves the web page', async (t) => {
  const app = await startApp({ agent: fixedAgent(TOPUP), paypal: null });
  t.after(app.close);
  const page = await app.get('/');
  assert.equal(page.status, 200);
  assert.match(page.body, /Sandbox demo/);
});
