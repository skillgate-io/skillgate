import { CapabilityChange } from './types';

const CAPABILITY_PATTERN = /\b(shell\.exec|net\.outbound|fs\.write|fs\.read|eval\.exec)\b\s*:\s*([^\n]+)/g;

function parseCapabilities(text: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of text.matchAll(CAPABILITY_PATTERN)) {
    found.set(match[1], match[2].trim());
  }
  return found;
}

export function detectCapabilityDiff(base: string, current: string): CapabilityChange[] {
  const changes: CapabilityChange[] = [];
  const before = parseCapabilities(base);
  const after = parseCapabilities(current);

  for (const [capability, value] of after.entries()) {
    if (!before.has(capability)) {
      changes.push({
        capability,
        change: 'added',
        severity: capability === 'net.outbound' && value.includes('*') ? 'error' : 'warning',
        message: `Capability added: ${capability}`,
      });
      continue;
    }
    const previous = before.get(capability);
    if (previous === value) {
      continue;
    }
    const expanded = value.includes('*') || value.length > (previous?.length ?? 0);
    changes.push({
      capability,
      change: 'added',
      severity: expanded ? 'error' : 'warning',
      message: `Capability changed: ${capability} (${previous} -> ${value})`,
    });
  }

  for (const capability of before.keys()) {
    if (after.has(capability)) {
      continue;
    }
    changes.push({
      capability,
      change: 'removed',
      severity: 'info',
      message: `Capability removed: ${capability}`,
    });
  }

  return changes;
}
