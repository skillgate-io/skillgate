// Package skillgate provides a Go HTTP client for the SkillGate runtime sidecar.
//
// Usage:
//
//	client := skillgate.New(skillgate.DefaultConfig())
//	decision, err := client.Decide(ctx, invocation)
package skillgate

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const (
	defaultSidecarURL = "http://localhost:8910"
	defaultTimeoutMs  = 50
)

// ---- Models -----------------------------------------------------------------

// Actor represents the entity invoking a tool.
type Actor struct {
	Type        string `json:"type"`        // "human" | "agent" | "service"
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	SessionID   string `json:"session_id"`
}

// Agent represents the agent invoking a tool.
type Agent struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	Framework string `json:"framework"`
	TrustTier string `json:"trust_tier"`
}

// Tool represents the tool being invoked.
type Tool struct {
	Name         string   `json:"name"`
	Provider     string   `json:"provider"`
	Capabilities []string `json:"capabilities"`
	RiskClass    string   `json:"risk_class"`
}

// ToolRequest holds the tool call parameters and referenced resources.
type ToolRequest struct {
	Params       map[string]any `json:"params"`
	ResourceRefs []string       `json:"resource_refs"`
}

// ExecutionContext holds environment metadata for the invocation.
type ExecutionContext struct {
	Repo               string `json:"repo"`
	Environment        string `json:"environment"`
	DataClassification string `json:"data_classification"`
	NetworkZone        string `json:"network_zone"`
}

// ToolInvocation is the canonical enforcement request payload.
type ToolInvocation struct {
	InvocationID string          `json:"invocation_id"`
	Timestamp    time.Time       `json:"timestamp"`
	Actor        Actor           `json:"actor"`
	Agent        Agent           `json:"agent"`
	Tool         Tool            `json:"tool"`
	Request      ToolRequest     `json:"request"`
	Context      ExecutionContext `json:"context"`
}

// BudgetStatus represents the remaining budget for a capability.
type BudgetStatus struct {
	Remaining int `json:"remaining"`
	Limit     int `json:"limit"`
}

// DecisionEvidence is the signed attestation attached to a decision.
type DecisionEvidence struct {
	Hash      string `json:"hash"`
	Signature string `json:"signature"`
	KeyID     string `json:"key_id"`
}

// DecisionRecord is the enforcement decision returned by the sidecar.
type DecisionRecord struct {
	InvocationID      string                  `json:"invocation_id"`
	Decision          string                  `json:"decision"` // "ALLOW" | "DENY" | "FAIL" | "REQUIRE_APPROVAL"
	DecisionCode      string                  `json:"decision_code"`
	ReasonCodes       []string                `json:"reason_codes"`
	PolicyVersion     string                  `json:"policy_version"`
	Budgets           map[string]BudgetStatus `json:"budgets"`
	Evidence          DecisionEvidence        `json:"evidence"`
	Degraded          bool                    `json:"degraded"`
	EntitlementVersion string                 `json:"entitlement_version"`
	LicenseMode       string                  `json:"license_mode"`
}

// EnforcerUnavailableError is returned when the sidecar is unreachable and fail_open=false.
type EnforcerUnavailableError struct {
	At time.Time
}

func (e *EnforcerUnavailableError) Error() string {
	return fmt.Sprintf("skillgate: sidecar unreachable at %s (fail-closed)", e.At.Format(time.RFC3339))
}

// ---- Config -----------------------------------------------------------------

// Config holds client configuration.
type Config struct {
	// SidecarURL is the base URL of the SkillGate sidecar.
	// Defaults to SKILLGATE_SIDECAR_URL env var or http://localhost:8910.
	SidecarURL string

	// TimeoutMs is the per-request timeout in milliseconds. Default: 50.
	TimeoutMs int

	// FailOpen allows execution when the sidecar is unreachable.
	// Default false (fail-closed — recommended for production).
	FailOpen bool

	// SLT is the Session License Token for authentication.
	// Defaults to SKILLGATE_SLT env var.
	SLT string
}

// DefaultConfig returns a Config populated from environment variables with
// production-safe defaults.
func DefaultConfig() Config {
	sidecarURL := os.Getenv("SKILLGATE_SIDECAR_URL")
	if sidecarURL == "" {
		sidecarURL = defaultSidecarURL
	}
	return Config{
		SidecarURL: sidecarURL,
		TimeoutMs:  defaultTimeoutMs,
		FailOpen:   false,
		SLT:        os.Getenv("SKILLGATE_SLT"),
	}
}

// ---- Client -----------------------------------------------------------------

// Client is a thread-safe HTTP client for the SkillGate runtime sidecar.
type Client struct {
	cfg        Config
	httpClient *http.Client
}

// New creates a new Client with the given Config.
func New(cfg Config) *Client {
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: time.Duration(cfg.TimeoutMs) * time.Millisecond,
		},
	}
}

func (c *Client) authHeader() string {
	if c.cfg.SLT != "" {
		return "Bearer " + c.cfg.SLT
	}
	return ""
}

func (c *Client) post(ctx context.Context, path string, body any) ([]byte, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("skillgate: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.SidecarURL+path, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("skillgate: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if auth := c.authHeader(); auth != "" {
		req.Header.Set("Authorization", auth)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("skillgate: read response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("skillgate: sidecar returned %d: %s", resp.StatusCode, respBody)
	}
	return respBody, nil
}

func (c *Client) put(ctx context.Context, path string, body any) (int, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return 0, fmt.Errorf("skillgate: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, c.cfg.SidecarURL+path, bytes.NewReader(payload))
	if err != nil {
		return 0, fmt.Errorf("skillgate: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if auth := c.authHeader(); auth != "" {
		req.Header.Set("Authorization", auth)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	return resp.StatusCode, nil
}

func degradedAllow(invocationID string) DecisionRecord {
	return DecisionRecord{
		InvocationID:       invocationID,
		Decision:           "ALLOW",
		DecisionCode:       "SG_ALLOW_DEGRADED_AUDIT_ASYNC",
		ReasonCodes:        []string{"enforcer_unavailable_fail_open"},
		PolicyVersion:      "unknown",
		Budgets:            map[string]BudgetStatus{},
		Evidence:           DecisionEvidence{},
		Degraded:           true,
		EntitlementVersion: "unknown",
		LicenseMode:        "offline",
	}
}

// Decide sends a ToolInvocation to the sidecar for an enforcement decision.
//
// Returns EnforcerUnavailableError if the sidecar is unreachable and FailOpen is false.
func (c *Client) Decide(ctx context.Context, invocation ToolInvocation) (DecisionRecord, error) {
	body := map[string]any{
		"invocation_id":   invocation.InvocationID,
		"tool_invocation": invocation,
	}

	raw, err := c.post(ctx, "/v1/decide", body)
	if err != nil {
		if c.cfg.FailOpen {
			return degradedAllow(invocation.InvocationID), nil
		}
		return DecisionRecord{}, &EnforcerUnavailableError{At: time.Now().UTC()}
	}

	var decision DecisionRecord
	if err := json.Unmarshal(raw, &decision); err != nil {
		return DecisionRecord{}, fmt.Errorf("skillgate: decode decision: %w", err)
	}
	return decision, nil
}

// RegisterTool registers or updates a tool AI-BOM in the sidecar registry.
// Best-effort: returns false on any connectivity failure.
func (c *Client) RegisterTool(ctx context.Context, toolName string, metadata map[string]any) bool {
	status, err := c.put(ctx, "/v1/registry/"+toolName, metadata)
	if err != nil {
		return false
	}
	return status >= 200 && status < 300
}

// Health returns nil if the sidecar is reachable and healthy.
func (c *Client) Health(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.SidecarURL+"/v1/health", nil)
	if err != nil {
		return fmt.Errorf("skillgate: build request: %w", err)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("skillgate: sidecar unreachable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("skillgate: sidecar health check returned %d", resp.StatusCode)
	}
	return nil
}
