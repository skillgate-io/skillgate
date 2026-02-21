# Homebrew Formula for SkillGate CLI
#
# To install:
#   brew tap skillgate/tap
#   brew install skillgate
#
# Or directly:
#   brew install skillgate/tap/skillgate

class Skillgate < Formula
  desc "CI/CD policy enforcement tool for agent skills security"
  homepage "https://skillgate.io"
  version "1.0.0"
  license "MIT"

  # Binary releases
  if Hardware::CPU.intel?
    url "https://github.com/skillgate/skillgate/releases/download/v#{version}/skillgate-macos-x86_64"
    sha256 "TODO: Add SHA256 hash for x86_64 binary"
  else
    url "https://github.com/skillgate/skillgate/releases/download/v#{version}/skillgate-macos-arm64"
    sha256 "TODO: Add SHA256 hash for arm64 binary"
  end

  head do
    url "https://github.com/skillgate/skillgate.git", branch: "main"
    depends_on "python@3.12" => :build
    depends_on "rust" => :build  # For tree-sitter compilation
  end

  def install
    if build.head?
      # Build from source
      system "python3", "-m", "pip", "install", "build"
      system "python3", "-m", "build", "--wheel"
      system "python3", "-m", "pip", "install", *std_pip_args(prefix: true), "."
    else
      # Install pre-built binary
      bin.install "skillgate-macos-#{Hardware::CPU.intel? ? 'x86_64' : 'arm64'}" => "skillgate"
    end
  end

  test do
    # Test version command
    assert_match "skillgate #{version}", shell_output("#{bin}/skillgate version")

    # Test help command
    assert_match "Scan agent skills for security risks", shell_output("#{bin}/skillgate --help")
  end

  # Post-install message
  def caveats
    <<~EOS
      SkillGate CLI installed successfully!

      Next steps:
        1. Run 'skillgate login' to authenticate
        2. Run 'skillgate scan ./your-skill' to scan a skill
        3. Run 'skillgate --help' for more commands

      For CI/CD usage, set SKILLGATE_API_KEY environment variable.
    EOS
  end
end
