# Changelog

All notable changes to SkillGate will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-15

### Added

- **Core Engine:** Bundle parser with manifest discovery (SKILL.md, skill.json, package.json, pyproject.toml)
- **Static Analysis:** 43 detection rules across 7 categories (shell, network, filesystem, eval, credential, injection, obfuscation)
- **Risk Scoring:** Deterministic weighted scoring with severity multipliers (Low=0.5, Medium=1.0, High=1.5, Critical=2.0)
- **Policy Engine:** YAML-based policy enforcement with 4 built-in presets (development, staging, production, strict)
- **Policy Evaluation:** Max score thresholds, finding count limits, permission controls, domain/path whitelists, rule overrides
- **CLI Commands:** `scan`, `rules`, `init`, `verify`, `keys generate`, `version`
- **Output Formats:** Human-readable (Rich tables), JSON, SARIF 2.1.0
- **Ed25519 Signing:** Keypair generation, canonical JSON serialization, signed attestation reports
- **Verification:** `skillgate verify` command with third-party public key support
- **GitHub Action:** Composite action with PR annotations, SARIF upload, policy enforcement
- **GitLab CI Template:** Reusable CI template with SAST report integration
- **License Validation:** API key format validation with tier detection (Free, Pro, Team, Enterprise)
- **Exit Codes:** Deterministic exit codes (0=success, 1=policy violation, 2=internal error, 3=invalid input)
- **Docker Image:** Multi-stage build for container-based scanning

[1.0.0]: https://github.com/skillgate/skillgate/releases/tag/v1.0.0
