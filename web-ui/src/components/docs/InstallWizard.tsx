'use client';

import React from 'react';
import { useMemo, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { CodeBlock } from '@/components/docs/CodeBlock';
import type { InstallPlatform, InstallSpec, InstallVersionTarget } from '@/lib/install-spec';

const PLATFORM_LABELS: Record<InstallPlatform, string> = {
  macos: 'macOS',
  linux: 'Linux',
  windows: 'Windows',
  wsl: 'WSL',
};

const CHANNEL_LABELS: Record<string, string> = {
  pipx: 'Python via pipx',
  pypi: 'Python via pip',
  homebrew: 'Homebrew',
  winget: 'WinGet',
  npm_shim: 'NPX / npm',
};

export function resolveInstallCommand(
  spec: InstallSpec,
  channelKey: string,
  versionTarget: InstallVersionTarget,
  pinnedVersion: string,
): string {
  const channel = spec.channels[channelKey];
  if (!channel) return '';
  if (versionTarget === 'latest') return channel.install_latest;
  if (versionTarget === 'stable') return channel.install_stable;
  return channel.install_pinned.replace('{version}', pinnedVersion.trim() || spec.version_targets.stable);
}

function resolveRunCommand(channelKey: string): string {
  if (channelKey === 'npm_shim') {
    return 'npx @skillgate/cli scan ./my-agent-skill --enforce --policy production';
  }
  return 'skillgate scan ./my-agent-skill --enforce --policy production';
}

function copyTextFallback(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function InstallWizard({ spec }: { spec: InstallSpec }) {
  const [platform, setPlatform] = useState<InstallPlatform>('macos');
  const [channel, setChannel] = useState<string>(spec.canonical_channel);
  const [versionTarget, setVersionTarget] = useState<InstallVersionTarget>('stable');
  const [pinnedVersion, setPinnedVersion] = useState<string>(spec.version_targets.stable);
  const [copied, setCopied] = useState(false);

  const availableChannels = useMemo(
    () =>
      Object.entries(spec.channels).filter(([, value]) =>
        (value.platforms as string[]).includes(platform),
      ),
    [platform, spec.channels],
  );

  const selectedChannel = availableChannels.some(([key]) => key === channel)
    ? channel
    : (availableChannels[0]?.[0] ?? spec.canonical_channel);

  const installCommand = resolveInstallCommand(spec, selectedChannel, versionTarget, pinnedVersion);
  const verifyCommand = spec.channels[selectedChannel]?.verify ?? 'skillgate version';
  const uninstallCommand = spec.channels[selectedChannel]?.uninstall ?? 'skillgate doctor';
  const upgradeCommand = spec.channels[selectedChannel]?.upgrade ?? 'skillgate doctor';
  const runCommand = resolveRunCommand(selectedChannel);
  const isNpmWrapper = selectedChannel === 'npm_shim';
  const channelLabel = CHANNEL_LABELS[selectedChannel] ?? selectedChannel;

  const onCopy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(installCommand);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = copyTextFallback(installCommand);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 1000);

    trackEvent('install_copy_command', 'docs_install_wizard', {
      platform,
      channel: selectedChannel,
      version_target: versionTarget,
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
          Install Wizard
        </span>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-surface-300">
          Pick your platform
        </span>
      </div>
      <p className="mt-2 text-sm text-surface-300">
        Choose your platform and preferred setup path, then copy and run the command.
      </p>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setChannel('pipx')}
          className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
            selectedChannel !== 'npm_shim'
              ? 'border-emerald-300/50 bg-emerald-500/10 text-emerald-100'
              : 'border-white/15 bg-surface-950 text-surface-300 hover:border-white/30'
          }`}
        >
          <p className="font-semibold">Python path (Recommended)</p>
          <p className="mt-1 text-[11px] text-surface-300">Best for day-to-day use and CI pipelines.</p>
        </button>
        <button
          type="button"
          onClick={() => setChannel('npm_shim')}
          className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
            isNpmWrapper
              ? 'border-emerald-300/50 bg-emerald-500/10 text-emerald-100'
              : 'border-white/15 bg-surface-950 text-surface-300 hover:border-white/30'
          }`}
        >
          <p className="font-semibold">NPX path</p>
          <p className="mt-1 text-[11px] text-surface-300">Great for Node-first teams and quick onboarding.</p>
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs text-surface-400">
          Platform
          <select
            className="mt-1 w-full rounded-md border border-white/15 bg-surface-950 p-2 text-sm text-white"
            value={platform}
            onChange={(event) => {
              const next = event.target.value as InstallPlatform;
              setPlatform(next);
              trackEvent('install_platform_select', next, { source: 'docs_install_wizard' });
            }}
          >
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-surface-400">
          Channel
          <select
            className="mt-1 w-full rounded-md border border-white/15 bg-surface-950 p-2 text-sm text-white"
            value={selectedChannel}
            onChange={(event) => {
              const next = event.target.value;
              setChannel(next);
              trackEvent('install_channel_select', next, { platform, source: 'docs_install_wizard' });
            }}
          >
            {availableChannels.map(([key, value]) => (
              <option key={key} value={key}>
                {CHANNEL_LABELS[key] ?? key} ({value.tier})
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-surface-400">
          Version target
          <select
            className="mt-1 w-full rounded-md border border-white/15 bg-surface-950 p-2 text-sm text-white"
            value={versionTarget}
            onChange={(event) => setVersionTarget(event.target.value as InstallVersionTarget)}
          >
            <option value="latest">latest ({spec.version_targets.latest})</option>
            <option value="stable">stable ({spec.version_targets.stable})</option>
            <option value="pinned">pinned</option>
          </select>
        </label>
      </div>

      {versionTarget === 'pinned' && (
        <label className="mt-3 block text-xs text-surface-400">
          Pinned version
          <input
            className="mt-1 w-full rounded-md border border-white/15 bg-surface-950 p-2 text-sm text-white"
            value={pinnedVersion}
            onChange={(event) => setPinnedVersion(event.target.value)}
            placeholder={spec.version_targets.stable}
          />
        </label>
      )}

      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-white/10 bg-surface-950/60 p-3 text-xs text-surface-300">
          <p>
            Channel: <span className="font-semibold text-white">{channelLabel}</span>
          </p>
          {isNpmWrapper ? (
            <p className="mt-1">If `skillgate` is not found, install Python first, then run this setup again.</p>
          ) : (
            <p className="mt-1">Recommended path for local development and CI.</p>
          )}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Install</p>
        <CodeBlock code={installCommand} />

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Verify</p>
            <div className="mt-1"><CodeBlock code={verifyCommand} /></div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Upgrade</p>
            <div className="mt-1"><CodeBlock code={upgradeCommand} /></div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Uninstall</p>
            <div className="mt-1"><CodeBlock code={uninstallCommand} /></div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">First enforced run</p>
          <div className="mt-1"><CodeBlock code={runCommand} /></div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onCopy()}
            className="rounded-md border border-emerald-300/50 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10"
          >
            {copied ? 'Copied' : 'Copy install command'}
          </button>
          <button
            type="button"
            onClick={() =>
              trackEvent('install_docs_conversion', 'docs_get_started', {
                platform,
                channel: selectedChannel,
              })
            }
            className="rounded-md border border-white/20 px-3 py-1 text-xs text-surface-200 hover:bg-white/10"
          >
            I installed SkillGate
          </button>
        </div>
      </div>
    </div>
  );
}
