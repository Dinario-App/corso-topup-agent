const $ = (id) => document.getElementById(id);
const form = $('ask-form');
const messageEl = $('message');
const askBtn = $('ask-btn');
const replyEl = $('reply');
const quoteCard = $('quote');

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { data });
  return data;
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  Object.assign(node, attrs);
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, cls, onClick) {
  const b = el('button', { type: 'button', className: cls }, label);
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { await onClick(); } finally { b.disabled = false; }
  });
  return b;
}

const TITLES = {
  drafted: 'Review your top-up',
  creating_order: 'Opening PayPal…',
  awaiting_payer: 'Finish in PayPal',
  checking_approval: 'Checking with PayPal…',
  payer_approved: 'Last step: confirm payment',
  capturing: 'Paying…',
  completed: 'Top-up complete',
  cancelled: 'Top-up cancelled',
  failed: 'Top-up not completed',
  needs_review: 'Check this payment',
};

const NOTES = {
  drafted: 'The assistant drafted this from what you typed. Check the amount. Nothing is paid until you approve in PayPal and then press Pay.',
  awaiting_payer: 'PayPal is waiting for your approval. Nothing has been paid yet.',
  payer_approved: 'You approved this in PayPal and we checked the amount with PayPal. Press Pay to finish. Nothing is paid until you do.',
  completed: 'Paid in the PayPal sandbox. No real money moved.',
  cancelled: 'Nothing was paid.',
  failed: 'The top-up did not go through. Details below.',
  needs_review: 'PayPal may have taken this payment. Check the PayPal sandbox before trying again.',
};

function renderQuote(quote) {
  quoteCard.classList.remove('hidden');
  $('quote-title').textContent = TITLES[quote.status] || 'Your top-up';
  $('quote-note').textContent = NOTES[quote.status] || '';

  const table = $('lines');
  table.replaceChildren();
  for (const line of quote.lines) {
    const tr = el('tr');
    tr.append(el('td', {}, line.label), el('td', { className: 'amt' }, line.amount));
    table.append(tr);
  }
  const total = el('tr', { className: 'total' });
  total.append(el('td', {}, 'Total you pay'), el('td', { className: 'amt' }, `${quote.total} USD`));
  table.append(total);

  const errEl = $('quote-error');
  errEl.textContent = quote.error || '';
  errEl.classList.toggle('hidden', !quote.error);

  const actions = $('actions');
  actions.replaceChildren();
  const startOver = () => button('Start over', 'secondary', async () => {
    history.replaceState(null, '', '/');
    quoteCard.classList.add('hidden');
    replyEl.textContent = '';
    messageEl.focus();
  });

  if (quote.status === 'drafted') {
    actions.append(
      button(`Approve ${quote.total} and continue to PayPal`, 'primary', async () => {
        try {
          const { approveUrl } = await api(`/api/quotes/${quote.id}/checkout`, { confirm: true, total: quote.total });
          window.location.assign(approveUrl);
        } catch (err) {
          if (err.data?.quote) renderQuote(err.data.quote);
          showError(err.message);
        }
      }),
      button('Cancel', 'secondary', async () => renderQuote((await api(`/api/quotes/${quote.id}/cancel`, {})).quote)),
    );
  } else if (quote.status === 'payer_approved') {
    actions.append(
      button(`Pay ${quote.total} now`, 'primary', async () => {
        try {
          renderQuote((await api(`/api/quotes/${quote.id}/pay`, { confirm: true })).quote);
        } catch (err) {
          if (err.data?.quote) renderQuote(err.data.quote);
          else showError(err.message);
        }
      }),
      button('Cancel', 'secondary', async () => renderQuote((await api(`/api/quotes/${quote.id}/cancel`, {})).quote)),
    );
  } else if (quote.status === 'completed') {
    const receipt = el('p', { className: 'ok' }, 'Sandbox capture ID: ');
    receipt.append(el('code', {}, quote.captureId || 'n/a'));
    actions.append(receipt);
    actions.append(startOver());
  } else if (['cancelled', 'failed', 'needs_review'].includes(quote.status)) {
    actions.append(startOver());
  }
}

function showError(message) {
  const errEl = $('quote-error');
  errEl.textContent = message;
  errEl.classList.remove('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  askBtn.disabled = true;
  replyEl.className = 'reply';
  replyEl.textContent = 'Thinking…';
  try {
    const data = await api('/api/quote', { message: messageEl.value });
    replyEl.textContent = data.reply;
    if (data.quote) {
      history.replaceState(null, '', `/?quote=${data.quote.id}`);
      renderQuote(data.quote);
    } else {
      quoteCard.classList.add('hidden');
    }
  } catch (err) {
    replyEl.className = 'reply error';
    replyEl.textContent = err.message;
  } finally {
    askBtn.disabled = false;
  }
});

for (const chip of document.querySelectorAll('.chip')) {
  chip.addEventListener('click', () => {
    messageEl.value = chip.textContent;
    messageEl.focus();
  });
}

(async function init() {
  try {
    const status = await api('/api/status');
    $('mode').textContent = [
      status.agent === 'claude' ? `Assistant: Claude (${status.model})` : 'Assistant: offline rules parser (no AI key set)',
      status.paypalConfigured ? 'PayPal: sandbox connected' : 'PayPal: sandbox not configured',
      `Limits: ${status.limits.min}–${status.limits.max}`,
    ].join(' · ');
  } catch { /* status is informational only */ }

  const id = new URLSearchParams(location.search).get('quote');
  if (id) {
    try {
      renderQuote((await api(`/api/quotes/${encodeURIComponent(id)}`)).quote);
    } catch {
      history.replaceState(null, '', '/');
    }
  }
})();
