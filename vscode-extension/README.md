# SkillGate VS Code Extension

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/skillgate-io/skillgate)
[![Tests](https://img.shields.io/badge/tests-passing-2ea44f)](https://github.com/skillgate-io/skillgate)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Docs](https://img.shields.io/badge/docs-skillgate.io-1f6feb)](https://docs.skillgate.io)

Protect AI-assisted coding workflows directly in VS Code.

![SkillGate shield logo](https://raw.githubusercontent.com/skillgate-io/skillgate/main/vscode-extension/assets/extension-icon.png)

SkillGate helps you catch risky instructions and policy drift while you edit, before they become runtime incidents or CI failures.

## What you get

- Inline diagnostics on sensitive AI agent files (`CLAUDE.md`, `AGENTS.md`, `.claude/hooks/**`, and related files).
- Consistent decisions between editor, CLI, and sidecar.
- Fast setup checks so your team knows exactly what is ready and what needs attention.

## Quick start

1. Install SkillGate CLI (`pipx install skillgate`).
2. Sign in: `skillgate auth login`.
3. Start the local sidecar.
4. In VS Code, run: `SkillGate: Retry Setup Checks`.

## Marketplace

- Identifier: `skillgate-io.skillgate`
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
