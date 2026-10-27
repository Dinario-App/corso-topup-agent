# Submission draft: PayPal AI Hackathon

Status: **draft for Sly to edit.** Sly submits on Devpost himself. Deadline: Thu 12 Nov 2026, 12:00 PM PT (see `docs/RULES.md`).

---

## 1. Project description (Devpost story)

**Name (working title):** Top-up Agent

**Tagline:** Say how much you want to add. See the exact cost. Approve it yourself.

### Inspiration

Most of us keep money in little buckets: a trip fund, groceries, the gym. Topping one up should take one sentence, not a form. AI assistants are getting good at understanding a sentence like that. But nobody wants an assistant that can spend their money without asking. We wanted something that is as quick as typing a sentence and as safe as paying yourself.

### What it does

You type what you want in your own words, for example *"top up $25 for my trip budget"* or *"add forty bucks to groceries"*.

1. **The assistant drafts it.** It works out the amount and what it's for. If something is unclear ("top up my trip budget" with no amount, or two amounts), it asks you instead of guessing. If you ask for something that isn't a top-up, it says so.
2. **You see the cost in dollars.** Before anything happens you get a clear breakdown: the top-up, any service fee, and the total you pay.
3. **You approve in PayPal.** Only when you press "Approve and continue to PayPal" is a PayPal checkout created, for exactly that total. You log in and approve it in PayPal.
4. **You press Pay.** Back in the app, we check with PayPal that the approved amount matches what you saw, and then show one last "Pay $25.00 now" button. The money moves only when you press it.

Nothing is ever paid by the assistant on its own. This demo runs on the PayPal sandbox, so no real money moves.

### How we built it

- **PayPal Agent Toolkit** (`@paypal/agent-toolkit`). Its Orders tools create the checkout, read it back, and capture it. All calls go to the PayPal sandbox.
- **Claude** (Anthropic API) reads the request and returns a structured top-up intent (amount, purpose, follow-up question or decline). We use structured outputs, so the assistant's answer always has the same shape.
- **A deliberate split between "propose" and "pay".** The language model is never given the payment tools. It can only propose. The server checks the amount against limits, calculates fees itself, and calls PayPal only after the person's explicit approvals. After PayPal approval it re-checks the order amount before offering the Pay button.
- Node.js and Express on the server, a plain HTML and JavaScript page on the front end, and 30+ automated tests covering the approval rules (no PayPal call before approval, no payment before PayPal approval, no double payment, a mismatched amount blocks payment, expired quotes can't be paid).

### Challenges we ran into

- Deciding how much the AI should be allowed to do. Letting the model call "capture payment" directly would make a slicker demo, but it's the wrong design for people's money. We kept the AI on the drafting side and put every money step behind a person.
- Making sure the amount you approve is the amount you pay. The app carries the total through every step and re-checks it with PayPal before payment.

### Accomplishments that we're proud of

- A two-sentence experience that still has two explicit approvals before any money moves.
- Clear dollar amounts on every screen, with no surprises at the end.
- An assistant that asks when it isn't sure, instead of guessing an amount.

### What we learned

- Agentic payments feel safest when the agent prepares and the person decides.
- PayPal's Agent Toolkit makes it simple to give an agent PayPal skills, and just as simple to keep the risky ones in your own code.

### What's next

- Recurring top-ups ("add $50 to my trip fund every payday"), each still approved by the person.
- Showing how close a budget is to its goal after each top-up.
- More languages and currencies.

### Built with

PayPal Agent Toolkit, PayPal Orders API (sandbox), Claude (Anthropic API), Node.js, Express, HTML/CSS/JavaScript.

### AI disclosure (required by the rules)

- **In the product:** Claude, through the Anthropic API (model set by `ANTHROPIC_MODEL`, default `claude-opus-5-5`), turns the person's sentence into a structured top-up intent. It has no payment tools. Without an API key the app falls back to a simple rules-based parser, and the screen says "no AI key set".
- **In development:** Claude Code (Anthropic) was used as a coding assistant to write and test this project. *(Sly: keep, edit or remove to match how you want to disclose.)*

### Testing instructions for judges (draft)

- Repo: `<public repo URL>`. Run steps are in the README (Node 20.6+, PayPal sandbox app credentials, optional Anthropic API key).
- Hosted demo (if Sly hosts one): `<demo URL>`. To approve a payment, log in to the PayPal sandbox with the test buyer account `<sandbox buyer email>` / `<sandbox buyer password>`. This is a sandbox test account, not a real one.

---

## 2. Judging criteria mapping

Criteria are weighted equally. Ties break in this order (see `docs/RULES.md` §6).

| Criterion | How this entry answers it | Where to show it |
|---|---|---|
| **Technological Implementation** | Real PayPal Agent Toolkit integration on the sandbox (create, get and capture order). Claude with structured outputs. A server-side state machine that enforces two approvals, re-checks amounts with PayPal, blocks double capture and expires stale quotes. Integer-cent money handling. Automated tests for every rule. | Video 1:30–2:05; README; `src/app.js`; `test/app.test.js` |
| **Design** | One text box, then a plain cost breakdown, then PayPal, then one Pay button. Every screen says what has and hasn't happened ("Nothing has been paid yet"). Works on phone width, light and dark. | Video 0:15–1:30 |
| **Potential Impact** | Shows a safe pattern for agentic payments that any PayPal merchant can copy: the agent proposes, the person approves and pays. Lowers the effort of saving toward a goal. | Video 2:05–2:30; story "Inspiration" |
| **Quality of the Idea / Innovation** | Conversational top-ups with explicit consent built in, rather than an agent with a blank cheque. The assistant asks or declines instead of guessing. | Video 0:45–1:05 (clarify and decline moments) |
| **Presentation** | Under 3 minutes, a live sandbox flow end to end, plain-language voiceover, a clear statement of what's AI and what's PayPal. | Whole video; this write-up |

Special awards this entry fits: **Best Use of PayPal + AI** and **Best Use of Agentic Commerce**, plus a shot at **Best Demo Delivery** if the video is tight.

---

## 3. Demo video shot list (target 2:30, hard limit under 3:00)

Record against the **sandbox** with the real app running (local or hosted) and `ANTHROPIC_API_KEY` set. Shot 3 needs the Claude agent: the offline rules parser doesn't decline requests. Use the PayPal sandbox buyer account. No real accounts, emails or card numbers on screen. No copyrighted music.

| # | Time | Shot | Voiceover (draft) |
|---|---|---|---|
| 1 | 0:00–0:15 | Title card: "Top-up Agent: built with PayPal and AI". Then the app home screen with the "Sandbox demo" banner visible. | "Topping up a savings bucket should take one sentence. Here's an assistant that turns that sentence into a PayPal payment, and never pays without you." |
| 2 | 0:15–0:45 | Type "Top up $25 for my trip budget" and press **Draft my top-up**. The review card appears: Top-up $25.00, Service fee $0.00, Total $25.00. | "I just say what I want. The AI works out the amount and what it's for, then shows me the exact cost in dollars before anything happens." |
| 3 | 0:45–1:05 | Type "top up my trip budget" (no amount). The assistant asks how much. Then type "send $50 to my friend". The assistant declines. | "If I'm vague, it asks. If I ask for something it shouldn't do, it says no. It never guesses an amount." |
| 4 | 1:05–1:30 | Back to the $25 draft. Press **Approve $25.00 and continue to PayPal**. The PayPal sandbox checkout opens; log in as the sandbox buyer and approve. | "Only now is a PayPal checkout created, for exactly $25. I log in and approve in PayPal, like any checkout." |
| 5 | 1:30–1:50 | Back in the app: "Last step: confirm payment". Press **Pay $25.00 now**. "Top-up complete" with the sandbox capture ID. | "Back in the app, we've double-checked the amount with PayPal. One last tap, and it's paid." |
| 6 | 1:50–2:05 | Split screen: the PayPal sandbox dashboard showing the $25.00 transaction, next to a short code view of `src/paypal.js` showing the Agent Toolkit tools. | "Under the hood: the PayPal Agent Toolkit creates and captures the order on the sandbox. Claude only drafts the intent. It never holds the payment tools." |
| 7 | 2:05–2:25 | Simple diagram: AI proposes → you see the cost → you approve in PayPal → you press Pay. | "The agent proposes, you decide. That's how we think AI should handle money." |
| 8 | 2:25–2:30 | End card: project name, "PayPal sandbox demo", repo URL. | "Thanks for watching." |

Backup takes worth recording: a cancel in PayPal (shows "Nothing was paid"), and an over-limit request ("top up $5,000", which the app explains is over the limit).

---

## 4. Still needed from Sly

| # | Item | Why | Notes |
|---|---|---|---|
| 1 | **PayPal sandbox app credentials** (client ID and secret) | To run checkout | developer.paypal.com → Apps & Credentials → **Sandbox** → create an app. Put them in `.env` locally. Never commit them. Then run `npm run sandbox:check`. |
| 2 | **PayPal sandbox buyer test account** | To approve payments in the demo | Created automatically under Sandbox → Accounts (a "Personal" account). Only needed in the video and judge instructions. |
| 3 | **Anthropic API key** | To run the AI agent (otherwise the rules parser is used) | Set `ANTHROPIC_API_KEY` in `.env`. A request costs a fraction of a cent at `effort: low`. |
| 4 | **Verify the rules** on the official Devpost page | The build session couldn't open devpost.com | Checklist in `docs/RULES.md` §9. Especially: deadline time, organization entry, IP and license-grant terms. |
| 5 | **Choose an open-source license** and add `LICENSE` | Required for submission | Recommended: MIT (simple, permissive). Add it only when making the repo public. |
| 6 | **Make the repo public** | Required for submission | Sly's decision at submission time. Before flipping, check the git history contains no secrets (it shouldn't: `.env` is ignored). |
| 7 | **Hosting decision** | Judges must be able to run or try it | Either rely on the README run steps, or host a demo (Render has a free tier and is a hackathon sponsor) with the sandbox credentials as environment variables. Set `PUBLIC_BASE_URL` to the hosted URL. |
| 8 | **Record and upload the demo video** | Required | Shot list above. Public YouTube upload, under 3:00. |
| 9 | **Final project name and branding** | Story and video | "Top-up Agent" is a working title. Whether to mention Corso or Dinario is Sly's call. |
| 10 | **Edit and approve this write-up** | Plain consumer voice, no traction claims | Including the AI-disclosure wording. |
| 11 | **Devpost account and registration** | Agents never sign in or create accounts | Register for the hackathon and submit personally. |
