require "net/http"
require "uri"
require "json"
require "time"

require_relative "errors"
require_relative "models"

module SkillGate
  DEFAULT_SIDECAR_URL = "http://localhost:8910"
  DEFAULT_TIMEOUT_MS  = 50

  # Configuration for the SkillGate client.
  Config = Struct.new(
    :sidecar_url,  # String  — default: SKILLGATE_SIDECAR_URL or http://localhost:8910
    :timeout_ms,   # Integer — default: 50
    :fail_open,    # Boolean — default: false
    :slt,          # String? — Session License Token (SKILLGATE_SLT env var)
    keyword_init: true
  ) do
    # Build configuration from environment variables with production-safe defaults.
    def self.from_env
      url = ENV.fetch("SKILLGATE_SIDECAR_URL", DEFAULT_SIDECAR_URL)
      slt = ENV["SKILLGATE_SLT"]
      new(sidecar_url: url, timeout_ms: DEFAULT_TIMEOUT_MS, fail_open: false, slt: slt)
    end
  end

  # Thread-safe HTTP client for the SkillGate runtime sidecar.
  #
  # @example
  #   client = SkillGate::Client.new(SkillGate::Config.from_env)
  #   decision = client.decide(invocation)
  #   raise "Denied: #{decision.decision_code}" unless decision.allowed?
  class Client
    def initialize(config = Config.from_env)
      @cfg = config
      @uri = URI.parse(@cfg.sidecar_url)
      @mutex = Mutex.new
    end

    # Send a ToolInvocation to the sidecar for an enforcement decision.
    #
    # @param invocation [SkillGate::ToolInvocation]
    # @return [SkillGate::DecisionRecord]
    # @raise [SkillGate::EnforcerUnavailableError] if sidecar unreachable and fail_open is false
    def decide(invocation)
      body = JSON.generate({
        "invocation_id"   => invocation.invocation_id,
        "tool_invocation" => invocation.to_h,
      })
      response = post("/v1/decide", body)
      parse_decision(response)
    rescue EnforcerUnavailableError
      raise unless @cfg.fail_open
      degraded_allow(invocation.invocation_id)
    end

    # Register or update a tool AI-BOM in the sidecar registry.
    # Best-effort — returns false on any connectivity failure.
    #
    # @param tool_name [String]
    # @param metadata  [Hash]
    # @return [Boolean]
    def register_tool(tool_name, metadata)
      put("/v1/registry/#{tool_name}", JSON.generate(metadata))
      true
    rescue StandardError
      false
    end

    # Returns true if the sidecar is reachable and healthy.
    #
    # @return [Boolean]
    def healthy?
      response = get("/v1/health")
      response.is_a?(Net::HTTPSuccess)
    rescue StandardError
      false
    end

    private

    def timeout_seconds
      @cfg.timeout_ms / 1000.0
    end

    def auth_headers
      return {} unless @cfg.slt && !@cfg.slt.empty?
      { "Authorization" => "Bearer #{@cfg.slt}" }
    end

    def build_http
      http = Net::HTTP.new(@uri.host, @uri.port)
      http.use_ssl = @uri.scheme == "https"
      http.open_timeout = timeout_seconds
      http.read_timeout = timeout_seconds
      http
    end

    def post(path, body)
      http = build_http
      req  = Net::HTTP::Post.new(path, { "Content-Type" => "application/json" }.merge(auth_headers))
      req.body = body
      resp = http.request(req)
      raise SidecarError.new(resp.code.to_i, resp.body) unless resp.is_a?(Net::HTTPSuccess)
      resp
    rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNREFUSED, SocketError => e
      raise EnforcerUnavailableError.new("Sidecar unreachable: #{e.message}")
    end

    def put(path, body)
      http = build_http
      req  = Net::HTTP::Put.new(path, { "Content-Type" => "application/json" }.merge(auth_headers))
      req.body = body
      http.request(req)
    rescue StandardError
      nil
    end

    def get(path)
      build_http.get(path)
    rescue StandardError
      nil
    end

    def parse_decision(response)
      data = JSON.parse(response.body)
      budgets = (data["budgets"] || {}).transform_values do |b|
        BudgetStatus.new(remaining: b["remaining"], limit: b["limit"])
      end
      ev = data["evidence"] || {}
      evidence = DecisionEvidence.new(
        hash: ev["hash"] || "", signature: ev["signature"] || "", key_id: ev["key_id"] || ""
      )
      DecisionRecord.new(
        invocation_id:      data["invocation_id"],
        decision:           data["decision"],
        decision_code:      data["decision_code"],
        reason_codes:       data["reason_codes"] || [],
        policy_version:     data["policy_version"],
        budgets:            budgets,
        evidence:           evidence,
        degraded:           data["degraded"] || false,
        entitlement_version: data["entitlement_version"],
        license_mode:       data["license_mode"],
      )
    end

    def degraded_allow(invocation_id)
      DecisionRecord.new(
        invocation_id:       invocation_id,
        decision:            "ALLOW",
        decision_code:       "SG_ALLOW_DEGRADED_AUDIT_ASYNC",
        reason_codes:        ["enforcer_unavailable_fail_open"],
        policy_version:      "unknown",
        budgets:             {},
        evidence:            DecisionEvidence.new(hash: "", signature: "", key_id: ""),
        degraded:            true,
        entitlement_version: "unknown",
        license_mode:        "offline",
      )
    end
  end
end
