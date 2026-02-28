require "minitest/autorun"
require "webrick"
require "json"
require "thread"

$LOAD_PATH.unshift File.join(__dir__, "../lib")
require "skillgate"

module SkillGate
  # Minimal WEBrick stub server for testing
  class TestServer
    attr_reader :port

    def initialize(routes)
      @port   = rand(50_000..60_000)
      @routes = routes
      @server = WEBrick::HTTPServer.new(
        Port:          @port,
        Logger:        WEBrick::Log.new(File::NULL),
        AccessLog:     [],
        DoNotReverseLookup: true,
      )
      @routes.each do |pattern, handler|
        @server.mount_proc("/") { |req, res| dispatch(req, res, pattern, handler) }
      end
    end

    def dispatch(req, res, _pattern, handler)
      body, status = handler.call(req)
      res.status = status || 200
      res["Content-Type"] = "application/json"
      res.body = body.is_a?(Hash) ? JSON.generate(body) : body.to_s
    end

    def start
      @thread = Thread.new { @server.start }
      sleep 0.05 # brief settle time
      self
    end

    def stop
      @server.shutdown
      @thread&.join
    end
  end

  ALLOW_RESPONSE = {
    "invocation_id"      => "inv-001",
    "decision"           => "ALLOW",
    "decision_code"      => "SG_ALLOW",
    "reason_codes"       => [],
    "policy_version"     => "1.0.0",
    "budgets"            => {},
    "evidence"           => { "hash" => "abc", "signature" => "sig", "key_id" => "key1" },
    "degraded"           => false,
    "entitlement_version" => "1.0",
    "license_mode"       => "online",
  }.freeze

  def self.sample_invocation
    ToolInvocation.new(
      invocation_id: "inv-001",
      timestamp:     Time.now.utc,
      actor:    Actor.new(type: "agent", id: "agent-1", workspace_id: "ws-1", session_id: "sess-1"),
      agent:    Agent.new(name: "my-agent", version: "1.0.0", framework: "custom", trust_tier: "standard"),
      tool:     Tool.new(name: "fs.read", provider: "local", capabilities: ["fs.read"], risk_class: "low"),
      request:  ToolRequest.new,
      context:  ExecutionContext.new(repo: "my-repo", environment: "dev",
                                     data_classification: "internal", network_zone: "private"),
    )
  end

  class TestClientDecide < Minitest::Test
    def setup
      @srv = TestServer.new({ "/" => ->(_req) { [ALLOW_RESPONSE, 200] } }).start
      @cfg = Config.new(sidecar_url: "http://localhost:#{@srv.port}", timeout_ms: 500, fail_open: false, slt: nil)
      @client = Client.new(@cfg)
    end

    def teardown
      @srv.stop
    end

    def test_decide_allow
      decision = @client.decide(SkillGate.sample_invocation)
      assert_equal "ALLOW", decision.decision
      assert_equal "SG_ALLOW", decision.decision_code
      refute decision.degraded?
      assert decision.allowed?
    end
  end

  class TestClientFailClosed < Minitest::Test
    def test_raises_enforcer_unavailable
      cfg = Config.new(sidecar_url: "http://127.0.0.1:19999", timeout_ms: 100, fail_open: false, slt: nil)
      client = Client.new(cfg)
      assert_raises(EnforcerUnavailableError) { client.decide(SkillGate.sample_invocation) }
    end
  end

  class TestClientFailOpen < Minitest::Test
    def test_returns_degraded_allow
      cfg = Config.new(sidecar_url: "http://127.0.0.1:19999", timeout_ms: 100, fail_open: true, slt: nil)
      client = Client.new(cfg)
      decision = client.decide(SkillGate.sample_invocation)
      assert decision.degraded?
      assert_equal "SG_ALLOW_DEGRADED_AUDIT_ASYNC", decision.decision_code
    end
  end

  class TestClientRegisterTool < Minitest::Test
    def setup
      @srv = TestServer.new({ "/" => ->(_req) { ["", 200] } }).start
      @cfg = Config.new(sidecar_url: "http://localhost:#{@srv.port}", timeout_ms: 500, fail_open: false, slt: nil)
      @client = Client.new(@cfg)
    end

    def teardown
      @srv.stop
    end

    def test_register_tool_returns_true
      assert @client.register_tool("my-tool", { "version" => "1.0" })
    end
  end

  class TestClientHealth < Minitest::Test
    def setup
      @srv = TestServer.new({ "/" => ->(_req) { ["ok", 200] } }).start
      @cfg = Config.new(sidecar_url: "http://localhost:#{@srv.port}", timeout_ms: 500, fail_open: false, slt: nil)
      @client = Client.new(@cfg)
    end

    def teardown
      @srv.stop
    end

    def test_healthy_returns_true
      assert @client.healthy?
    end
  end
end
