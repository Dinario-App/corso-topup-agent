// Checks your PayPal sandbox credentials by creating a $1.00 sandbox order and
// reading it back. It never captures, so nothing is paid even in the sandbox.
import { loadConfig } from '../src/config.js';
import { createPayPalGateway, createToolkitTools } from '../src/paypal.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

const config = loadConfig();
if (!config.paypal.clientId || !config.paypal.clientSecret) {
  console.error('Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (sandbox) in .env first.');
  process.exit(1);
}
const paypal = createPayPalGateway(createToolkitTools(config.paypal));
const quote = { lines: [{ label: 'Sandbox credential check', cents: 100 }] };
const order = await paypal.createOrder(quote, {
  returnUrl: `${config.publicBaseUrl}/paypal/return`,
  cancelUrl: `${config.publicBaseUrl}/paypal/cancel`,
});
const check = await paypal.getOrder(order.orderId);
console.log(`OK: sandbox order ${check.orderId} is ${check.status} for ${check.currency} ${check.value}.`);
console.log(`Approval link (sandbox): ${order.approveUrl}`);
