import { CapabilityChange } from './types';

export function buildPrChecklist(changes: CapabilityChange[]): string {
  const lines: string[] = [
    '# SkillGate PR Checklist',
    '',
    '## Capability changes',
  ];

  if (changes.length === 0) {
    lines.push('- [x] No capability changes detected');
    lines.push('');
    lines.push('## Reviewer instructions');
    lines.push('- [ ] Verify no policy surface changes were missed');
    return lines.join('\n');
  }

  for (const change of changes) {
    lines.push(`- [ ] ${change.message} (${change.severity})`);
  }

  const hasOutboundExpansion = changes.some(
    (change) => change.capability === 'net.outbound' && change.change === 'added',
  );
  lines.push('');
  lines.push('## Compliance impact');
  lines.push('- [ ] Confirm policy change ticket is linked');
  lines.push('- [ ] Confirm Security reviewer is assigned');
  if (hasOutboundExpansion) {
    lines.push('- [ ] Outbound network expansion reviewed by security lead');
  }
  lines.push('');
  lines.push('## Reviewer instructions');
  lines.push('- [ ] Validate enforcement impact in simulation panel');
  lines.push('- [ ] Ensure approval requirements updated if needed');
  return lines.join('\n');
}
