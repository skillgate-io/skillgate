package io.skillgate;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SkillGateClientTest {

    private MockWebServer server;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    private SkillGateClient.Config testConfig() {
        return new SkillGateClient.Config(
            server.url("/").toString().replaceAll("/$", ""),
            100, false, null
        );
    }

    private SkillGateClient.ToolInvocation sampleInvocation() {
        return new SkillGateClient.ToolInvocation(
            "inv-001", Instant.now(),
            new SkillGateClient.Actor("agent", "agent-1", "ws-1", "sess-1"),
            new SkillGateClient.Agent("my-agent", "1.0.0", "custom", "standard"),
            new SkillGateClient.Tool("fs.read", "local", List.of("fs.read"), "low"),
            new SkillGateClient.ToolRequest(),
            new SkillGateClient.ExecutionContext("my-repo", "dev", "internal", "private")
        );
    }

    private static final String ALLOW_BODY = """
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

    @Test
    void decide_allow() throws Exception {
        server.enqueue(new MockResponse().setBody(ALLOW_BODY).setHeader("Content-Type", "application/json"));

        try (SkillGateClient client = new SkillGateClient(testConfig())) {
            SkillGateClient.DecisionRecord decision = client.decide(sampleInvocation());
            assertEquals("ALLOW", decision.decision());
            assertEquals("SG_ALLOW", decision.decisionCode());
            assertFalse(decision.degraded());
        }
    }

    @Test
    void decide_fail_closed_sidecar_down() {
        SkillGateClient.Config cfg = new SkillGateClient.Config(
            "http://127.0.0.1:19999", 50, false, null
        );
        try (SkillGateClient client = new SkillGateClient(cfg)) {
            assertThrows(SkillGateClient.EnforcerUnavailableException.class,
                () -> client.decide(sampleInvocation()));
        }
    }

    @Test
    void decide_fail_open_returns_degraded() throws Exception {
        SkillGateClient.Config cfg = new SkillGateClient.Config(
            "http://127.0.0.1:19999", 50, true, null
        );
        try (SkillGateClient client = new SkillGateClient(cfg)) {
            SkillGateClient.DecisionRecord decision = client.decide(sampleInvocation());
            assertTrue(decision.degraded());
            assertEquals("SG_ALLOW_DEGRADED_AUDIT_ASYNC", decision.decisionCode());
        }
    }

    @Test
    void decide_sends_slt_auth_header() throws Exception {
        server.enqueue(new MockResponse().setBody(ALLOW_BODY).setHeader("Content-Type", "application/json"));

        SkillGateClient.Config cfg = new SkillGateClient.Config(
            server.url("/").toString().replaceAll("/$", ""),
            100, false, "test-slt-token"
        );
        try (SkillGateClient client = new SkillGateClient(cfg)) {
            client.decide(sampleInvocation());
        }
        RecordedRequest req = server.takeRequest();
        assertEquals("Bearer test-slt-token", req.getHeader("Authorization"));
    }

    @Test
    void registerTool_returns_true_on_success() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(200));
        try (SkillGateClient client = new SkillGateClient(testConfig())) {
            boolean ok = client.registerTool("my-tool", Map.of("version", "1.0"));
            assertTrue(ok);
        }
    }

    @Test
    void isHealthy_returns_true_on_200() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(200));
        try (SkillGateClient client = new SkillGateClient(testConfig())) {
            assertTrue(client.isHealthy());
        }
    }
}
