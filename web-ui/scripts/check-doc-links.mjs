#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(process.cwd(), 'src', 'app');
const docsRoot = path.resolve(appRoot, 'docs');

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, list);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      list.push(full);
    }
  }
  return list;
}

function routeFromPageFile(filePath) {
  const relative = path.relative(appRoot, filePath);
  if (!relative.endsWith('/page.tsx')) return null;
  const route = `/${relative.replace(/\/page\.tsx$/, '').replace(/\\/g, '/')}`;
  return route === '/index' ? '/' : route;
}

const pageFiles = walk(appRoot).filter((file) => file.endsWith('/page.tsx'));
const validRoutes = new Set(pageFiles.map(routeFromPageFile).filter(Boolean));
validRoutes.add('/');

const docsFiles = walk(docsRoot).concat(walk(path.resolve(process.cwd(), 'src', 'components', 'docs')));
const hrefRegex = /href\s*[:=]\s*["'`]([^"'`]+)["'`]/g;

const failures = [];
for (const filePath of docsFiles) {
  const text = fs.readFileSync(filePath, 'utf8');
  let match;
  while ((match = hrefRegex.exec(text)) !== null) {
    const href = match[1];
    if (!href.startsWith('/')) continue;
    if (href.startsWith('//')) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    if (!validRoutes.has(clean)) {
      failures.push(`${path.relative(process.cwd(), filePath)} -> ${href}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Broken internal doc links found:');
  for (const line of failures) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log('Doc links check passed');
