package skillgate_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	skillgate "github.com/skillgate-io/skillgate-go"
)

func testInvocation() skillgate.ToolInvocation {
	return skillgate.ToolInvocation{
		InvocationID: "inv-001",
		Timestamp:    time.Now().UTC(),
		Actor: skillgate.Actor{
			Type:        "agent",
			ID:          "agent-1",
			WorkspaceID: "ws-1",
			SessionID:   "sess-1",
		},
		Agent: skillgate.Agent{
			Name:      "my-agent",
			Version:   "1.0.0",
			Framework: "custom",
			TrustTier: "standard",
		},
		Tool: skillgate.Tool{
			Name:         "fs.read",
			Provider:     "local",
			Capabilities: []string{"fs.read"},
			RiskClass:    "low",
		},
		Request: skillgate.ToolRequest{
			Params:       map[string]any{"path": "/etc/hosts"},
			ResourceRefs: []string{"/etc/hosts"},
		},
		Context: skillgate.ExecutionContext{
			Repo:               "my-repo",
			Environment:        "dev",
			DataClassification: "internal",
			NetworkZone:        "private",
		},
	}
}

func testDecision(invocationID string) map[string]any {
	return map[string]any{
		"invocation_id":       invocationID,
		"decision":            "ALLOW",
		"decision_code":       "SG_ALLOW",
		"reason_codes":        []string{},
		"policy_version":      "1.0.0",
		"budgets":             map[string]any{},
		"evidence":            map[string]any{"hash": "abc", "signature": "sig", "key_id": "key1"},
		"degraded":            false,
		"entitlement_version": "1.0",
		"license_mode":        "online",
	}
}

func TestDecide_Allow(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/decide" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(testDecision("inv-001"))
	}))
	defer srv.Close()

	cfg := skillgate.DefaultConfig()
	cfg.SidecarURL = srv.URL
	client := skillgate.New(cfg)

	decision, err := client.Decide(context.Background(), testInvocation())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if decision.Decision != "ALLOW" {
		t.Errorf("expected ALLOW, got %s", decision.Decision)
	}
	if decision.DecisionCode != "SG_ALLOW" {
		t.Errorf("expected SG_ALLOW, got %s", decision.DecisionCode)
	}
}

func TestDecide_FailClosed_SidecarDown(t *testing.T) {
	cfg := skillgate.DefaultConfig()
	cfg.SidecarURL = "http://127.0.0.1:19999" // nothing listening
	cfg.TimeoutMs = 10
	cfg.FailOpen = false
	client := skillgate.New(cfg)

	_, err := client.Decide(context.Background(), testInvocation())
	if err == nil {
		t.Fatal("expected error for unreachable sidecar")
	}
	if _, ok := err.(*skillgate.EnforcerUnavailableError); !ok {
		t.Errorf("expected EnforcerUnavailableError, got %T: %v", err, err)
	}
}

func TestDecide_FailOpen_SidecarDown(t *testing.T) {
	cfg := skillgate.DefaultConfig()
	cfg.SidecarURL = "http://127.0.0.1:19999"
	cfg.TimeoutMs = 10
	cfg.FailOpen = true
	client := skillgate.New(cfg)

	decision, err := client.Decide(context.Background(), testInvocation())
	if err != nil {
		t.Fatalf("unexpected error in fail-open mode: %v", err)
	}
	if !decision.Degraded {
		t.Error("expected degraded=true in fail-open response")
	}
	if decision.DecisionCode != "SG_ALLOW_DEGRADED_AUDIT_ASYNC" {
		t.Errorf("unexpected decision code: %s", decision.DecisionCode)
	}
}

func TestDecide_SLTAuthHeader(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(testDecision("inv-001"))
	}))
	defer srv.Close()

	cfg := skillgate.DefaultConfig()
	cfg.SidecarURL = srv.URL
	cfg.SLT = "test-slt-token"
	client := skillgate.New(cfg)

	client.Decide(context.Background(), testInvocation())
	if gotAuth != "Bearer test-slt-token" {
		t.Errorf("expected 'Bearer test-slt-token', got %q", gotAuth)
	}
}

func TestRegisterTool_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut || r.URL.Path != "/v1/registry/my-tool" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	cfg := skillgate.DefaultConfig()
	cfg.SidecarURL = srv.URL
	client := skillgate.New(cfg)

	ok := client.RegisterTool(context.Background(), "my-tool", map[string]any{"version": "1.0"})
	if !ok {
		t.Error("expected RegisterTool to return true")
	}
}

func TestHealth_OK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/health" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	cfg := skillgate.DefaultConfig()
	cfg.SidecarURL = srv.URL
	client := skillgate.New(cfg)

	if err := client.Health(context.Background()); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}
