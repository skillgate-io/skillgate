module SkillGate
  # Raised when the sidecar is unreachable and fail_open is false.
  class EnforcerUnavailableError < StandardError
    attr_reader :at

    def initialize(msg = "SkillGate sidecar unreachable (fail-closed)", at: Time.now.utc)
      @at = at
      super(msg)
    end
  end

  # Raised when the sidecar returns a non-2xx status.
  class SidecarError < StandardError
    attr_reader :status

    def initialize(status, body = "")
      @status = status
      super("SkillGate sidecar returned #{status}: #{body}")
    end
  end
end
