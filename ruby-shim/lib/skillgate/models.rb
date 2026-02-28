module SkillGate
  # All model structs use keyword_init so they serialize cleanly to/from JSON.

  Actor = Struct.new(:type, :id, :workspace_id, :session_id, keyword_init: true) do
    def to_h
      super.transform_keys(&:to_s)
    end
  end

  Agent = Struct.new(:name, :version, :framework, :trust_tier, keyword_init: true) do
    def to_h
      super.transform_keys(&:to_s)
    end
  end

  Tool = Struct.new(:name, :provider, :capabilities, :risk_class, keyword_init: true) do
    def to_h
      super.transform_keys(&:to_s)
    end
  end

  ToolRequest = Struct.new(:params, :resource_refs, keyword_init: true) do
    def initialize(params: {}, resource_refs: [])
      super
    end

    def to_h
      super.transform_keys(&:to_s)
    end
  end

  ExecutionContext = Struct.new(:repo, :environment, :data_classification, :network_zone, keyword_init: true) do
    def to_h
      super.transform_keys(&:to_s)
    end
  end

  # Canonical enforcement request payload.
  ToolInvocation = Struct.new(
    :invocation_id, :timestamp, :actor, :agent, :tool, :request, :context,
    keyword_init: true
  ) do
    def to_h
      {
        "invocation_id" => invocation_id,
        "timestamp"     => timestamp.respond_to?(:iso8601) ? timestamp.iso8601 : timestamp.to_s,
        "actor"         => actor.to_h,
        "agent"         => agent.to_h,
        "tool"          => tool.to_h,
        "request"       => request.to_h,
        "context"       => context.to_h,
      }
    end
  end

  # Budget snapshot returned in a DecisionRecord.
  BudgetStatus = Struct.new(:remaining, :limit, keyword_init: true)

  # Evidence attached to a DecisionRecord.
  DecisionEvidence = Struct.new(:hash, :signature, :key_id, keyword_init: true)

  # Enforcement decision returned by the sidecar.
  DecisionRecord = Struct.new(
    :invocation_id, :decision, :decision_code, :reason_codes,
    :policy_version, :budgets, :evidence, :degraded,
    :entitlement_version, :license_mode,
    keyword_init: true
  ) do
    def allowed?
      decision == "ALLOW"
    end

    def denied?
      decision == "DENY"
    end

    def degraded?
      degraded == true
    end
  end
end
