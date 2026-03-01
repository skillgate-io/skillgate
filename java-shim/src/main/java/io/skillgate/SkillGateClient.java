package io.skillgate;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Thread-safe HTTP client for the SkillGate runtime sidecar.
 *
 * <pre>{@code
 * SkillGateClient client = new SkillGateClient(SkillGateClient.Config.fromEnv());
 * DecisionRecord decision = client.decide(invocation);
 * if (!"ALLOW".equals(decision.decision())) {
 *     throw new RuntimeException("Denied: " + decision.decisionCode());
 * }
 * }</pre>
 */
public final class SkillGateClient implements AutoCloseable {

    // ---- Models -------------------------------------------------------------

    /** Actor invoking the tool. */
    public record Actor(
        @JsonProperty("type") String type,
        @JsonProperty("id") String id,
        @JsonProperty("workspace_id") String workspaceId,
        @JsonProperty("session_id") String sessionId
    ) {}

    /** Agent metadata. */
    public record Agent(
        @JsonProperty("name") String name,
        @JsonProperty("version") String version,
        @JsonProperty("framework") String framework,
        @JsonProperty("trust_tier") String trustTier
    ) {}

    /** Tool metadata. */
    public record Tool(
        @JsonProperty("name") String name,
        @JsonProperty("provider") String provider,
        @JsonProperty("capabilities") List<String> capabilities,
        @JsonProperty("risk_class") String riskClass
    ) {}

    /** Tool call parameters and referenced resources. */
    public record ToolRequest(
        @JsonProperty("params") Map<String, Object> params,
        @JsonProperty("resource_refs") List<String> resourceRefs
    ) {
        public ToolRequest() { this(Map.of(), List.of()); }
    }

    /** Execution environment metadata. */
    public record ExecutionContext(
        @JsonProperty("repo") String repo,
        @JsonProperty("environment") String environment,
        @JsonProperty("data_classification") String dataClassification,
        @JsonProperty("network_zone") String networkZone
    ) {}

    /** Canonical enforcement request payload. */
    public record ToolInvocation(
        @JsonProperty("invocation_id") String invocationId,
        @JsonProperty("timestamp") Instant timestamp,
        @JsonProperty("actor") Actor actor,
        @JsonProperty("agent") Agent agent,
        @JsonProperty("tool") Tool tool,
        @JsonProperty("request") ToolRequest request,
        @JsonProperty("context") ExecutionContext context
    ) {}

    /** Budget snapshot for a single capability. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BudgetStatus(
        @JsonProperty("remaining") long remaining,
        @JsonProperty("limit") long limit
    ) {}

    /** Signed attestation evidence. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DecisionEvidence(
        @JsonProperty("hash") String hash,
        @JsonProperty("signature") String signature,
        @JsonProperty("key_id") String keyId
    ) {}

    /** Enforcement decision returned by the sidecar. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DecisionRecord(
        @JsonProperty("invocation_id") String invocationId,
        /** "ALLOW" | "DENY" | "FAIL" | "REQUIRE_APPROVAL" */
        @JsonProperty("decision") String decision,
        @JsonProperty("decision_code") String decisionCode,
        @JsonProperty("reason_codes") List<String> reasonCodes,
        @JsonProperty("policy_version") String policyVersion,
        @JsonProperty("budgets") Map<String, BudgetStatus> budgets,
        @JsonProperty("evidence") DecisionEvidence evidence,
        @JsonProperty("degraded") boolean degraded,
        @JsonProperty("entitlement_version") String entitlementVersion,
        @JsonProperty("license_mode") String licenseMode
    ) {}

    // ---- Exception ----------------------------------------------------------

    /** Thrown when the sidecar is unreachable and fail-open is disabled. */
    public static final class EnforcerUnavailableException extends IOException {
        public EnforcerUnavailableException(String message) { super(message); }
        public EnforcerUnavailableException(String message, Throwable cause) { super(message, cause); }
    }

    // ---- Config -------------------------------------------------------------

    /**
     * Client configuration.
     *
     * @param sidecarUrl  Sidecar base URL. Default: {@code http://localhost:8910}.
     * @param timeoutMs   Per-request timeout in milliseconds. Default: 50.
     * @param failOpen    When true, return a degraded ALLOW on sidecar failure.
     * @param slt         Session License Token for the Authorization header.
     */
    public record Config(String sidecarUrl, int timeoutMs, boolean failOpen, String slt) {

        /** Build configuration from environment variables with production-safe defaults. */
        public static Config fromEnv() {
            String url = System.getenv("SKILLGATE_SIDECAR_URL");
            if (url == null || url.isBlank()) url = "http://localhost:8910";
            String slt = System.getenv("SKILLGATE_SLT");
            return new Config(url, 50, false, slt);
        }
    }

    // ---- Client impl --------------------------------------------------------

    private final Config cfg;
    private final HttpClient http;
    private final ObjectMapper mapper;

    public SkillGateClient(Config cfg) {
        this.cfg = cfg;
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(cfg.timeoutMs()))
            .build();
        this.mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
    }

    private Map<String, String> authHeaders() {
        if (cfg.slt() != null && !cfg.slt().isBlank()) {
            return Map.of("Authorization", "Bearer " + cfg.slt());
        }
        return Map.of();
    }

    private DecisionRecord degradedAllow(String invocationId) {
        return new DecisionRecord(
            invocationId, "ALLOW", "SG_ALLOW_DEGRADED_AUDIT_ASYNC",
            List.of("enforcer_unavailable_fail_open"), "unknown",
            Map.of(), new DecisionEvidence("", "", ""),
            true, "unknown", "offline"
        );
    }

    /**
     * Send a {@link ToolInvocation} to the sidecar for an enforcement decision.
     *
     * @throws EnforcerUnavailableException if sidecar is unreachable and fail-open is false.
     */
    public DecisionRecord decide(ToolInvocation invocation) throws IOException, InterruptedException {
        Map<String, Object> body = new HashMap<>();
        body.put("invocation_id", invocation.invocationId());
        body.put("tool_invocation", invocation);

        String json = mapper.writeValueAsString(body);

        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
            .uri(URI.create(cfg.sidecarUrl() + "/v1/decide"))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofMillis(cfg.timeoutMs()))
            .POST(HttpRequest.BodyPublishers.ofString(json));

        authHeaders().forEach(reqBuilder::header);

        try {
            HttpResponse<String> response = http.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw new IOException("Sidecar returned " + response.statusCode() + ": " + response.body());
            }
            return mapper.readValue(response.body(), DecisionRecord.class);
        } catch (IOException e) {
            if (cfg.failOpen()) return degradedAllow(invocation.invocationId());
            throw new EnforcerUnavailableException("SkillGate sidecar unreachable (fail-closed)", e);
        }
    }

    /**
     * Register or update a tool AI-BOM in the sidecar registry.
     * Best-effort — returns {@code false} on any connectivity failure.
     */
    public boolean registerTool(String toolName, Map<String, Object> metadata) {
        try {
            String json = mapper.writeValueAsString(metadata);
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(cfg.sidecarUrl() + "/v1/registry/" + toolName))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofMillis(cfg.timeoutMs()))
                .PUT(HttpRequest.BodyPublishers.ofString(json));
            authHeaders().forEach(reqBuilder::header);
            HttpResponse<Void> resp = http.send(reqBuilder.build(), HttpResponse.BodyHandlers.discarding());
            return resp.statusCode() >= 200 && resp.statusCode() < 300;
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /**
     * Returns {@code true} if the sidecar is reachable and healthy.
     */
    public boolean isHealthy() {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(cfg.sidecarUrl() + "/v1/health"))
                .timeout(Duration.ofMillis(cfg.timeoutMs()))
                .GET().build();
            HttpResponse<Void> resp = http.send(req, HttpResponse.BodyHandlers.discarding());
            return resp.statusCode() == 200;
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    @Override
    public void close() {
        // HttpClient is closeable in Java 21+; nothing to do for 17
    }
}
