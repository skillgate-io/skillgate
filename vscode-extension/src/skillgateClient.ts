import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { promisify } from 'node:util';
import { DecisionRecord, LicenseState, PreflightState } from './types';

const execFileAsync = promisify(execFile);

export interface SkillgateClientOptions {
  binaryPath: string;
  sidecarUrl: string;
  cwd: string;
}

export class SkillgateClient {
  private readonly binaryPath: string;
  private readonly sidecarUrl: string;
  private readonly cwd: string;

  constructor(opts: SkillgateClientOptions) {
    this.binaryPath = opts.binaryPath;
    this.sidecarUrl = opts.sidecarUrl.replace(/\/$/, '');
    this.cwd = opts.cwd;
  }

  private async runCli(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync(this.binaryPath, args, {
      cwd: this.cwd,
      timeout: 5_000,
      maxBuffer: 1_000_000,
    });
    return stdout;
  }

  async runCliJson(args: string[]): Promise<Record<string, unknown>> {
    const stdout = await this.runCli(args);
    return JSON.parse(stdout) as Record<string, unknown>;
  }

  async isCliInstalled(): Promise<boolean> {
    if (this.binaryPath.includes('/') || this.binaryPath.includes('\\')) {
      try {
        await access(this.binaryPath, constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }

    const resolver = process.platform === 'win32' ? 'where' : 'which';
    try {
      await execFileAsync(resolver, [this.binaryPath], {
        cwd: this.cwd,
        timeout: 2_000,
      });
      return true;
    } catch {
      // Fall back to invoking the binary in case shell path lookup behaves differently.
    }

    try {
      await this.runCli(['version']);
      return true;
    } catch {
      return false;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.runCli(['auth', 'status']);
      return true;
    } catch {
      return false;
    }
  }

  async isSidecarRunning(): Promise<boolean> {
    if (typeof fetch !== 'function') {
      return false;
    }
    try {
      const response = await fetch(`${this.sidecarUrl}/v1/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1_200),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async runPreflight(): Promise<PreflightState> {
    const cliInstalled = await this.isCliInstalled();
    if (!cliInstalled) {
      return {
        cliInstalled: false,
        authenticated: false,
        sidecarRunning: false,
        nextStep: 'install-cli',
        cliInstallHint: 'https://docs.skillgate.io/installation',
        checkedAt: new Date().toISOString(),
      };
    }

    const authenticated = await this.isAuthenticated();
    if (!authenticated) {
      return {
        cliInstalled: true,
        authenticated: false,
        sidecarRunning: false,
        nextStep: 'login',
        cliInstallHint: 'https://docs.skillgate.io/installation',
        checkedAt: new Date().toISOString(),
      };
    }

    const sidecarRunning = await this.isSidecarRunning();
    const nextStep = sidecarRunning ? 'ready' : 'start-sidecar';
    return {
      cliInstalled,
      authenticated,
      sidecarRunning,
      nextStep,
      cliInstallHint: 'https://docs.skillgate.io/installation',
      checkedAt: new Date().toISOString(),
    };
  }

  async approveInstructionLine(filePath: string, line: number): Promise<Record<string, unknown>> {
    return this.runCliJson(['claude', 'scan', this.cwd, '--approve-line', `${filePath}:${line}`]);
  }

  async approveHook(filePath: string): Promise<Record<string, unknown>> {
    return this.runCliJson(['claude', 'hooks', 'approve', filePath, '--directory', this.cwd]);
  }

  async createApprovalRequest(params: {
    decisionCode: string;
    invocationId: string;
    reasons: string[];
  }): Promise<Record<string, unknown>> {
    const args = [
      'approval',
      'request',
      '--decision-code',
      params.decisionCode,
      '--invocation-id',
      params.invocationId,
    ];
    params.reasons.forEach((reason) => {
      args.push('--reason', reason);
    });
    return this.runCliJson(args);
  }

  async getGitHeadFile(relativePath: string): Promise<string> {
    const { stdout } = await execFileAsync('git', ['show', `HEAD:${relativePath}`], {
      cwd: this.cwd,
      timeout: 2_000,
      maxBuffer: 1_000_000,
    });
    return stdout;
  }

  async getLicenseState(): Promise<LicenseState> {
    if (typeof fetch !== 'function') {
      return { mode: 'needs-login', tier: 'free' };
    }
    const response = await fetch(`${this.sidecarUrl}/v1/entitlements`, {
      method: 'GET',
      signal: AbortSignal.timeout(1_200),
    }).catch(() => undefined);
    if (!response || response.status === 401) {
      return { mode: 'needs-login', tier: 'free' };
    }
    if (!response.ok) {
      return { mode: 'limited', tier: 'free' };
    }
    const payload = (await response.json().catch(() => ({}))) as {
      tier?: string;
      license_mode?: string;
    };
    if (payload.license_mode === 'limited') {
      return { mode: 'limited', tier: payload.tier ?? 'free' };
    }
    return { mode: 'licensed', tier: payload.tier ?? 'unknown' };
  }

  async simulateInvocation(invocation: Record<string, unknown>): Promise<DecisionRecord> {
    const invocationId = String(invocation.invocation_id ?? '');
    const response = await fetch(`${this.sidecarUrl}/v1/decide/full`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invocation_id: invocationId, tool_invocation: invocation }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new Error(`Sidecar request failed: ${response.status}`);
    }
    return (await response.json()) as DecisionRecord;
  }
}
