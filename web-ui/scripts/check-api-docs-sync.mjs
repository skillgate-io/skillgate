#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const cwd = process.cwd();
const generatedPath = path.resolve(cwd, 'src', 'generated', 'api-reference.ts');
const backupPath = `${generatedPath}.bak`;

const before = fs.existsSync(generatedPath) ? fs.readFileSync(generatedPath, 'utf8') : '';
if (fs.existsSync(generatedPath)) {
  fs.writeFileSync(backupPath, before, 'utf8');
}

execFileSync('node', [path.resolve(cwd, 'scripts', 'generate-api-docs.mjs')], {
  stdio: 'inherit',
});

const after = fs.existsSync(generatedPath) ? fs.readFileSync(generatedPath, 'utf8') : '';

if (before !== after) {
  console.error('API docs are out of sync with docs/openapi/skillgate-openapi.json');
  if (fs.existsSync(backupPath)) {
    fs.writeFileSync(generatedPath, fs.readFileSync(backupPath, 'utf8'), 'utf8');
    fs.unlinkSync(backupPath);
  }
  process.exit(1);
}

if (fs.existsSync(backupPath)) {
  fs.unlinkSync(backupPath);
}
console.log('API docs sync check passed');
