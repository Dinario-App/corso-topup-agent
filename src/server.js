import { createClaudeAgent, createRulesAgent } from './agent.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPayPalGateway, createToolkitTools } from './paypal.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

const config = loadConfig();

const agent = config.anthropic.apiKey
  ? createClaudeAgent({ apiKey: config.anthropic.apiKey, model: config.anthropic.model })
  : createRulesAgent();

const paypal =
  config.paypal.clientId && config.paypal.clientSecret
    ? createPayPalGateway(createToolkitTools(config.paypal))
    : null;

const app = createApp({ config, agent, paypal });

app.listen(config.port, () => {
  console.log(`Top-up agent on ${config.publicBaseUrl} (PayPal sandbox only)`);
  console.log(agent.kind === 'claude' ? `Agent: Claude (${agent.model})` : 'Agent: offline rules parser (set ANTHROPIC_API_KEY for the AI agent)');
  if (!paypal) console.log('PayPal: not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (sandbox app) to enable checkout.');
});
