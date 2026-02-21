import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InstallWizard, resolveInstallCommand } from '@/components/docs/InstallWizard';
import type { InstallSpec } from '@/lib/install-spec';

const trackEventMock = vi.fn();

vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

const installSpecFixture: InstallSpec = {
  version: '1',
  canonical_channel: 'pipx',
  version_targets: { latest: '1.0.0', stable: '1.0.0' },
  channels: {
    pipx: {
      tier: 'ga',
      platforms: ['macos', 'linux', 'windows', 'wsl'],
      install_latest: 'pipx install skillgate',
      install_stable: 'pipx install skillgate',
      install_pinned: 'pipx install skillgate=={version}',
      verify: 'skillgate version',
      uninstall: 'pipx uninstall skillgate',
      upgrade: 'pipx upgrade skillgate',
    },
    homebrew: {
      tier: 'beta',
      platforms: ['macos'],
      install_latest: 'brew install skillgate',
      install_stable: 'brew install skillgate',
      install_pinned: 'brew install skillgate@{version}',
      verify: 'skillgate version',
      uninstall: 'brew uninstall skillgate',
      upgrade: 'brew upgrade skillgate',
    },
    npm_shim: {
      tier: 'experimental',
      platforms: ['macos', 'linux', 'windows', 'wsl'],
      install_latest: 'npm install -g @skillgate/cli',
      install_stable: 'npm install -g @skillgate/cli',
      install_pinned: 'npm install -g @skillgate/cli@{version}',
      verify: 'skillgate version',
      uninstall: 'npm uninstall -g @skillgate/cli',
      upgrade: 'npm install -g @skillgate/cli@latest',
    },
  },
};

describe('InstallWizard', () => {
  it('resolves pinned command deterministically', () => {
    const command = resolveInstallCommand(installSpecFixture, 'pipx', 'pinned', '1.2.3');
    expect(command).toBe('pipx install skillgate==1.2.3');
  });

  it('tracks platform/channel selection and renders command', () => {
    render(<InstallWizard spec={installSpecFixture} />);

    const platformSelect = screen.getByLabelText('Platform');
    fireEvent.change(platformSelect, { target: { value: 'linux' } });
    expect(trackEventMock).toHaveBeenCalledWith(
      'install_platform_select',
      'linux',
      expect.objectContaining({ source: 'docs_install_wizard' }),
    );

    expect(screen.getByText('pipx install skillgate')).toBeVisible();
  });

  it('renders npx first-run guidance for npm shim channel', () => {
    render(<InstallWizard spec={installSpecFixture} />);

    const channelSelect = screen.getByLabelText('Channel');
    fireEvent.change(channelSelect, { target: { value: 'npm_shim' } });

    expect(screen.getByText('npm install -g @skillgate/cli')).toBeVisible();
    expect(
      screen.getByText('npx @skillgate/cli scan ./my-agent-skill --enforce --policy production'),
    ).toBeVisible();
  });
});
