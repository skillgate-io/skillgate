//! SkillGate runtime sidecar HTTP client for Rust.
//!
//! # Example
//!
//! ```rust,no_run
//! use skillgate::{Client, Config, ToolInvocation, Actor, Agent, Tool, ToolRequest, ExecutionContext};
//! use chrono::Utc;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), skillgate::Error> {
//!     let client = Client::new(Config::from_env());
//!
//!     let decision = client.decide(ToolInvocation {
//!         invocation_id: "inv-001".into(),
//!         timestamp: Utc::now(),
//!         actor: Actor { type_: "agent".into(), id: "agent-1".into(),
//!                         workspace_id: "ws-1".into(), session_id: "sess-1".into() },
//!         agent: Agent { name: "my-agent".into(), version: "1.0.0".into(),
//!                         framework: "custom".into(), trust_tier: "standard".into() },
//!         tool: Tool { name: "fs.read".into(), provider: "local".into(),
//!                       capabilities: vec!["fs.read".into()], risk_class: "low".into() },
//!         request: ToolRequest { params: Default::default(), resource_refs: vec![] },
//!         context: ExecutionContext { repo: "my-repo".into(), environment: "dev".into(),
//!                                     data_classification: "internal".into(), network_zone: "private".into() },
//!     }).await?;
//!
//!     println!("Decision: {}", decision.decision);
//!     Ok(())
//! }
//! ```

use std::collections::HashMap;
use std::time::Duration;

use chrono::{DateTime, Utc};
use reqwest::{Client as HttpClient, StatusCode};
use serde::{Deserialize, Serialize};
use thiserror::Error;

// ---- Errors -----------------------------------------------------------------

/// Errors returned by the SkillGate client.
#[derive(Debug, Error)]
pub enum Error {
    #[error("sidecar unreachable (fail-closed): {0}")]
    EnforcerUnavailable(String),

    #[error("sidecar returned error status {0}: {1}")]
    SidecarError(u16, String),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
}

// ---- Models -----------------------------------------------------------------

/// Actor invoking the tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Actor {
    #[serde(rename = "type")]
    pub type_: String,
    pub id: String,
    pub workspace_id: String,
    pub session_id: String,
}

/// Agent metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub name: String,
    pub version: String,
    pub framework: String,
    pub trust_tier: String,
}

/// Tool metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub provider: String,
    pub capabilities: Vec<String>,
    pub risk_class: String,
}

/// Tool call parameters and resource references.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ToolRequest {
    pub params: HashMap<String, serde_json::Value>,
    pub resource_refs: Vec<String>,
}

/// Execution environment metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub repo: String,
    pub environment: String,
    pub data_classification: String,
    pub network_zone: String,
}

/// Canonical enforcement request payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInvocation {
    pub invocation_id: String,
    pub timestamp: DateTime<Utc>,
    pub actor: Actor,
    pub agent: Agent,
    pub tool: Tool,
    pub request: ToolRequest,
    pub context: ExecutionContext,
}

/// Budget snapshot for a single capability.
#[derive(Debug, Clone, Deserialize)]
pub struct BudgetStatus {
    pub remaining: u64,
    pub limit: u64,
}

/// Signed attestation evidence.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct DecisionEvidence {
    pub hash: String,
    pub signature: String,
    pub key_id: String,
}

/// Enforcement decision returned by the sidecar.
#[derive(Debug, Clone, Deserialize)]
pub struct DecisionRecord {
    pub invocation_id: String,
    /// "ALLOW" | "DENY" | "FAIL" | "REQUIRE_APPROVAL"
    pub decision: String,
    pub decision_code: String,
    pub reason_codes: Vec<String>,
    pub policy_version: String,
    pub budgets: HashMap<String, BudgetStatus>,
    pub evidence: DecisionEvidence,
    pub degraded: bool,
    pub entitlement_version: String,
    pub license_mode: String,
}

// ---- Config -----------------------------------------------------------------

/// Client configuration.
#[derive(Debug, Clone)]
pub struct Config {
    /// Sidecar base URL. Default: `http://localhost:8910`.
    pub sidecar_url: String,
    /// Per-request timeout. Default: 50 ms.
    pub timeout: Duration,
    /// When true, return a degraded ALLOW on sidecar failure instead of an error.
    pub fail_open: bool,
    /// Session License Token for Authorization header.
    pub slt: Option<String>,
}

impl Config {
    /// Build configuration from environment variables with production-safe defaults.
    pub fn from_env() -> Self {
        let sidecar_url = std::env::var("SKILLGATE_SIDECAR_URL")
            .unwrap_or_else(|_| "http://localhost:8910".into());
        let slt = std::env::var("SKILLGATE_SLT").ok();
        Self {
            sidecar_url,
            timeout: Duration::from_millis(50),
            fail_open: false,
            slt,
        }
    }
}

// ---- Client -----------------------------------------------------------------

/// Async HTTP client for the SkillGate runtime sidecar.
pub struct Client {
    cfg: Config,
    http: HttpClient,
}

impl Client {
    /// Create a new client with the given config.
    pub fn new(cfg: Config) -> Self {
        let http = HttpClient::builder()
            .timeout(cfg.timeout)
            .build()
            .expect("failed to build HTTP client");
        Self { cfg, http }
    }

    fn auth_header(&self) -> Option<String> {
        self.cfg.slt.as_ref().map(|t| format!("Bearer {t}"))
    }

    fn degraded_allow(invocation_id: &str) -> DecisionRecord {
        DecisionRecord {
            invocation_id: invocation_id.to_string(),
            decision: "ALLOW".into(),
            decision_code: "SG_ALLOW_DEGRADED_AUDIT_ASYNC".into(),
            reason_codes: vec!["enforcer_unavailable_fail_open".into()],
            policy_version: "unknown".into(),
            budgets: HashMap::new(),
            evidence: DecisionEvidence::default(),
            degraded: true,
            entitlement_version: "unknown".into(),
            license_mode: "offline".into(),
        }
    }

    /// Send a `ToolInvocation` to the sidecar for an enforcement decision.
    ///
    /// Returns [`Error::EnforcerUnavailable`] if the sidecar is unreachable and
    /// `fail_open` is `false`.
    pub async fn decide(&self, invocation: ToolInvocation) -> Result<DecisionRecord, Error> {
        let body = serde_json::json!({
            "invocation_id": invocation.invocation_id,
            "tool_invocation": invocation,
        });

        let mut req = self
            .http
            .post(format!("{}/v1/decide", self.cfg.sidecar_url))
            .json(&body);

        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Err(e) => {
                if self.cfg.fail_open {
                    return Ok(Self::degraded_allow(&body["invocation_id"].as_str().unwrap_or("")));
                }
                Err(Error::EnforcerUnavailable(e.to_string()))
            }
            Ok(resp) => {
                let status = resp.status();
                if !status.is_success() {
                    let text = resp.text().await.unwrap_or_default();
                    return Err(Error::SidecarError(status.as_u16(), text));
                }
                let record: DecisionRecord = resp.json().await?;
                Ok(record)
            }
        }
    }

    /// Register or update a tool AI-BOM in the sidecar registry.
    /// Best-effort — returns `false` on any connectivity failure.
    pub async fn register_tool(
        &self,
        tool_name: &str,
        metadata: &HashMap<String, serde_json::Value>,
    ) -> bool {
        let mut req = self
            .http
            .put(format!("{}/v1/registry/{tool_name}", self.cfg.sidecar_url))
            .json(metadata);

        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        req.send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    /// Returns `Ok(())` if the sidecar is reachable and healthy.
    pub async fn health(&self) -> Result<(), Error> {
        let resp = self
            .http
            .get(format!("{}/v1/health", self.cfg.sidecar_url))
            .send()
            .await?;

        if resp.status() != StatusCode::OK {
            return Err(Error::SidecarError(resp.status().as_u16(), String::new()));
        }
        Ok(())
    }
}

// ---- Tests ------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn sample_invocation() -> ToolInvocation {
        ToolInvocation {
            invocation_id: "inv-001".into(),
            timestamp: Utc::now(),
            actor: Actor {
                type_: "agent".into(),
                id: "agent-1".into(),
                workspace_id: "ws-1".into(),
                session_id: "sess-1".into(),
            },
            agent: Agent {
                name: "my-agent".into(),
                version: "1.0.0".into(),
                framework: "custom".into(),
                trust_tier: "standard".into(),
            },
            tool: Tool {
                name: "fs.read".into(),
                provider: "local".into(),
                capabilities: vec!["fs.read".into()],
                risk_class: "low".into(),
            },
            request: ToolRequest::default(),
            context: ExecutionContext {
                repo: "my-repo".into(),
                environment: "dev".into(),
                data_classification: "internal".into(),
                network_zone: "private".into(),
            },
        }
    }

    fn decision_body() -> serde_json::Value {
        serde_json::json!({
            "invocation_id": "inv-001",
            "decision": "ALLOW",
            "decision_code": "SG_ALLOW",
            "reason_codes": [],
            "policy_version": "1.0.0",
            "budgets": {},
            "evidence": {"hash": "abc", "signature": "sig", "key_id": "key1"},
            "degraded": false,
            "entitlement_version": "1.0",
            "license_mode": "online",
        })
    }

    #[tokio::test]
    async fn test_decide_allow() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v1/decide"))
            .respond_with(ResponseTemplate::new(200).set_body_json(decision_body()))
            .mount(&server)
            .await;

        let mut cfg = Config::from_env();
        cfg.sidecar_url = server.uri();
        let client = Client::new(cfg);

        let decision = client.decide(sample_invocation()).await.unwrap();
        assert_eq!(decision.decision, "ALLOW");
        assert_eq!(decision.decision_code, "SG_ALLOW");
    }

    #[tokio::test]
    async fn test_fail_closed() {
        let mut cfg = Config::from_env();
        cfg.sidecar_url = "http://127.0.0.1:19999".into();
        cfg.timeout = Duration::from_millis(10);
        cfg.fail_open = false;
        let client = Client::new(cfg);

        let result = client.decide(sample_invocation()).await;
        assert!(matches!(result, Err(Error::EnforcerUnavailable(_))));
    }

    #[tokio::test]
    async fn test_fail_open() {
        let mut cfg = Config::from_env();
        cfg.sidecar_url = "http://127.0.0.1:19999".into();
        cfg.timeout = Duration::from_millis(10);
        cfg.fail_open = true;
        let client = Client::new(cfg);

        let decision = client.decide(sample_invocation()).await.unwrap();
        assert!(decision.degraded);
        assert_eq!(decision.decision_code, "SG_ALLOW_DEGRADED_AUDIT_ASYNC");
    }
}
