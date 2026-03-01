# skillgate-go

Go HTTP client for the [SkillGate](https://skillgate.io) runtime sidecar.

## Install

```bash
go get github.com/skillgate-io/skillgate-go
```

## Quick start

```go
import skillgate "github.com/skillgate-io/skillgate-go"

client := skillgate.New(skillgate.DefaultConfig())

decision, err := client.Decide(ctx, skillgate.ToolInvocation{
    InvocationID: "inv-abc123",
    Timestamp:    time.Now().UTC(),
    Actor: skillgate.Actor{
        Type: "agent", ID: "agent-1",
        WorkspaceID: "ws-prod", SessionID: "sess-xyz",
    },
    Agent: skillgate.Agent{
        Name: "my-agent", Version: "1.0.0",
        Framework: "custom", TrustTier: "standard",
    },
    Tool: skillgate.Tool{
        Name: "fs.read", Provider: "local",
        Capabilities: []string{"fs.read"}, RiskClass: "low",
    },
    Request: skillgate.ToolRequest{
        Params:       map[string]any{"path": "/etc/config"},
        ResourceRefs: []string{"/etc/config"},
    },
    Context: skillgate.ExecutionContext{
        Repo: "my-repo", Environment: "production",
        DataClassification: "internal", NetworkZone: "private",
    },
})
if err != nil {
    // Sidecar unreachable — fail-closed (default)
    log.Fatal(err)
}
if decision.Decision != "ALLOW" {
    // Enforcement denied the tool invocation
    log.Fatalf("denied: %s — %v", decision.DecisionCode, decision.ReasonCodes)
}
```

## Configuration

| Env var                  | Default                  | Description                          |
|--------------------------|--------------------------|--------------------------------------|
| `SKILLGATE_SIDECAR_URL`  | `http://localhost:8910`  | Sidecar base URL                     |
| `SKILLGATE_SLT`          | (empty)                  | Session License Token for auth       |

```go
cfg := skillgate.DefaultConfig()
cfg.FailOpen = true  // degrade gracefully if sidecar is down
cfg.TimeoutMs = 100  // increase for slow networks
client := skillgate.New(cfg)
```

## Decision codes

| Code                                  | Action           |
|---------------------------------------|------------------|
| `SG_ALLOW`                            | Proceed          |
| `SG_DENY_CAPABILITY_NOT_ALLOWED`      | Block            |
| `SG_DENY_BUDGET_EXCEEDED`             | Block (rate)     |
| `SG_APPROVAL_REQUIRED`                | Hold for approval|
| `SG_FAIL_CIRCUIT_OPEN`                | Circuit breaker  |
| `SG_ALLOW_DEGRADED_AUDIT_ASYNC`       | Fail-open allow  |

Full list: [Phase 2 decision codes](../docs/phase2/IMPLEMENTATION-PLAN.md)

## License

See [LICENSE](../LICENSE).
