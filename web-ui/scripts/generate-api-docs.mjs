#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(process.cwd(), '..', 'docs', 'openapi', 'skillgate-openapi.json');
const outPath = path.resolve(process.cwd(), 'src', 'generated', 'api-reference.ts');

if (!fs.existsSync(sourcePath)) {
  console.error(`Missing OpenAPI artifact at ${sourcePath}`);
  process.exit(1);
}

const raw = fs.readFileSync(sourcePath, 'utf8');
const spec = JSON.parse(raw);
const sourceHash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);

const entries = [];
for (const [route, methods] of Object.entries(spec.paths ?? {})) {
  for (const [method, details] of Object.entries(methods ?? {})) {
    entries.push({
      path: route,
      method: method.toUpperCase(),
      summary: details.summary ?? 'No summary provided',
      operationId: details.operationId ?? `${method}_${route}`,
    });
  }
}

entries.sort((a, b) => {
  if (a.path === b.path) return a.method.localeCompare(b.method);
  return a.path.localeCompare(b.path);
});

const content = `/* AUTO-GENERATED FILE. Run: npm run docs:api:sync */
export const API_INFO = {
  title: ${JSON.stringify(spec.info?.title ?? 'SkillGate API')},
  version: ${JSON.stringify(spec.info?.version ?? '1.0.0')},
  server: ${JSON.stringify(spec.servers?.[0]?.url ?? 'https://api.skillgate.io/api/v1')},
  specHash: ${JSON.stringify(sourceHash)}
} as const;

export const API_ENDPOINTS = ${JSON.stringify(entries, null, 2)} as const;
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content, 'utf8');
console.log(`Wrote ${outPath}`);
