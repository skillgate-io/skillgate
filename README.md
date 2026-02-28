<h1 align="center">SkillGate</h1>
<p align="center"><strong>Deterministic AI Agent Security Governance for CI/CD and Runtime.</strong></p>

<p align="center">
  <a href="https://skillgate.io">Website</a> •
  <a href="https://skillgate.io/docs">Docs</a> •
  <a href="https://github.com/skillgate/skillgate">GitHub</a> •
  <a href="https://pypi.org/project/skillgate/">PyPI</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.10%2B-blue" alt="Python" />
  <img src="https://img.shields.io/badge/runtime-CLI%20%2B%20API%20%2B%20Worker-0b5fff" alt="Runtime" />
  <img src="https://img.shields.io/badge/security-signed%20evidence-0a7d3b" alt="Signed Evidence" />
  <img src="https://img.shields.io/badge/license-proprietary-1f2937" alt="License" />
</p>

SkillGate is the control plane for AI-agent execution safety. It does not stop at detection.
It enforces policy, blocks unsafe actions, and produces signed evidence for enterprise audit,
compliance, and procurement.

## Why SkillGate

- Deterministic policy enforcement, not best-effort warnings.
- Runtime governance gates for high-risk agent actions.
- Signed proof artifacts (Ed25519 + canonical JSON) for trust and traceability.
- CI/CD integration that can fail builds on policy violations.
- Enterprise-ready legal/governance posture and release gates.

## Quick Start

Choose one entrypoint:

- Recommended: Python CLI (canonical runtime)
- Alternative: npm wrapper (delegates to Python runtime)

### Option A — Python CLI (recommended)

```bash
pipx install skillgate
skillgate version
```

### Option B — npm wrapper (optional)

The npm package is a launcher only. It still requires Python + `skillgate` installed.

```bash
npm install -g @skillgate-io/cli
skillgate version
# or run without install:
npx @skillgate-io/cli version
```

### Required runtime configuration (minimum)

SkillGate reads configuration from environment variables (shell, `.env`, CI, or deployment secrets).

```bash
export SKILLGATE_API_KEY="sg_free_or_paid_key_here"
```

Optional, depending on your flow:

```bash
export SKILLGATE_API_URL="https://api.skillgate.io"
```

For the full environment reference, see `.env.example`.

### First governed scan

```bash
skillgate scan ./my-agent-skill --enforce --policy production
```

### Verify signed report

```bash
skillgate verify report.json
```

## Standout Capabilities

- Static + semantic risk analysis across multi-language agent code.
- Deterministic risk scoring and policy outcomes.
- Runtime gateway controls (approval, scope, budget, lineage).
- Governance-before-autonomy gates for write/remediation paths.
- Signed release/readiness and proof-pack evidence workflows.

## Programming Languages and Stack

### Core product

- Python 3.10+ (`skillgate` CLI/core/API/worker)
- TypeScript/React/Next.js (`web-ui`)
- Shell scripts (deployment, smoke, rollback, release gates)
- YAML/JSON (CI workflows, governance policies, contracts)

### Runtime components

- CLI: Typer + Rich
- API: FastAPI + SQLAlchemy + Alembic + PostgreSQL + Redis
- Security/signing: PyNaCl (Ed25519), SHA-256
- Quality gates: pytest, Ruff, mypy, pip-audit, detect-secrets
- Web: Next.js 14, React 18, TypeScript, Tailwind

## Repository Structure

```text
skillgate/
├── skillgate/        # CLI + core + API + worker
├── web-ui/           # Marketing/docs/product UI
├── scripts/          # Deploy, release, quality and gate automation
├── tests/            # Unit, integration, e2e, defense, docs contracts
├── docs/             # PRD, architecture, implementation and governance packs
└── .github/workflows # CI/CD and release gates
```

## Documentation

- Product and roadmap: `docs/PRD.md`, `docs/IMPLEMENTATION-PLAN.md`
- Open-core split governance: `docs/section-16-open-core-split-governance/README.md`
- Deployment runbooks: `docs/PROD-SETUP-NETLIFY-RAILWAY.md`, `docs/STABLE-LAUNCH-RUNBOOK.md`
- API migrations: `docs/API-MIGRATIONS.md`

## CTA: Build a Governed Agent Pipeline

1. Install SkillGate (Python CLI recommended; npm wrapper optional).
2. Run your first enforced scan.
3. Add CI gate enforcement.
4. Generate and verify signed evidence.
5. Roll into runtime governance for production agent actions.

For enterprise rollout support: `support@skillgate.io`

## License

Proprietary. All rights reserved.
