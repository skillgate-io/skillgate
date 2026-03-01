using System.Net;
using WireMock.RequestBuilders;
using WireMock.ResponseBuilders;
using WireMock.Server;
using Xunit;

namespace SkillGate.Tests;

public sealed class SkillGateClientTests : IDisposable
{
    private readonly WireMockServer _server;
    private readonly SkillGateConfig _cfg;

    public SkillGateClientTests()
    {
        _server = WireMockServer.Start();
        _cfg = new SkillGateConfig(_server.Url!, TimeSpan.FromSeconds(2), false, null);
    }

    public void Dispose() => _server.Stop();

    private static ToolInvocation SampleInvocation() => new(
        "inv-001", DateTimeOffset.UtcNow,
        new Actor("agent", "agent-1", "ws-1", "sess-1"),
        new Agent("my-agent", "1.0.0", "custom", "standard"),
        new Tool("fs.read", "local", ["fs.read"], "low"),
        new ToolRequest(),
        new ExecutionContext("my-repo", "dev", "internal", "private")
    );

    private const string AllowBody = """
        {
          "invocation_id": "inv-001",
          "decision": "ALLOW",
          "decision_code": "SG_ALLOW",
          "reason_codes": [],
          "policy_version": "1.0.0",
          "budgets": {},
          "evidence": {"hash": "abc", "signature": "sig", "key_id": "key1"},
          "degraded": false,
          "entitlement_version": "1.0",
          "license_mode": "online"
        }
        """;

    [Fact]
    public async Task DecideAsync_Allow()
    {
        _server
            .Given(Request.Create().WithPath("/v1/decide").UsingPost())
            .RespondWith(Response.Create().WithStatusCode(200)
                .WithHeader("Content-Type", "application/json").WithBody(AllowBody));

        using var client = new SkillGateClient(_cfg);
        var decision = await client.DecideAsync(SampleInvocation());

        Assert.Equal("ALLOW", decision.Decision);
        Assert.Equal("SG_ALLOW", decision.DecisionCode);
        Assert.False(decision.Degraded);
    }

    [Fact]
    public async Task DecideAsync_FailClosed_ThrowsEnforcerUnavailable()
    {
        var cfg = _cfg with { SidecarUrl = "http://127.0.0.1:19999" };
        using var client = new SkillGateClient(cfg);
        await Assert.ThrowsAsync<EnforcerUnavailableException>(
            () => client.DecideAsync(SampleInvocation()));
    }

    [Fact]
    public async Task DecideAsync_FailOpen_ReturnsDegraded()
    {
        var cfg = _cfg with { SidecarUrl = "http://127.0.0.1:19999", FailOpen = true };
        using var client = new SkillGateClient(cfg);
        var decision = await client.DecideAsync(SampleInvocation());

        Assert.True(decision.Degraded);
        Assert.Equal("SG_ALLOW_DEGRADED_AUDIT_ASYNC", decision.DecisionCode);
    }

    [Fact]
    public async Task DecideAsync_SendsSltAuthHeader()
    {
        _server
            .Given(Request.Create().WithPath("/v1/decide").UsingPost())
            .RespondWith(Response.Create().WithStatusCode(200)
                .WithHeader("Content-Type", "application/json").WithBody(AllowBody));

        var cfg = _cfg with { Slt = "test-slt-token" };
        using var client = new SkillGateClient(cfg);
        await client.DecideAsync(SampleInvocation());

        var req = _server.LogEntries.Last().RequestMessage;
        Assert.Equal("Bearer test-slt-token", req.Headers!["Authorization"].First());
    }

    [Fact]
    public async Task RegisterToolAsync_ReturnsTrueOnSuccess()
    {
        _server
            .Given(Request.Create().WithPath("/v1/registry/my-tool").UsingPut())
            .RespondWith(Response.Create().WithStatusCode(200));

        using var client = new SkillGateClient(_cfg);
        var ok = await client.RegisterToolAsync("my-tool", new() { ["version"] = "1.0" });
        Assert.True(ok);
    }

    [Fact]
    public async Task IsHealthyAsync_ReturnsTrueOn200()
    {
        _server
            .Given(Request.Create().WithPath("/v1/health").UsingGet())
            .RespondWith(Response.Create().WithStatusCode(200));

        using var client = new SkillGateClient(_cfg);
        Assert.True(await client.IsHealthyAsync());
    }
}
