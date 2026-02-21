#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const docsDir = path.resolve(process.cwd(), 'src', 'app', 'docs');

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) list.push(full);
  }
  return list;
}

const files = walk(docsDir);
const issues = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const blockPattern = /code=\{`([\s\S]*?)`}\s*\/?>/g;
  let match;
  while ((match = blockPattern.exec(text)) !== null) {
    const snippet = match[1].trim();
    const lines = snippet.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      issues.push(`${path.relative(process.cwd(), file)} has an empty code block`);
      continue;
    }

    for (const line of lines) {
      if (/todo|fixme|lorem ipsum/i.test(line)) {
        issues.push(`${path.relative(process.cwd(), file)} has placeholder content: ${line}`);
      }
      if (line.length > 140) {
        issues.push(`${path.relative(process.cwd(), file)} has too long snippet line (${line.length})`);
      }
    }
  }
}

if (issues.length > 0) {
  console.error('Doc snippet checks failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('Doc snippets check passed');
