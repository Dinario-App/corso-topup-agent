import express from 'express';
import { fileURLToPath } from 'node:url';
import { AgentError } from './agent.js';
import { dollarsToCents, formatUSD } from './money.js';
import { PayPalError } from './paypal.js';
import { buildQuote, presentQuote, QuoteStore } from './quote.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const MAX_MESSAGE_LENGTH = 500;
const CANCELLABLE = ['drafted', 'awaiting_payer', 'checking_approval', 'payer_approved'];

// Quote lifecycle. Money moves only on the last arrow, and only after two
// explicit approvals by the person: once in PayPal, once with "Pay now" here.
//
//   drafted --(person: Continue to PayPal)--> awaiting_payer
//   awaiting_payer --(person approves in PayPal)--> checking_approval --(amount re-checked)--> payer_approved
//   payer_approved --(person: Pay now)--> capturing --> completed
//   any open state --(cancel / mismatch / error before capture)--> cancelled | failed
//   capturing --(capture pending, amount off, or no answer from PayPal)--> needs_review

// Records what PayPal says about the capture itself. Only a COMPLETED capture
// of exactly the quoted USD total counts as paid.
function settleCapture(quote, capture) {
  quote.captureId = capture.captureId ?? null;
  const matches = capture.currency === 'USD' && dollarsToCents(capture.value) === quote.totalCents;
  if (capture.captureStatus === 'COMPLETED' && matches) {
    quote.status = 'completed';
    quote.error = null;
  } else if (capture.captureStatus === 'DECLINED') {
    quote.status = 'failed';
    quote.error = 'PayPal declined the payment. Nothing was paid.';
  } else if (capture.captureStatus === 'COMPLETED') {
    quote.status = 'needs_review';
    quote.error = `PayPal took ${capture.currency} ${capture.value}, but you approved ${formatUSD(quote.totalCents)}. Check the PayPal sandbox.`;
  } else {
    quote.status = 'needs_review';
    quote.error = `PayPal is holding this payment (${capture.captureStatus ?? 'unknown status'}). Check the PayPal sandbox before trying again.`;
  }
}

export function createApp({ config, agent, paypal, store = new QuoteStore(), now = () => Date.now() }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(PUBLIC_DIR));

  const loadQuote = (req, res) => {
    const quote = store.get(String(req.params.id ?? req.query.quote ?? ''));
    if (!quote) {
      res.status(404).json({ error: 'Top-up not found.' });
      return null;
    }
    return quote;
  };

  app.get('/api/status', (req, res) => {
    res.json({
      sandbox: true,
      agent: agent.kind,
      model: agent.model,
      paypalConfigured: Boolean(paypal),
      limits: { min: formatUSD(config.limits.minCents), max: formatUSD(config.limits.maxCents) },
    });
  });

  // Step 1: the agent drafts a quote from plain words. No PayPal call here.
  app.post('/api/quote', async (req, res, next) => {
    try {
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (!message) return res.status(400).json({ error: 'Tell me how much you want to add.' });
      if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Please keep it under ${MAX_MESSAGE_LENGTH} characters.` });
      }
      const intent = await agent.interpret(message);
      const result = buildQuote(intent, config, now());
      if (!result.ok) return res.json({ reply: result.reply, kind: result.kind, quote: null });
      store.save(result.quote);
      res.json({ reply: result.reply, kind: 'quote', quote: presentQuote(result.quote) });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/quotes/:id', (req, res) => {
    const quote = loadQuote(req, res);
    if (quote) res.json({ quote: presentQuote(quote) });
  });

  // Step 2: the person has seen the dollar costs and pressed "Continue to PayPal".
  app.post('/api/quotes/:id/checkout', async (req, res, next) => {
    const quote = loadQuote(req, res);
    if (!quote) return;
    try {
      if (req.body?.confirm !== true) return res.status(400).json({ error: 'Please confirm the amount first.' });
      if (req.body?.total !== formatUSD(quote.totalCents)) {
        return res.status(409).json({ error: 'The total changed. Please review it again.', quote: presentQuote(quote) });
      }
      if (quote.status === 'awaiting_payer' && quote.approveUrl) return res.json({ approveUrl: quote.approveUrl });
      if (quote.status !== 'drafted') return res.status(409).json({ error: `This top-up is already ${quote.status}.` });
      if (now() > quote.expiresAt) {
        quote.status = 'cancelled';
        quote.error = 'Expired before checkout. Nothing was paid.';
        return res.status(410).json({ error: 'This quote expired. Please ask again.' });
      }
      if (!paypal) return res.status(503).json({ error: 'PayPal sandbox credentials are not set up on this server.' });

      const base = config.publicBaseUrl;
      const q = encodeURIComponent(quote.id);
      quote.status = 'creating_order';
      const order = await paypal.createOrder(quote, {
        returnUrl: `${base}/paypal/return?quote=${q}`,
        cancelUrl: `${base}/paypal/cancel?quote=${q}`,
      });
      quote.orderId = order.orderId;
      quote.approveUrl = order.approveUrl;
      quote.status = 'awaiting_payer';
      res.json({ approveUrl: order.approveUrl });
    } catch (err) {
      if (quote.status === 'creating_order') {
        quote.status = 'failed';
        quote.error = 'Could not start the PayPal checkout. Nothing was paid.';
      }
      next(err);
    }
  });

  // PayPal sends the person back here after they approve. We re-check the
  // order with PayPal before offering the final "Pay now" step.
  app.get('/paypal/return', async (req, res, next) => {
    const quote = loadQuote(req, res);
    if (!quote) return;
    const back = `/?quote=${encodeURIComponent(quote.id)}`;
    try {
      if (quote.status !== 'awaiting_payer') return res.redirect(303, back);
      if (!quote.orderId || req.query.token !== quote.orderId) {
        quote.status = 'failed';
        quote.error = 'PayPal returned a different order than the one we created. Nothing was paid.';
        return res.redirect(303, back);
      }
      // Claim the quote before awaiting PayPal, so a second (e.g. double-clicked
      // or late) return can't apply a stale APPROVED answer to a quote that has
      // since been paid or cancelled.
      quote.status = 'checking_approval';
      let order;
      try {
        order = await paypal.getOrder(quote.orderId);
      } catch (err) {
        if (quote.status === 'checking_approval') quote.status = 'awaiting_payer';
        throw err;
      }
      if (quote.status !== 'checking_approval') return res.redirect(303, back);
      if (order.status !== 'APPROVED') {
        quote.status = 'failed';
        quote.error = `PayPal says the order is ${order.status}, not approved. Nothing was paid.`;
      } else if (order.currency !== 'USD' || dollarsToCents(order.value) !== quote.totalCents) {
        quote.status = 'failed';
        quote.error = `PayPal shows ${order.currency} ${order.value}, but you approved ${formatUSD(quote.totalCents)}. Nothing was charged.`;
      } else {
        quote.status = 'payer_approved';
      }
      res.redirect(303, back);
    } catch (err) {
      next(err);
    }
  });

  app.get('/paypal/cancel', (req, res) => {
    const quote = loadQuote(req, res);
    if (!quote) return;
    if (CANCELLABLE.includes(quote.status)) {
      quote.status = 'cancelled';
      quote.error = null;
    }
    res.redirect(303, `/?quote=${encodeURIComponent(quote.id)}`);
  });

  app.post('/api/quotes/:id/cancel', (req, res) => {
    const quote = loadQuote(req, res);
    if (!quote) return;
    if (CANCELLABLE.includes(quote.status)) quote.status = 'cancelled';
    res.json({ quote: presentQuote(quote) });
  });

  // Step 3: the final, explicit "Pay now". This is the only place money moves.
  app.post('/api/quotes/:id/pay', async (req, res, next) => {
    const quote = loadQuote(req, res);
    if (!quote) return;
    try {
      if (req.body?.confirm !== true) return res.status(400).json({ error: 'Please confirm the payment first.' });
      if (quote.status !== 'payer_approved') {
        return res.status(409).json({ error: `This top-up is ${quote.status}, so it can't be paid now.` });
      }
      quote.status = 'capturing';
      let capture;
      try {
        capture = await paypal.captureOrder(quote.orderId);
      } catch (err) {
        // The capture may have gone through even though we got no answer:
        // ask PayPal before telling the person anything.
        console.error(err.message);
        try {
          capture = (await paypal.getOrder(quote.orderId)).capture;
        } catch (reconcileErr) {
          console.error(reconcileErr.message);
        }
        if (!capture?.captureStatus) {
          quote.status = 'needs_review';
          quote.error = "We couldn't confirm this payment with PayPal. Check the PayPal sandbox before trying again.";
          return res.status(502).json({ error: quote.error, quote: presentQuote(quote) });
        }
      }
      settleCapture(quote, capture);
      if (quote.status !== 'completed') return res.status(502).json({ error: quote.error, quote: presentQuote(quote) });
      res.json({ quote: presentQuote(quote) });
    } catch (err) {
      next(err);
    }
  });

  app.use((err, req, res, _next) => {
    if (err instanceof AgentError) return res.status(502).json({ error: err.message });
    if (err instanceof PayPalError) {
      console.error(err.message);
      return res.status(502).json({ error: 'PayPal sandbox request failed. Please try again.' });
    }
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  });

  return app;
}
