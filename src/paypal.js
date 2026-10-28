import { PayPalAgentToolkit } from '@paypal/agent-toolkit/ai-sdk';
import { centsToDollars } from './money.js';

// Thin wrapper over the PayPal Agent Toolkit's order tools, always in sandbox
// mode. Only server code calls these, and only after the person has approved;
// the language model is never handed them.

export class PayPalError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

export function createToolkitTools({ clientId, clientSecret }) {
  const toolkit = new PayPalAgentToolkit({
    clientId,
    clientSecret,
    configuration: {
      actions: { orders: { create: true, get: true, capture: true } },
      context: { sandbox: true },
    },
  });
  // Belt and braces: refuse to run if the toolkit is not pointed at the sandbox.
  if (!/sandbox\.paypal\.com/.test(toolkit.client.getBaseUrl())) {
    throw new Error(`PayPal toolkit is not in sandbox mode (${toolkit.client.getBaseUrl()}).`);
  }
  const tools = toolkit.getTools();
  for (const name of ['create_order', 'get_order', 'pay_order']) {
    if (!tools[name]) throw new Error(`PayPal Agent Toolkit is missing the ${name} tool.`);
  }
  return tools;
}

// The capture itself, not the order: an order can be COMPLETED while its
// capture is PENDING or DECLINED, and the order amount is not what was captured.
function readCapture(order) {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    captureId: capture?.id ?? null,
    captureStatus: capture?.status ?? null,
    currency: capture?.amount?.currency_code ?? null,
    value: capture?.amount?.value ?? null,
  };
}

// `tools` maps tool name -> { execute(args) => Promise<string> }, as returned by
// the toolkit. Tests pass a fake with the same shape.
export function createPayPalGateway(tools) {
  async function call(name, args) {
    const raw = await tools[name].execute(args, {});
    let result;
    try {
      result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      throw new PayPalError(`PayPal ${name} returned an unreadable response.`);
    }
    if (!result || result.error || (typeof result.code === 'string' && result.code.startsWith('PAYPAL')) || result.status === 'error') {
      const msg = result?.error?.message || result?.message || 'PayPal request failed.';
      throw new PayPalError(`PayPal ${name} failed: ${msg}`, result);
    }
    return result;
  }

  return {
    async createOrder(quote, { returnUrl, cancelUrl }) {
      const items = quote.lines
        .filter((l) => l.cents > 0)
        .map((l) => ({ name: l.label.slice(0, 127), quantity: 1, itemCost: centsToDollars(l.cents), itemTotal: centsToDollars(l.cents) }));
      const order = await call('create_order', { currencyCode: 'USD', items, returnUrl, cancelUrl });
      const approveLink = order.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
      if (!order.id || !approveLink) throw new PayPalError('PayPal did not return an approval link.', order);
      return { orderId: order.id, approveUrl: approveLink.href, status: order.status };
    },

    async getOrder(orderId) {
      const order = await call('get_order', { id: orderId });
      const unit = order.purchase_units?.[0];
      return {
        orderId: order.id,
        status: order.status,
        currency: unit?.amount?.currency_code,
        value: unit?.amount?.value,
        payerEmail: order.payer?.email_address ?? null,
        capture: readCapture(order),
      };
    },

    async captureOrder(orderId) {
      const result = await call('pay_order', { id: orderId });
      const order = result.response ?? result;
      return { status: order.status, ...readCapture(order) };
    },
  };
}
