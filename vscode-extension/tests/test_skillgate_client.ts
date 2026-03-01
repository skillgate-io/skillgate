import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillgateClient } from '../src/skillgateClient';

function client(): SkillgateClient {
  return new SkillgateClient({
    binaryPath: 'skillgate',
    sidecarUrl: 'http://127.0.0.1:9911',
    cwd: process.cwd(),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SkillgateClient license fallback', () => {
  it('returns needs-login when sidecar is offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const state = await client().getLicenseState();
    expect(state.mode).toBe('needs-login');
  });

  it('returns needs-login when sidecar reports 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 401, ok: false, json: async () => ({}) }),
    );
    const state = await client().getLicenseState();
    expect(state.mode).toBe('needs-login');
  });

  it('returns licensed when sidecar entitlements are available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ tier: 'pro', license_mode: 'normal' }),
      }),
    );
    const state = await client().getLicenseState();
    expect(state.mode).toBe('licensed');
    expect(state.tier).toBe('pro');
  });
});

describe('SkillgateClient preflight', () => {
  it('short-circuits when CLI is unavailable', async () => {
    vi.spyOn(SkillgateClient.prototype, 'isCliInstalled').mockResolvedValue(false);
    const authSpy = vi.spyOn(SkillgateClient.prototype, 'isAuthenticated').mockResolvedValue(false);
    const sidecarSpy = vi
      .spyOn(SkillgateClient.prototype, 'isSidecarRunning')
      .mockResolvedValue(false);
    const result = await client().runPreflight();
    expect(result.cliInstalled).toBe(false);
    expect(result.authenticated).toBe(false);
    expect(result.sidecarRunning).toBe(false);
    expect(result.nextStep).toBe('install-cli');
    expect(authSpy).not.toHaveBeenCalled();
    expect(sidecarSpy).not.toHaveBeenCalled();
  });

  it('returns runtime-ready checks when available', async () => {
    vi.spyOn(SkillgateClient.prototype, 'isCliInstalled').mockResolvedValue(true);
    vi.spyOn(SkillgateClient.prototype, 'isAuthenticated').mockResolvedValue(true);
    vi.spyOn(SkillgateClient.prototype, 'isSidecarRunning').mockResolvedValue(true);
    const result = await client().runPreflight();
    expect(result.cliInstalled).toBe(true);
    expect(result.authenticated).toBe(true);
    expect(result.sidecarRunning).toBe(true);
    expect(result.nextStep).toBe('ready');
  });

  it('prompts login when CLI exists but auth is missing', async () => {
    vi.spyOn(SkillgateClient.prototype, 'isCliInstalled').mockResolvedValue(true);
    vi.spyOn(SkillgateClient.prototype, 'isAuthenticated').mockResolvedValue(false);
    const sidecarSpy = vi
      .spyOn(SkillgateClient.prototype, 'isSidecarRunning')
      .mockResolvedValue(false);
    const result = await client().runPreflight();
    expect(result.nextStep).toBe('login');
    expect(sidecarSpy).not.toHaveBeenCalled();
  });
});
