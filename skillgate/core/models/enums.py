"""Enumeration types for SkillGate."""

from enum import Enum


class Severity(str, Enum):
    """Risk severity levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Category(str, Enum):
    """Finding category types."""

    SHELL = "shell"
    NETWORK = "network"
    FILESYSTEM = "filesystem"
    EVAL = "eval"
    CREDENTIAL = "credential"
    INJECTION = "injection"
    OBFUSCATION = "obfuscation"
    PROMPT = "prompt"  # Prompt injection and jailbreak patterns
    COMMAND = "command"  # Dangerous command chains and patterns
    CONFIG = "config"  # Configuration security issues


class Language(str, Enum):
    """Supported programming languages."""

    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    SHELL = "shell"
    GO = "go"
    RUST = "rust"
    RUBY = "ruby"
    UNKNOWN = "unknown"
