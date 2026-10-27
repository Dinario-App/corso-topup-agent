import test from 'node:test';
import assert from 'node:assert/strict';
import { createClaudeAgent, createRulesAgent, AgentError, INTENT_SCHEMA } from '../src/agent.js';

function fakeAnthropic(response) {
  const requests = [];
  return {
    requests,
    beta: { messages: { async create(req) { requests.push(req); return response; } } },
  };
}

test('Claude agent sends a structured-output request and parses the intent', async () => {
  const client = fakeAnthropic({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ action: 'topup', amount_usd: 25, purpose: 'Trip budget', reply: 'Got it.' }) }],
  });
  const agent = createClaudeAgent({ model: 'claude-opus-5-5', client });
  const intent = await agent.interpret('top up $25 for my trip budget');
  assert.deepEqual(intent, { action: 'topup', amount_usd: 25, purpose: 'Trip budget', reply: 'Got it.' });

  const [req] = client.requests;
  assert.equal(req.model, 'claude-opus-5-5');
  assert.deepEqual(req.output_config.format, { type: 'json_schema', schema: INTENT_SCHEMA });
  assert.equal(req.tools, undefined, 'the model is never given payment tools');
  assert.match(req.messages[0].content, /<message>\ntop up \$25 for my trip budget\n<\/message>/);
});

test('Claude agent turns a refusal into a decline', async () => {
  const agent = createClaudeAgent({ model: 'm', client: fakeAnthropic({ stop_reason: 'refusal', content: [] }) });
  const intent = await agent.interpret('something');
  assert.equal(intent.action, 'decline');
  assert.equal(intent.amount_usd, null);
});

test('Claude agent rejects malformed output', async () => {
  const bad = createClaudeAgent({ model: 'm', client: fakeAnthropic({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }) });
  await assert.rejects(bad.interpret('x'), AgentError);
  const wrongShape = createClaudeAgent({
    model: 'm',
    client: fakeAnthropic({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"action":"pay_now","amount_usd":"25"}' }] }),
  });
  await assert.rejects(wrongShape.interpret('x'), AgentError);
});

test('rules agent handles common phrasings', async () => {
  const agent = createRulesAgent();
  assert.deepEqual(
    { ...(await agent.interpret('top up $25 for my trip budget')), reply: undefined },
    { action: 'topup', amount_usd: 25, purpose: 'Trip budget', reply: undefined },
  );
  assert.equal((await agent.interpret('Add forty bucks to groceries')).amount_usd, 40);
  assert.equal((await agent.interpret('Put $12.50 toward the gym')).amount_usd, 12.5);
  assert.equal((await agent.interpret('add 30 dollars')).amount_usd, 30);
});

test('rules agent asks when the amount is missing or ambiguous', async () => {
  const agent = createRulesAgent();
  assert.equal((await agent.interpret('top up my trip budget')).action, 'clarify');
  assert.equal((await agent.interpret('add $20 or $30 to groceries')).action, 'clarify');
});
