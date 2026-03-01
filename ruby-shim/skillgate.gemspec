Gem::Specification.new do |spec|
  spec.name          = "skillgate"
  spec.version       = "0.1.0"
  spec.authors       = ["SkillGate"]
  spec.summary       = "Ruby HTTP client for the SkillGate runtime sidecar"
  spec.description   = "Thin HTTP client for integrating SkillGate enforcement into Ruby agent frameworks and CI/CD tools."
  spec.homepage      = "https://github.com/skillgate-io/skillgate-ruby"
  spec.license       = "SEE LICENSE IN LICENSE"

  spec.required_ruby_version = ">= 2.6"
  spec.files = Dir["lib/**/*.rb"]
  spec.require_paths = ["lib"]

  spec.metadata["source_code_uri"] = spec.homepage
end
