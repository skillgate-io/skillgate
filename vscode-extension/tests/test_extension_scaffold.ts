import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

describe('extension scaffold', () => {
  it('activates on governance surfaces', () => {
    const events = new Set(pkg.activationEvents as string[]);
    expect(events.has('workspaceContains:.skillgate.yml')).toBe(true);
    expect(events.has('workspaceContains:CLAUDE.md')).toBe(true);
    expect(events.has('workspaceContains:AGENTS.md')).toBe(true);
    expect(events.has('workspaceContains:.claude/hooks/**')).toBe(true);
    expect(events.has('workspaceContains:.claude/commands/**')).toBe(true);
    expect(events.has('workspaceContains:MEMORY.md')).toBe(true);
  });

  it('does not declare secret storage settings', () => {
    const settings = Object.keys((pkg.contributes as { configuration: { properties: Record<string, unknown> } }).configuration.properties);
    expect(settings.some((key) => key.toLowerCase().includes('api_key'))).toBe(false);
    expect(settings.some((key) => key.toLowerCase().includes('token'))).toBe(false);
  });

  it('includes production site and SEO metadata', () => {
    expect(pkg.homepage).toBe('https://skillgate.io');
    const keywords = new Set((pkg.keywords as string[]).map((item) => item.toLowerCase()));
    expect(keywords.has('prompt injection')).toBe(true);
    expect(keywords.has('claude code')).toBe(true);
    expect(keywords.has('codex cli')).toBe(true);
  });

  it('exposes onboarding and preflight commands', () => {
    const commands = (
      pkg.contributes as { commands: Array<{ command: string }> }
    ).commands.map((entry) => entry.command);
    expect(commands).toContain('skillgate.openOnboarding');
    expect(commands).toContain('skillgate.preflight.retry');
  });
});
