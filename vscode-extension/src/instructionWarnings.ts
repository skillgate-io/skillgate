import { InstructionWarning } from './types';

const PATTERNS: Array<{ category: InstructionWarning['category']; label: string; regex: RegExp }> = [
  {
    category: 'jailbreak',
    label: 'Jailbreak pattern detected',
    regex: /\b(ignore\s+(all\s+)?(previous|prior)\s+instructions|DAN|developer\s+mode|jailbreak)\b/i,
  },
  {
    category: 'capability-override',
    label: 'Capability override pattern detected',
    regex: /\b(always\s+allow|override\s+policy|execute\s+unrestricted|access\s+to\s+all\s+tools)\b/i,
  },
  {
    category: 'exfiltration',
    label: 'Data exfiltration pattern detected',
    regex: /\b(exfiltrat(e|ion)|send\s+all\s+file\s+contents\s+to|upload\s+secrets|echo\s+\*\s+to)\b/i,
  },
];

export function detectInstructionWarnings(text: string): InstructionWarning[] {
  const warnings: InstructionWarning[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const pattern of PATTERNS) {
      const match = line.match(pattern.regex);
      if (!match) {
        continue;
      }
      warnings.push({
        line: index + 1,
        category: pattern.category,
        message: pattern.label,
        snippet: match[0],
      });
    }
  });
  return warnings;
}
