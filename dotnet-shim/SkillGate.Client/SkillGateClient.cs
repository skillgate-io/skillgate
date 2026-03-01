using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SkillGate;

// ---- Models -----------------------------------------------------------------

/// <summary>Actor invoking the tool.</summary>
public sealed record Actor(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("workspace_id")] string WorkspaceId,
    [property: JsonPropertyName("session_id")] string SessionId
);

/// <summary>Agent metadata.</summary>
public sealed record Agent(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("version")] string Version,
    [property: JsonPropertyName("framework")] string Framework,
    [property: JsonPropertyName("trust_tier")] string TrustTier
);

/// <summary>Tool metadata.</summary>
public sealed record Tool(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("provider")] string Provider,
    [property: JsonPropertyName("capabilities")] IReadOnlyList<string> Capabilities,
    [property: JsonPropertyName("risk_class")] string RiskClass
);

/// <summary>Tool call parameters and referenced resources.</summary>
public sealed record ToolRequest(
    [property: JsonPropertyName("params")] IReadOnlyDictionary<string, object?> Params,
    [property: JsonPropertyName("resource_refs")] IReadOnlyList<string> ResourceRefs
)
{
    public ToolRequest() : this(new Dictionary<string, object?>(), Array.Empty<string>()) { }
}

/// <summary>Execution environment metadata.</summary>
public sealed record ExecutionContext(
    [property: JsonPropertyName("repo")] string Repo,
    [property: JsonPropertyName("environment")] string Environment,
    [property: JsonPropertyName("data_classification")] string DataClassification,
    [property: JsonPropertyName("network_zone")] string NetworkZone
);

/// <summary>Canonical enforcement request payload.</summary>
public sealed record ToolInvocation(
    [property: JsonPropertyName("invocation_id")] string InvocationId,
    [property: JsonPropertyName("timestamp")] DateTimeOffset Timestamp,
    [property: JsonPropertyName("actor")] Actor Actor,
    [property: JsonPropertyName("agent")] Agent Agent,
    [property: JsonPropertyName("tool")] Tool Tool,
    [property: JsonPropertyName("request")] ToolRequest Request,
    [property: JsonPropertyName("context")] ExecutionContext Context
);

/// <summary>Budget snapshot for a capability.</summary>
public sealed record BudgetStatus(
    [property: JsonPropertyName("remaining")] long Remaining,
    [property: JsonPropertyName("limit")] long Limit
);

/// <summary>Signed attestation evidence.</summary>
public sealed record DecisionEvidence(
    [property: JsonPropertyName("hash")] string Hash,
    [property: JsonPropertyName("signature")] string Signature,
    [property: JsonPropertyName("key_id")] string KeyId
);

/// <summary>Enforcement decision returned by the sidecar.</summary>
public sealed record DecisionRecord(
    [property: JsonPropertyName("invocation_id")] string InvocationId,
    /// <summary>"ALLOW" | "DENY" | "FAIL" | "REQUIRE_APPROVAL"</summary>
    [property: JsonPropertyName("decision")] string Decision,
    [property: JsonPropertyName("decision_code")] string DecisionCode,
    [property: JsonPropertyName("reason_codes")] IReadOnlyList<string> ReasonCodes,
    [property: JsonPropertyName("policy_version")] string PolicyVersion,
    [property: JsonPropertyName("budgets")] IReadOnlyDictionary<string, BudgetStatus> Budgets,
    [property: JsonPropertyName("evidence")] DecisionEvidence Evidence,
    [property: JsonPropertyName("degraded")] bool Degraded,
    [property: JsonPropertyName("entitlement_version")] string EntitlementVersion,
    [property: JsonPropertyName("license_mode")] string LicenseMode
);

// ---- Exceptions -------------------------------------------------------------

/// <summary>Thrown when the sidecar is unreachable and FailOpen is false.</summary>
public sealed class EnforcerUnavailableException(string message, Exception? inner = null)
    : Exception(message, inner);

// ---- Config -----------------------------------------------------------------

/// <summary>Client configuration.</summary>
public sealed record SkillGateConfig(
    /// <summary>Sidecar base URL. Default: http://localhost:8910.</summary>
    string SidecarUrl,
    /// <summary>Per-request timeout. Default: 50 ms.</summary>
    TimeSpan Timeout,
    /// <summary>When true, return a degraded ALLOW on sidecar failure.</summary>
    bool FailOpen,
    /// <summary>Session License Token for the Authorization header.</summary>
    string? Slt
)
{
    /// <summary>Build config from environment variables with production-safe defaults.</summary>
    public static SkillGateConfig FromEnv()
    {
        var url = Environment.GetEnvironmentVariable("SKILLGATE_SIDECAR_URL");
        if (string.IsNullOrWhiteSpace(url)) url = "http://localhost:8910";
        var slt = Environment.GetEnvironmentVariable("SKILLGATE_SLT");
        return new SkillGateConfig(url, TimeSpan.FromMilliseconds(50), false, slt);
    }
}

// ---- Client -----------------------------------------------------------------

/// <summary>
/// Thread-safe HTTP client for the SkillGate runtime sidecar.
/// </summary>
public sealed class SkillGateClient : IDisposable
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly SkillGateConfig _cfg;
    private readonly HttpClient _http;

    public SkillGateClient(SkillGateConfig cfg)
    {
        _cfg = cfg;
        _http = new HttpClient { Timeout = cfg.Timeout };
        if (!string.IsNullOrWhiteSpace(cfg.Slt))
            _http.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", cfg.Slt);
    }

    private static DecisionRecord DegradedAllow(string invocationId) => new(
        invocationId, "ALLOW", "SG_ALLOW_DEGRADED_AUDIT_ASYNC",
        ["enforcer_unavailable_fail_open"], "unknown",
        new Dictionary<string, BudgetStatus>(),
        new DecisionEvidence("", "", ""),
        true, "unknown", "offline"
    );

    /// <summary>
    /// Send a <see cref="ToolInvocation"/> to the sidecar for an enforcement decision.
    /// </summary>
    /// <exception cref="EnforcerUnavailableException">
    /// Sidecar unreachable and <see cref="SkillGateConfig.FailOpen"/> is false.
    /// </exception>
    public async Task<DecisionRecord> DecideAsync(
        ToolInvocation invocation,
        CancellationToken cancellationToken = default)
    {
        var body = new { invocation_id = invocation.InvocationId, tool_invocation = invocation };

        try
        {
            var response = await _http.PostAsJsonAsync(
                $"{_cfg.SidecarUrl}/v1/decide", body, JsonOpts, cancellationToken);
            response.EnsureSuccessStatusCode();
            var record = await response.Content.ReadFromJsonAsync<DecisionRecord>(JsonOpts, cancellationToken);
            return record!;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or TimeoutException)
        {
            if (_cfg.FailOpen) return DegradedAllow(invocation.InvocationId);
            throw new EnforcerUnavailableException("SkillGate sidecar unreachable (fail-closed)", ex);
        }
    }

    /// <summary>
    /// Register or update a tool AI-BOM in the sidecar registry.
    /// Best-effort — returns false on any connectivity failure.
    /// </summary>
    public async Task<bool> RegisterToolAsync(
        string toolName,
        Dictionary<string, object?> metadata,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _http.PutAsJsonAsync(
                $"{_cfg.SidecarUrl}/v1/registry/{toolName}", metadata, JsonOpts, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Returns true if the sidecar is reachable and healthy.</summary>
    public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _http.GetAsync($"{_cfg.SidecarUrl}/v1/health", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public void Dispose() => _http.Dispose();
}
