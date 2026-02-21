#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const docsDir = path.resolve(process.cwd(), 'docs');

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (entry.isFile() && entry.name.endsWith('.md')) list.push(full);
  }
  return list;
}

if (!fs.existsSync(docsDir)) {
  console.log('No markdown docs directory found at web-ui/docs, skipping markdown lint');
  process.exit(0);
}

const files = walk(docsDir);
const issues = [];

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let lastHeadingLevel = 0;

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    if (/\s+$/.test(line)) {
      issues.push(`${path.relative(process.cwd(), file)}:${lineNo} trailing spaces`);
    }

    if (line.includes('\t')) {
      issues.push(`${path.relative(process.cwd(), file)}:${lineNo} tab character found`);
    }

    const heading = line.match(/^(#{1,6})\s+.+/);
    if (heading) {
      const level = heading[1].length;
      if (lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
        issues.push(`${path.relative(process.cwd(), file)}:${lineNo} heading level jumps from h${lastHeadingLevel} to h${level}`);
      }
      lastHeadingLevel = level;
    }
  });
}

if (issues.length > 0) {
  console.error('Markdown lint failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`Markdown lint passed (${files.length} files)`);
