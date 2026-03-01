# SkillGate VS Code Extension

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/skillgate-io/skillgate)
[![Tests](https://img.shields.io/badge/tests-passing-2ea44f)](https://github.com/skillgate-io/skillgate)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Docs](https://img.shields.io/badge/docs-skillgate.io-1f6feb)](https://docs.skillgate.io)

Protect AI-assisted coding workflows directly in VS Code.

SkillGate helps you catch risky instructions and policy drift while you edit, before they become runtime incidents or CI failures.

## What you get

- Inline diagnostics on sensitive AI agent files (`CLAUDE.md`, `AGENTS.md`, `.claude/hooks/**`, and related files).
- Consistent decisions between editor, CLI, and sidecar.
- Fast setup checks so your team knows exactly what is ready and what needs attention.

## Quick start

1. Install SkillGate CLI (`pipx install "skillgate[api]"`).
2. Sign in: `skillgate auth login`.
3. Start the local sidecar: `skillgate sidecar start`.
4. In VS Code, run: `SkillGate: Retry Setup Checks`.

## Command Palette

Run these commands from VS Code Command Palette (`Cmd/Ctrl+Shift+P`):

- `SkillGate: Open Setup Panel` - shows CLI/auth/sidecar readiness and setup actions.
- `SkillGate: Retry Setup Checks` - refreshes onboarding checks.
- `SkillGate: Initialize Policy File` - runs `skillgate init` and opens the generated policy file.
- `SkillGate: Scan Workspace` - runs `skillgate scan <workspace> --output json --report-file ...`.
- `SkillGate: Submit Scan Report` - submits latest/recent scan report via `skillgate submit-scan`.
- `SkillGate: Simulate Invocation` - sends a sample invocation to local sidecar and shows full decision output.
- `SkillGate: Generate PR Checklist` - builds a checklist from detected policy/capability changes and copies it.
- `SkillGate: Open Approval Request` - creates a local approval request and auto-fills from latest invocation context.
- `SkillGate: Open Approval Center` - central approval workflow panel (requests, sign, verify, folder access).
- `SkillGate: Sign Approval (Guided)` - signs a selected request with auto-derived skill context and stores lifecycle metadata.
- `SkillGate: Verify Approval (Guided)` - verifies selected signed request and updates request status to verified/failed.
- `SkillGate: Approve Instruction Line` - approves an inline instruction exception from current editor line.
- `SkillGate: Approve Hook` - approves the active hook file.

## Enterprise E2E flow

1. Open setup panel and get all checks green.
2. Initialize policy file from command palette.
3. Make policy change and run invocation simulation.
4. Generate PR checklist (copied + markdown preview opens).
5. If decision requires approval:
   - create approval request (invocation auto-selected from simulation/audit history)
   - sign approval (guided, prompted automatically after request)
   - verify approval (guided, prompted automatically after sign)
6. Merge with checklist and signed approval evidence attached.

## Sidecar modes

Default behavior uses one shared sidecar for all projects:

- `skillgate.sidecarMode`: `shared` (default)
- `skillgate.sidecarBasePort`: `9911` (default)

Advanced enterprise isolation mode:

- Set `skillgate.sidecarMode` to `managed-isolation`
- Extension auto-selects a deterministic per-workspace sidecar port
- `Start Sidecar` in setup uses that workspace-specific port automatically

Expert override:

- `skillgate.sidecarUrl` can be set manually for custom routing
- If set, it overrides sidecar mode and base port settings

## Marketplace

- Identifier: `skillgate-io.skillgate`
- Visual Studio Marketplace listing: `skillgate-io.skillgate`
- Install from VS Code Extensions by searching for `SkillGate`, or run:

```bash
code --install-extension skillgate-io.skillgate
```

## Documentation

- Product docs: [https://docs.skillgate.io](https://docs.skillgate.io)
- VS Code integration docs: [https://docs.skillgate.io/integrations/vscode-extension](https://docs.skillgate.io/integrations/vscode-extension)

## Resources

- Repository: [skillgate](https://github.com/skillgate-io/skillgate)
- Issues: [GitHub Issues](https://github.com/skillgate-io/skillgate/issues)
- License: [MIT](./LICENSE)
- Website: [https://skillgate.io](https://skillgate.io)
- Marketplace: [SkillGate Extension](https://marketplace.visualstudio.com/items?itemName=skillgate-io.skillgate)

## For maintainers

Build and package:

```bash
npm run build
npx vsce package
npx vsce publish
```
