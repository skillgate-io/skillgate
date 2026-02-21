import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type InstallPlatform = 'macos' | 'linux' | 'windows' | 'wsl';
export type InstallVersionTarget = 'latest' | 'stable' | 'pinned';

export interface InstallChannelSpec {
  tier: string;
  platforms: InstallPlatform[];
  install_latest: string;
  install_stable: string;
  install_pinned: string;
  verify: string;
  uninstall: string;
  upgrade: string;
}

export interface InstallSpec {
  version: string;
  canonical_channel: string;
  version_targets: Record<'latest' | 'stable', string>;
  channels: Record<string, InstallChannelSpec>;
}

function _resolveInstallSpecPath(): string {
  const direct = path.join(process.cwd(), 'docs', 'install-spec.json');
  const sibling = path.join(process.cwd(), '..', 'docs', 'install-spec.json');
  return process.cwd().endsWith('/web-ui') ? sibling : direct;
}

export async function loadInstallSpec(): Promise<InstallSpec> {
  const raw = await readFile(_resolveInstallSpecPath(), 'utf-8');
  const parsed = JSON.parse(raw) as InstallSpec;
  return parsed;
}
