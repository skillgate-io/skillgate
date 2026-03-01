# SkillGate Go-to-Market & SEO Strategy

**For:** Product owner / solo developer
**Last updated:** 2026-02-28
**Purpose:** Generate real revenue, build acquisition positioning
**Tone:** Brutal. No icing.

---

## Actual Current State (As of Today)

**Done:**
- v1.2.0 prepared for Python + npm release (`skillgate==1.2.0`, `@skillgate-io/cli@1.2.0`)
- npm wrapper published
- skillgate.io live with pricing
- docs.skillgate.io live with full CLI reference + 7-language rule catalog
- Pricing tiers live: Free / Pro $49/mo (or $490/yr, ~17% off) / Team $99/mo (or $990/yr, ~17% off) / Enterprise $10k+/yr custom
- Structured SEO in web-ui is implemented (`SoftwareApplication` + `FAQPage` JSON-LD, sitemap, robots)
- Social proof section is live on landing page (testbed evidence cards + corpus numbers)

**Not done yet:**
- External social proof badges on site (GitHub stars, PyPI downloads)
- VS Code extension v0.12.0 built but **not yet published to VS Code Marketplace** (publisher: skillgate-io)
- SaaS control plane (Sprint 15)
- No published security research
- No HN post, no ProductHunt launch
- No newsletter coverage
- `SECURITY.md` + public vulnerability disclosure policy

**The critical gap:** The site has pricing and internal evidence, but lacks third-party credibility signals (stars/downloads/customer references). For a security product targeting enterprise buyers, this still hurts conversion.

---

## Honest Product Assessment

**Genuine moat (things no one else has):**
- Tool poisoning detection — scans MCP tool metadata for prompt injection before Claude sees the tool
- Sub-agent budget inheritance — prevents circumventing rate limits via Task tool chaining
- Settings drift detection — catches silent `allowedTools` additions against a signed baseline
- Signed Ed25519 audit trail on every tool invocation decision

**What the site headline says:** "Block risky AI agent changes before they ship"
**The problem:** This sounds like a code review tool, not a runtime enforcement layer. It undersells the MCP-specific security angle that actually differentiates you.

**Market window:** Anthropic has no governance answer for Claude Code enterprise. That window is open for roughly 12–18 more months.

---

## Phase 0: Fix Before Driving Traffic (This Week)

These are conversion blockers. Traffic to a zero-social-proof page bounces.

### 0.1 Add Social Proof to skillgate.io (Day 1–3)

You likely have zero paying customers today. That is fine — use what you have:

- **GitHub stars count** — add a live badge prominently on the landing page.
- **Install count** — add PyPI download badge.
- **"Built with" call to the community** — add a section: "Using SkillGate? Tell us." with a 2-field form (name + how you use it). Populate it the moment one person responds.
- **Your own quote as the founder** — if zero users yet, a single credible first-person statement works: "Built after discovering MCP tool descriptions are an undefended prompt injection surface." This is proof of conviction, not social proof, but it is better than nothing.

No logos, no testimonials = anonymous product = no enterprise conversion.

### 0.2 Fix the Headline

Current: "Block risky AI agent changes before they ship" — this reads as static analysis / pre-deploy tool.

The product is a **runtime enforcement engine for MCP tool calls**. That is what makes it worth buying.

Suggested test: "SkillGate enforces which tools your Claude Code agents are allowed to call — at runtime, with a signed audit trail."

This is longer but accurate. Run an A/B test if you have the traffic. Otherwise just change it.

### 0.3 Add a Demo Artifact (Landing + Docs)

The docs exist and we now need one consistent visual proof asset surfaced in both product UI and docs. Add:
- A 90-second screen recording of a tool call being blocked with a `DecisionRecord` (embed on landing page)
- The same recording embedded in docs (`web-ui/docs`) in a dedicated "Demo Evidence" section
- Optional: ASCII terminal recording (asciinema) showing `skillgate scan` catching a malicious tool

Developers do not buy security tools on prose. They buy on seeing the tool catch something.

### 0.4 GitHub Repository Hygiene (if not done)

- README: answer in first 8 lines — what it does, who it is for, one install command, one usage example
- Shields: PyPI version, npm version, test status, coverage
- Topics: `mcp`, `claude-code`, `ai-security`, `agent-governance`, `tool-poisoning`, `llm-security`
- Add `SECURITY.md` with `security@skillgate.io` disclosure route and response SLA
- Pin a demo GIF or screen recording to the README top
- Release cadence: tag at minimum every 2 weeks — GitHub trending rewards recent activity

### 0.5 pyproject.toml Keywords (5 minutes, permanent SEO value)

PyPI descriptions and keywords are indexed by Google. If not already set:

```toml
keywords = ["mcp security", "claude code governance", "ai agent firewall",
            "tool invocation control", "mcp tool poisoning", "llm security",
            "agent policy enforcement", "ai security"]
```

---

## Phase 1: SEO Foundation (Month 1–2)

### Keyword Strategy

You are in a nascent category. SEO takes 6–12 months. Your strategy must work within that — target terms with near-zero competition today that will have high intent in 6 months.

**Primary keywords (attainable, high intent):**

| Keyword | Volume Est. | Difficulty | Why |
|---|---|---|---|
| mcp tool poisoning | 300–700 | Very Low | You invented the term. Own it. |
| mcp tool security | 200–500 | Low | Category-defining, rank fast |
| claude code governance | 100–300 | Very Low | Near-zero competition today |
| mcp prompt injection | 400–1,000 | Low | Security researchers searching now |
| claude code enterprise security | 200–600 | Low | Buyer intent |
| ai agent tool policy | 300–800 | Low | Broad but reachable |
| ai agent firewall | 500–1,500 | Medium | Target month 3–4 |

**Do not target:**
- "AI security" — dominated by Lakera, Guardrails, PromptArmor — you will not rank
- "LLM security" — same problem, funded competitors with domain authority
- "Claude Code" alone — Anthropic owns this SERP

**Long-tail articles (one article per keyword, these convert):**
- "how to prevent prompt injection in mcp tool descriptions"
- "claude code allowedtools silent supply chain attack"
- "ai agent budget limits and sub-agent chaining exploit"
- "how to audit claude code tool calls for soc 2 compliance"
- "mcp settings.json security risks"
- "signed audit log for ai agent tool invocations"

### Content Plan (8 Articles, Not 50)

**Article 1 — The anchor piece (publish first, drives everything else)**

Title: "MCP Tool Poisoning: How Attackers Inject Instructions into Claude's Tool Descriptions"

- 1,500–2,000 words
- Include: what the attack is, a real PoC (use your test fixtures), how SkillGate's scanner detects it, the regex/AST patterns used
- Frame as security research disclosure, not a product pitch
- Publish on skillgate.io/blog, then cross-post to dev.to and Medium with canonical URL pointing back to your site
- Submit to HN as "Show HN: I built a scanner that detects prompt injection in MCP tool descriptions"
- Submit to r/netsec with the technical framing

This article alone can generate 80% of your first 3 months of inbound if it hits HN front page.

**Article 2 (Week 4)**

Title: "Claude Code's .claude/settings.json: The Supply Chain Attack Vector No One Is Patching"

- Settings drift, allowedTools injection, your baseline detection mechanism
- Practical walkthrough: attack setup → SkillGate detection → remediation
- Target: r/netsec, r/devops, security newsletter pitches

**Article 3 (Week 5)**

Title: "Sub-Agent Budget Bypass: How AI Agents Circumvent Rate Limits Through Task Tool Chaining"

- Your most technically novel content — write as a research disclosure
- Frame: here is a class of attack, here is why it works, here is the mitigation
- Do not lead with SkillGate until paragraph 4
- Target: AI safety researchers, Anthropic employees, enterprise security buyers

**Article 4 (Week 6)**

Title: "What SOC 2 Auditors Actually Ask About AI Agents (And What Evidence You Need)"

- Explain auditor requirements, what a `DecisionRecord` proves, how SkillGate produces evidence
- Ranks for: "ai agent compliance", "soc 2 ai agents", "claude code audit log"
- This is your enterprise closer — link it from the pricing page

**Articles 5–8 (Month 2)**
One per week, each targeting one long-tail keyword above. Keep them practical. No thought leadership. Developers can smell it.

### Technical SEO (Do Once)

- Core Web Vitals must pass — check PageSpeed Insights now, fix before doing anything else
- `SoftwareApplication` structured data schema on the landing page
- Canonical URLs: PyPI, npm, GitHub, docs.skillgate.io, and skillgate.io all describe the same product — ensure no duplicate content penalties
- Sitemap submitted to Google Search Console if not already done
- Every article internally links to the landing page CTA and to 2 other articles
- docs.skillgate.io: add `noindex` to auto-generated API reference pages to avoid thin content penalties, or ensure they have substantive content

---

## Phase 2: Distribution (Month 1–3, Parallel to SEO)

SEO is slow. These channels generate traffic in days.

### 2.1 Hacker News (Highest Leverage)

Your tool poisoning article is HN front page material — written as a technical disclosure, not a product launch.

- Post: "Show HN: I built a scanner that detects prompt injection in MCP tool descriptions"
- Post Tuesday or Wednesday, 8–10am ET
- Link to the article or GitHub, never to the landing page (HN flags product pages)
- Be in comments for 2 hours answering technical questions
- One HN front page hit = 2,000–5,000 unique visitors — more than 2 months of SEO in one day

### 2.2 Reddit

- r/ClaudeAI — 180k members, low competition for technical posts
- r/LocalLLaMA — 200k+ members, security posts perform well
- r/netsec — 500k+ members, your poisoning research belongs here
- r/devops — for the compliance/audit angle

Post the research, not the product. Reddit upvotes research. It bans product pitches.

### 2.3 Anthropic Community (Not for Traffic — for Radar)

- Anthropic Discord `#claude-code` channel — participate as a developer, not a marketer
- Claude Code GitHub Discussions — answer MCP security questions, product name in bio is enough
- The goal: being seen by Anthropic employees who monitor their own channels

### 2.4 Security Newsletters (Direct Pitch)

One accepted pitch = 10,000+ qualified readers. Pitch these:

- **tl;dr sec** (Clint Gibler) — covers AI security tooling directly
- **TLDR Newsletter** developer edition — 500k+ developer subscribers
- **The AI Security Newsletter** by Ken Huang — exact audience fit
- **Risky Business** — established security podcast with enterprise listeners

Pitch format: 3 sentences. What the tool does. Why it matters now (MCP ecosystem, no governance layer). Link to the technical article, not the product page.

### 2.5 ProductHunt Launch (Month 3–4)

Prerequisites before launching:
- Demo video exists and is embedded on the landing page (not negotiable)
- At least 20 real people lined up to upvote on launch day
- PyPI is published (done), npm is published (done)
- Someone with PH hunter status agreed to post it

ProductHunt for developer tools: 500–2,000 installs in one day. Conversion to paying users is low. Its value is backlinks and press pickup. Do not delay other execution waiting for this.

---

## Phase 3: Monetization

### Current Pricing Tiers (Live)

| Tier | Monthly | Annual | Savings |
|---|---|---|---|
| Free | $0 | $0 | — |
| Pro | $49/mo | $490/yr ($40.83/mo) | ~17% (2 months free) |
| Team | $99/mo | $990/yr ($82.50/mo) | ~17% (2 months free) |
| Enterprise | — | $10k+/yr custom | — |

Both monthly and annual billing exist with a clean 17% annual discount. The pricing structure is sound — no friction issue here. The gap is not the pricing model, it is the absence of social proof that prevents anyone from clicking "Start Pro" in the first place.

### Honest Revenue Projection (Year 1)

- 1,000 GitHub stars → ~50 signups → 5–10 Pro conversions = $245–490 MRR (this is signal, not wealth)
- First enterprise deal at $500–2,000/month = real money and the case study that unlocks the next 10 deals
- Realistic Year 1 target with good execution: $2,000–6,000 MRR

The math does not change: enterprise is where the revenue lives. Self-serve Pro funds your hosting.

### Enterprise Path

Enterprise requires before you can close:
- One reference customer (free pilot is fine)
- Audit log that exports in formats auditors recognize (CSV, JSON, future SIEM)
- A `security@skillgate.io` contact and published vulnerability disclosure policy
- The SaaS control plane (Sprint 15 — your gating dependency for fleet management)

**How to reach enterprise buyers (not cold email):**
- LinkedIn: 2 posts/week on AI agent security, not product announcements
- Speak at AI engineering meetups — 1 talk = 10 qualified enterprise conversations
- Partner with Claude Code-focused consultancies — they want a security tool to upsell to their clients

### What NOT to Do

- No Google Ads before $5k MRR — CAC will destroy you
- No content agency — they cannot write for your technical audience
- No Discord community before 100 users — empty communities destroy credibility
- Do not compete with Lakera or Guardrails on broad LLM security — stay in the MCP/Claude Code lane exclusively

---

## Phase 4: Acquisition Positioning for Anthropic

### What Anthropic Would Buy

Anthropic acquires for technology and talent, not revenue multiples.

1. **Tool poisoning detection** — they created MCP and have a duty to secure it; a working scanner is a credible answer to a problem they cannot ignore
2. **Sub-agent budget inheritance** — maps directly to Claude Code's Task tool; Anthropic needs this at the model serving layer
3. **Settings drift detection** — enterprise Claude Code sales are blocked without it
4. **The signed audit trail** — SOC 2, HIPAA, FedRAMP all require this; Anthropic's enterprise motion needs it

### What Anthropic Would Not Buy

- A SaaS control plane they would need to rebuild in their infra
- The open-core revenue model (they give things away)
- The CLI layer specifically (they already have Claude Code CLI)

**The acquisition thesis:** buy the enforcement engine and the team, discard the SaaS wrapper, embed the engine into Claude Code natively.

### How to Get on Anthropic's Radar

**Step 1 — Responsible disclosure (Do this now):**
File a research report — not a bug report — with Anthropic's security team about MCP tool poisoning. Attach your detection methodology. This gets you a named contact inside Anthropic before you have revenue or stars.

**Step 2 — Technical visibility (Month 1–3):**
HN front page with the poisoning research is the highest-probability path to internal Anthropic circulation. One article + one HN post is worth more than 6 months of marketing.

**Step 3 — Build in public (Month 1–6):**
Post weekly technical updates on X/Twitter and LinkedIn. Tag `@AnthropicAI` on posts specifically about MCP security. Goal: being findable when an Anthropic PM searches for "MCP security tool."

**Step 4 — Partner channel (Month 3–6):**
- Get listed on modelcontextprotocol.io integrations directory (Anthropic employees maintain it)
- Apply to Anthropic's partner program if open
- Get listed in Claude Code plugin registry — `.codex/skills/skillgate-agent-tool/SKILL.md` is already positioned for this

**Step 5 — The direct ask (Month 6–12):**
Minimum before reaching out: 500+ GitHub stars, 1–2 enterprise reference customers, published + cited security research, working sidecar demo.

Email the Claude Code team lead. One paragraph. "I built the MCP security enforcement layer your enterprise customers are asking for. I want to explore how this fits into your roadmap." Do not lead with acquisition.

### Realistic Acquisition Valuation

| Stage | Range | Basis |
|---|---|---|
| Today (pre-revenue, pre-research) | $1M–3M | Acqui-hire + IP |
| With $10k MRR + 1 enterprise reference | $3M–8M | Revenue multiple begins to apply |
| With $50k MRR + named enterprise clients | $8M–20M | Strategic acquisition, not acqui-hire |
| With published research + broad citation | Premium to above | Strategic value, not revenue multiple |

**Target before approaching Anthropic:** 3–5 enterprise pilots (free is fine), 1,000 GitHub stars, one published security research piece with external citations. Do not approach at zero.

---

## Revised Execution Calendar

Month 1 is now: the Phase 0 fixes + first article + HN post. PyPI, npm, and the site are done — remove those from the critical path.

| Month | Priority 1 | Priority 2 | Priority 3 |
|---|---|---|---|
| Now (this week) | **Publish VS Code extension to Marketplace** | Add external social proof badges to skillgate.io | Add demo artifact (landing + docs) |
| Month 1 | Tool poisoning article + HN post | GitHub hygiene (shields, topics, SECURITY.md) | Responsible disclosure to Anthropic security team |
| Month 2 | Settings drift article + r/netsec | Newsletter pitches (3) | Enterprise pilot outreach prep |
| Month 3 | Sub-agent research article | ProductHunt launch prep | First enterprise pilot outreach |
| Month 4 | SOC 2 compliance article | ProductHunt launch | Stripe revenue review |
| Month 5 | Sprint 12 (VS Code) ships | Case study from pilot | LinkedIn 2x/week cadence |
| Month 6 | MRR review — is $3k attainable? | Anthropic partner program application | Direct outreach to Claude Code team |

---

## The One-Line Version

The site and packages are live — the conversion foundation exists. The next 30 days are: fix the social proof gap, publish the tool poisoning research, and file the responsible disclosure with Anthropic. Everything else follows from those three moves.

The product is worth pursuing. The acquisition story is believable. The window is real but not permanent.
