# PayPal AI Hackathon: rules and submission requirements

**Read on:** 2026-10-27
**Official pages (the rules that actually apply):**
- Overview: https://paypalaihackathon.devpost.com/
- Official rules: https://paypalaihackathon.devpost.com/rules

> **Read this first.** The build environment could not open devpost.com: the session's network policy blocks it. Everything below comes from web-search excerpts of the official Devpost pages, plus third-party listings that quote them. Each item has a source column. Before submitting, **Sly needs to read the official rules page once and tick the checklist at the end.** Where sources disagree, both versions are given and the safer one is recommended.

## 1. The event

| Item | What the sources say | Source |
|---|---|---|
| Name | PayPal AI Hackathon: "Build what's next with PayPal and AI" | Devpost overview (search excerpt) |
| Format | Online, on Devpost. About six weeks. Open to developers, AI builders, founders and students. | PayPal Developer post on X; Devpost |
| Cost | Free to enter. No purchase needed. | Aggregator summaries of the official rules |
| Submission deadline | **Thursday 12 Nov 2026.** The time varies by source: 12:00 PM PT, "12:00pm PST", "3:00pm EST" (also 12:00 PM PT) and one outlier, "2:00pm Pacific". **Plan for 12:00 PM PT and aim to submit on Wed 11 Nov.** | Devpost overview; devgrantsdaily; thegenaimagazine |
| Judging | Sources differ: 13 Nov to 15 Dec, or 1 Dec to 15 Dec 2026. Winners announced around 21 Dec 2026. | Aggregators |

## 2. Eligibility

- Entrants must be at or above the age of majority where they live.
- **Excluded:** residents of Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea, and other comprehensively sanctioned regions. US residents and US companies are not excluded.
- Employees of PayPal and Devpost, the judges, and their immediate families are excluded.
- The IP section speaks of the "entrant/team/organization", which suggests organizations can enter. **Sly should confirm** that Dinario Technologies, Inc. can enter as an organization, or decide to enter as an individual.

Sources: Devpost rules (search excerpt); internshala; startupgrantsindia.

## 3. Tracks and prizes

There are no separate tracks. All entries compete for the main prizes and can also win special and sponsor awards. Total: **$67,500+ in cash, $69,750 in all prizes** (Devpost overview).

| Prize | Amount | Source |
|---|---|---|
| 1st place | $12,000 | Devpost overview; aggregators |
| 2nd place | $8,000 | same |
| 3rd place | $5,000 | same |
| Most Creative | $5,000 | internshala |
| Most Impactful | $5,000 | internshala |
| Best Demo Delivery | $5,000 | internshala |
| **Best Use of PayPal + AI** | $5,000 | internshala |
| **Best Use of Agentic Commerce** | $5,000 | internshala |
| Sponsor awards | AG Grid ($5k / $2k / $1k), APIMatic (3 × $1k plus a 6-month subscription), Bryntum (3 × $1k), Channel3 ($1.5k), Render (credits, not cash: $1k / $750 / $500) | One aggregator table, unverified |

The awards this entry targets are in bold, along with the main prizes. The sponsor awards need that sponsor's product (AG Grid, Bryntum and so on), which this entry does not use.

## 4. What must be built

- The project must **meaningfully use at least one PayPal technology** (API, SDK or developer tool).
- The project must **meaningfully incorporate AI**.
- The submission must **name the AI tools and models used and explain how they were used**.
- **Judges must be able to run or try a working build.** That means clear run instructions in the repo or a hosted demo URL. A mockup or static prototype doesn't qualify.
- **No specific PayPal API is required.** PayPal's own AI tooling, the **PayPal Agent Toolkit** (`@paypal/agent-toolkit`) and the PayPal MCP server, fits the "PayPal + AI" and "agentic commerce" awards best. This entry uses the Agent Toolkit's Orders tools on the sandbox.

Sources: Devpost overview and rules (search excerpts); parsecailabs; PayPal developer docs for the Agent Toolkit (https://developer.paypal.com/tools/agent-toolkit, https://github.com/paypal/agent-toolkit).

## 5. Submission package

| Requirement | Detail | Source |
|---|---|---|
| Code repository | **Public** repository with the source code, needed assets and setup instructions. | Devpost rules (search excerpt); startupgrantsindia |
| Open-source license | An open-source **license file** that GitHub detects and shows in the repo's About section. | Devpost rules (search excerpt) |
| Demo video | **Under 3 minutes.** Judges are not required to watch past 3:00. Upload it publicly (YouTube per third parties; Devpost usually also accepts Vimeo or Youku). It must show the project running on its intended platform. | Third-party summaries of the rules |
| Video content | No third-party trademarks, copyrighted music or other material without permission. | Devpost rules (search excerpt) |
| Testing access | Run instructions or a hosted demo URL, plus any test credentials judges need. | Devpost overview (search excerpt) |
| AI disclosure | Which AI tools or models were used, and how. | Devpost overview (search excerpt) |
| Text description | The standard Devpost project story: what it does, how it was built, and so on. | Devpost format |

## 6. Judging criteria

Five criteria, **weighted equally**. Ties are broken in this order:

1. **Technological Implementation**: quality of the software and how well it uses PayPal and AI.
2. **Design**: user experience and how well thought out the product is.
3. **Potential Impact**: how much it could matter to its users and to PayPal's ecosystem.
4. **Quality of the Idea / Innovation**: how creative and original it is.
5. **Presentation**: how clearly the video and write-up explain it.

Sources: third-party summaries citing the official rules. See `docs/SUBMISSION.md` for how this entry maps to each criterion.

## 7. IP and licensing terms

- The submission must be the entrant's own original work, and must not infringe anyone's IP, contract, privacy or other rights.
- Third-party SDKs, APIs and open-source components are allowed if used under their own licenses and terms. That covers the PayPal Agent Toolkit, the Anthropic SDK and Express.
- **Not verified:** the full "Submission ownership / license grant" section, which covers any rights granted to PayPal or Devpost, such as using the entry, its name or the video for promotion. **Sly must read this part of the official rules before submitting.**
- Because the repo becomes public under an open-source license, everything in it becomes public. That is why this is a separate small project with no Corso production code.

Sources: Devpost rules (search excerpt); startupgrantsindia.

## 8. How this entry complies

| Rule | Status in this repo |
|---|---|
| Uses a PayPal technology | Yes: PayPal Agent Toolkit Orders tools (`create_order`, `get_order`, `pay_order`) on the PayPal **sandbox**. |
| Incorporates AI | Yes: Claude (Anthropic API) turns plain words into a top-up intent, asks a follow-up question when the request is unclear, and declines requests that are not top-ups. |
| Working build | Yes: `npm install && npm start`, with steps in the README. A hosted demo URL is optional (Sly's call). |
| Public repo with an OSS license | Yes: public since 2026-10-28, MIT (see `LICENSE`). |
| Video under 3 minutes | Shot list in `docs/SUBMISSION.md`. Sly records it. |
| AI disclosure | Drafted in `docs/SUBMISSION.md`. |
| No real money or customer data | Sandbox only. The app refuses to start with any PayPal environment other than sandbox. |

## 9. Checklist for Sly (against the official page)

- [ ] Exact deadline time on https://paypalaihackathon.devpost.com/ (12:00 PM PT assumed)
- [ ] An organization (Dinario Technologies, Inc.) may enter, or enter as an individual
- [ ] Submission ownership and license-grant terms in the official rules
- [ ] Video limit (3:00 assumed) and accepted hosts
- [ ] Whether a hosted demo URL is required or run instructions are enough
- [ ] Any required license type (any OSI license assumed)
- [ ] Whether projects must be started within the submission period (this one was started on 2026-10-27)

## Sources consulted (2026-10-27)

- https://paypalaihackathon.devpost.com/ (search excerpt only; direct fetch blocked)
- https://paypalaihackathon.devpost.com/rules (search excerpt only; direct fetch blocked)
- https://x.com/paypaldev/status/2105749692650754285
- https://internshala.com/competitions/paypal-ai-hackathon-2026/
- https://www.startupgrantsindia.com/competitions/paypal-ai-hackathon
- https://devgrantsdaily.com/items/2026-10-02-paypal-ai-hackathon-2026/
- https://thegenaimagazine.com/paypal-ai-hackathon-2026-ideas-deadline-prizes
- https://parsecailabs.com/en/blog/paypal-ai-hackathon/
- https://developer.paypal.com/tools/agent-toolkit
- https://github.com/paypal/agent-toolkit
