# Demo Evidence Video Playbook

## Narrative Goal (Landing + Docs)

Show one simple story in under 90 seconds:

1. A normal agent skill passes.
2. A risky skill is blocked under enforcement mode.
3. SkillGate produces auditable evidence you can verify.

Use this exact narrative on landing pages and docs:

> "SkillGate blocks high-risk AI tool behavior before execution and leaves a signed, verifiable audit trail."

## Demo Assets Already in Repo

Use these fixtures directly:

- Safe fixture: `web-ui/docs/demo-fixtures/safe-agent-skill`
- Risky fixture: `web-ui/docs/demo-fixtures/risky-agent-skill`
- Signed verification clip (GIF): `web-ui/docs/demo-fixtures/risky-agent-skill/risky-signed-report-verification/risky-signed-report-verification.gif`
- Signed verification clip (MP4): `web-ui/docs/demo-fixtures/risky-agent-skill/risky-signed-report-verification/risky-signed-report-verification.mp4`

### What each fixture demonstrates

- `safe-agent-skill`: expected pass outcome (`ALLOW`-like posture for static scan)
- `risky-agent-skill`: expected fail/block outcome with findings like shell execution risk and hardcoded credential pattern

## Prerequisites

- SkillGate installed (`pipx install skillgate` or local editable env)
- Terminal with clean prompt and large font
- Repo root as current directory

Optional (for signed artifact segment):

- A tier/config that allows `--sign`

## Step-by-Step Command Flow

Run from repo root:

```bash
cd /Users/spy/Documents/PY/AI/skillgate
mkdir -p /tmp/skillgate-demo-artifacts
```

### Step 1: Show the safe baseline (pass)

```bash
skillgate scan ./web-ui/docs/demo-fixtures/safe-agent-skill \
  --output json \
  --report-file /tmp/skillgate-demo-artifacts/safe-report.json
```

What to narrate:

- "This is a user-safe skill baseline."
- "No critical policy-breaking findings."

### Step 2: Show risky behavior detection (report mode)

```bash
skillgate scan ./web-ui/docs/demo-fixtures/risky-agent-skill \
  --output json \
  --report-file /tmp/skillgate-demo-artifacts/risky-report.json
```

What to narrate:

- "Same pipeline, but now the skill contains risky execution patterns."
- "SkillGate surfaces concrete findings with rule IDs and severity."

### Step 3: Show hard block with enforcement

```bash
skillgate scan ./web-ui/docs/demo-fixtures/risky-agent-skill \
  --enforce \
  --policy production \
  --output json \
  --report-file /tmp/skillgate-demo-artifacts/risky-enforced-report.json
```

Expected outcome:

- Non-zero exit code
- Enforcement failure visible in output

What to narrate:

- "In production policy mode, risky actions are blocked, not just warned."

### Step 4: Show signed evidence (if available in your tier)

```bash
skillgate keys generate

skillgate scan ./web-ui/docs/demo-fixtures/risky-agent-skill \
  --enforce \
  --policy production \
  --sign \
  --report-file /tmp/skillgate-demo-artifacts/risky-signed-report.json

skillgate verify /tmp/skillgate-demo-artifacts/risky-signed-report.json
```

If `--sign` is unavailable in your environment:

- Keep Step 1-3 in the video
- Add a subtitle: "Signed verification available in enabled tiers"

If you already recorded signed verification:

- Reuse the committed clips from `web-ui/docs/demo-fixtures/risky-agent-skill/risky-signed-report-verification/`
- Use MP4 for web embeds and GIF for docs previews/slack posts

## 90-Second Shot List (Timestamped)

- `00:00-00:08` Title card: "Secure Every AI Tool Before It Executes"
- `00:08-00:25` Run safe fixture scan (pass)
- `00:25-00:45` Run risky fixture scan (findings appear)
- `00:45-01:05` Re-run risky fixture with `--enforce --policy production` (blocked)
- `01:05-01:20` Signed evidence + `skillgate verify` (or mention gated availability)
- `01:20-01:30` Closing CTA: "Install SkillGate. Enforce policy before execution."

## On-Screen Copy (SEO-Friendly)

Use these exact overlays:

- "AI Agent Runtime Policy Firewall"
- "Blocks high-risk shell, network, and filesystem behavior"
- "Deterministic policy decisions, not best-effort warnings"
- "Signed audit evidence for compliance and incident response"

## Suggested Output Artifacts for Marketing Team

Store under `/tmp/skillgate-demo-artifacts` while recording:

- `safe-report.json`
- `risky-report.json`
- `risky-enforced-report.json`
- `risky-signed-report.json` (if enabled)

Then publish media assets to your site pipeline as:

- Video: `skillgate-demo-v1.mp4`
- Poster: `skillgate-demo-v1-poster.png`
- Transcript: `skillgate-demo-v1-transcript.md`

For signed-report proof segments, use:

- `risky-signed-report-verification.mp4` as the inserted verification chapter
- `risky-signed-report-verification.gif` as lightweight preview/thumbnail fallback

## Embed Placement Guidance

- Landing page: place video near hero/social proof block.
- Docs: add in `/docs/get-started` or a dedicated "Demo Evidence" section.
- Keep autoplay off, show captions/transcript below embed.

## Demo Success Criteria

The video is ready when all are true:

- Viewer sees one pass and one block outcome.
- `--enforce --policy production` blocking is visible.
- At least one report artifact path is shown on screen.
- Final frame includes docs/install CTA.
