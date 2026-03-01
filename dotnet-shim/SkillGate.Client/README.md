# SkillGate.Client

`SkillGate.Client` is the official .NET client for the SkillGate runtime sidecar.

Use it to send tool invocation metadata to the local sidecar and receive an
enforcement decision (`ALLOW`, `DENY`, or `REQUIRE_APPROVAL`) before execution.

## Install

```bash
dotnet add package SkillGate.Client
```

## Quick start

```csharp
using SkillGate;

var cfg = SkillGateConfig.FromEnv();
using var client = new SkillGateClient(cfg);

// Build ToolInvocation payload, then call:
// var decision = await client.DecideAsync(invocation);
```

## Environment variables

- `SKILLGATE_SIDECAR_URL` (default: `http://localhost:8910`)
- `SKILLGATE_SLT` (session license token for auth)

## Links

- Docs: <https://docs.skillgate.io>
- Repository: <https://github.com/skillgate-io/skillgate>
