# @skillgate-io/cli

Node entrypoint for SkillGate CLI.

<p>
  <img src="https://raw.githubusercontent.com/skillgate-io/skillgate/main/web-ui/public/images/hero-shield.svg" alt="SkillGate shield" width="64" />
</p>

## What this package is

- A thin npm wrapper.
- It forwards to the Python `skillgate` runtime.
- It does not bundle the scan/enforcement engine.

## Install and run

```bash
npm install -g @skillgate-io/cli
skillgate --help
```

With `npx`:

```bash
npx @skillgate-io/cli --help
```

## Required runtime

Install Python runtime first:

```bash
pipx install skillgate
```

Optional explicit Python path:

```bash
SKILLGATE_PYTHON=/path/to/python skillgate --help
```

## SEO Keywords

`npm ai security cli`, `codex cli security`, `claude code governance`, `runtime policy firewall`.
