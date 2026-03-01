# SkillGate

Secure every AI tool before it executes.

SkillGate is a runtime policy firewall for OpenClaw, Claude Code, Codex CLI, and MCP workflows.

## Why SkillGate

- Runtime policy enforcement for shell, network, filesystem, and tool capabilities.
- Deterministic allow/deny decisions.
- Signed evidence for audits and incident response.
- Local-first workflow with CI/CD enforcement support.

## Install

### Python CLI (canonical runtime)

```bash
pipx install skillgate
skillgate --help
```

### npm entrypoint (delegates to Python runtime)

```bash
npm install -g @skillgate-io/cli
skillgate --help
```

## Links

- Website: https://skillgate.io
- Docs: https://docs.skillgate.io
- Source: https://github.com/skillgate-io/skillgate
