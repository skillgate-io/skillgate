#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

/**
 * Optional npm wrapper for the Python-native SkillGate CLI.
 *
 * Fail-closed behavior:
 * - Do not auto-install Python or SkillGate.
 * - Exit with actionable guidance if prerequisites are missing.
 */

const userArgs = process.argv.slice(2);
const envPython = process.env.SKILLGATE_PYTHON;

const candidates = [];
if (envPython && envPython.trim()) {
  candidates.push({ cmd: envPython.trim(), prefix: [] });
}
candidates.push({ cmd: 'python3', prefix: [] });
candidates.push({ cmd: 'python', prefix: [] });
if (process.platform === 'win32') {
  candidates.push({ cmd: 'py', prefix: ['-3'] });
}

function probePythonWithSkillgate(candidate) {
  const probeArgs = [...candidate.prefix, '-c', 'import skillgate'];
  const result = spawnSync(candidate.cmd, probeArgs, {
    stdio: 'ignore',
    env: process.env,
  });
  if (result.error) return false;
  return result.status === 0;
}

const selected = candidates.find(probePythonWithSkillgate);

if (!selected) {
  process.stderr.write(
    [
      '[skillgate-npm-shim] SkillGate Python runtime not found.',
      'Install canonical runtime first:',
      '  pipx install skillgate',
      'or',
      '  python -m pip install --upgrade skillgate',
      'Then re-run: skillgate <args>',
      '',
      'Optional override:',
      '  SKILLGATE_PYTHON=/path/to/python skillgate <args>',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const runArgs = [...selected.prefix, '-m', 'skillgate.cli.app', ...userArgs];
const runResult = spawnSync(selected.cmd, runArgs, {
  stdio: 'inherit',
  env: process.env,
});

if (runResult.error) {
  process.stderr.write(
    `[skillgate-npm-shim] Failed to execute Python runtime: ${runResult.error.message}\n`,
  );
  process.exit(1);
}

if (typeof runResult.status === 'number') {
  process.exit(runResult.status);
}

process.exit(1);
