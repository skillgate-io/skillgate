# Open-Core Public/Private Matrix v1

Status: Locked v1 (2026-02-21) for Section 16 split governance gates.

## Decision Rule

- Public (CE): integration surface, schemas/contracts, verification tooling, docs.
- Private (Pro/EE): detection intelligence, scoring heuristics, anti-evasion assets, red-team corpora.

## Public Export Allowlist (Initial)

- `skillgate/cli/**`
- `skillgate/ci/**`
- `skillgate/core/signer/**`
- `skillgate/core/models/**`
- `docs/openapi/skillgate-openapi.json`
- `web-ui/**`
- `scripts/install/**`
- `scripts/build/**`

## Private Export Denylist (Initial)

- `skillgate/core/analyzer/rules/**`
- `skillgate/core/scorer/weights.py`
- `skillgate/core/gateway/top_guard.py`
- `tests/defense/**`
- `tests/fixtures/injection_corpus_v1.jsonl`
- `docs/SECURITY-HARDENING-SPRINT.md`
- `docs/IMPLEMENTATION-PLAN.md`
- `docs/initial-requirements-discussion.txt`

## Conditional Exceptions (Only After CE Extraction)

- `skillgate/core/analyzer/rules/community/**`
- `skillgate/core/analyzer/rules/__init__.py`
- `skillgate/core/analyzer/rules/base.py`

Note: these exception paths should stay non-exportable until a clean CE subset is intentionally created.

## Operational Controls

1. Run publication gate locally:
   - `python scripts/release/check_public_export.py`
2. Gate a release branch export:
   - `python scripts/release/check_public_export.py --strict`
3. Validate negative fixture behavior (must fail):
   - policy fixture -> `docs/section-16-open-core-split-governance/artifacts/public-export-negative-fixture-2026-02-21.json`
4. Keep policy source of truth in:
   - `docs/open-core/public-export-policy.json`

## Release Criteria (Open-Core Readiness)

1. No denylisted files in export set.
2. CE rules are explicitly scoped and tested.
3. Internal hardening/evasion docs are removed from public tree.
4. License split (CE vs EE) is documented in release notes.
