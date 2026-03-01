import { execFile } from 'node:child_process';
import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { ApprovalRequestRecord, DecisionRecord, LicenseState, PreflightState } from './types';

export interface InvocationCandidate {
  invocationId: string;
  decisionCode: string;
  decision?: string;
  timestamp?: string;
  source: 'approval-request' | 'audit-log';
}

const execFileAsync = promisify(execFile);

export interface SkillgateClientOptions {
  binaryPath: string;
  sidecarUrl: string;
  cwd: string;
  workspaceId?: string;
  actorId?: string;
}

export class SkillgateClient {
  private readonly binaryPath: string;
  private readonly sidecarUrl: string;
  private readonly cwd: string;
  private readonly workspaceId: string;
  private readonly actorId: string;

  constructor(opts: SkillgateClientOptions) {
    this.binaryPath = opts.binaryPath;
    this.sidecarUrl = opts.sidecarUrl.replace(/\/$/, '');
    this.cwd = opts.cwd;
    this.workspaceId = opts.workspaceId ?? `ws-${this.slugify(basename(this.cwd))}`;
    this.actorId = opts.actorId ?? 'vscode-user';
  }

  private slugify(value: string): string {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return normalized || 'workspace';
  }

  private enrichInvocation(input: Record<string, unknown>): Record<string, unknown> {
    const nowIso = new Date().toISOString();
    const actor =
      input.actor && typeof input.actor === 'object'
        ? { ...(input.actor as Record<string, unknown>) }
        : {};
    if (!actor.type) actor.type = 'agent';
    if (!actor.id) actor.id = this.actorId;
    if (!actor.workspace_id) actor.workspace_id = this.workspaceId;
    if (!actor.session_id) actor.session_id = `vscode-${Date.now()}`;

    const context =
      input.context && typeof input.context === 'object'
        ? { ...(input.context as Record<string, unknown>) }
        : {};
    if (!context.repo) context.repo = this.cwd;
    if (!context.environment) context.environment = 'dev';
    if (!context.data_classification) context.data_classification = 'internal';
    if (!context.network_zone) context.network_zone = 'local';

    const enriched = { ...input };
    if (!enriched.timestamp) {
      enriched.timestamp = nowIso;
    }
    if (!enriched.invocation_id) {
      enriched.invocation_id = `vscode-${Date.now()}`;
    }
    enriched.actor = actor;
    enriched.context = context;
    return enriched;
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

  async getAuthSummary(): Promise<string | undefined> {
    try {
      const payload = await this.runCliJson(['auth', 'whoami', '--json']);
      if (payload.authenticated !== true) {
        return undefined;
      }
      const tier = String(payload.tier ?? 'unknown');
      const email = payload.email ? String(payload.email) : '';
      const method = String(payload.auth_method ?? 'unknown');
      if (email) {
        return `${email} (${tier}, ${method})`;
      }
      return `${tier} (${method})`;
    } catch {
      return undefined;
    }
  }

  private async getSidecarToken(): Promise<string | undefined> {
    try {
      const payload = await this.runCliJson(['auth', 'sidecar-token', '--json']);
      if (payload.available !== true || !payload.token) {
        return undefined;
      }
      return String(payload.token);
    } catch {
      return undefined;
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
        sidecarUrl: this.sidecarUrl,
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
        authSummary: undefined,
        sidecarUrl: this.sidecarUrl,
        nextStep: 'login',
        cliInstallHint: 'https://docs.skillgate.io/installation',
        checkedAt: new Date().toISOString(),
      };
    }

    const sidecarRunning = await this.isSidecarRunning();
    const authSummary = await this.getAuthSummary();
    const nextStep = sidecarRunning ? 'ready' : 'start-sidecar';
    return {
      cliInstalled,
      authenticated,
      sidecarRunning,
      authSummary,
      sidecarUrl: this.sidecarUrl,
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

  async listApprovalRequests(): Promise<ApprovalRequestRecord[]> {
    const requestDir = join(this.cwd, '.skillgate', 'approvals', 'requests');
    let fileNames: string[] = [];
    try {
      fileNames = await readdir(requestDir);
    } catch {
      return [];
    }
    const items: ApprovalRequestRecord[] = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith('.json')) {
        continue;
      }
      const fullPath = join(requestDir, fileName);
      try {
        const raw = await readFile(fullPath, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        items.push({
          approval_id: String(parsed.approval_id ?? fileName.replace(/\.json$/, '')),
          status: String(parsed.status ?? 'pending'),
          decision_code: String(parsed.decision_code ?? ''),
          invocation_id: String(parsed.invocation_id ?? ''),
          reasons: Array.isArray(parsed.reasons)
            ? parsed.reasons.map((item) => String(item))
            : [],
          created_at: String(parsed.created_at ?? ''),
          path: fullPath,
          skill_id: parsed.skill_id ? String(parsed.skill_id) : undefined,
          skill_hash: parsed.skill_hash ? String(parsed.skill_hash) : undefined,
          env: parsed.env ? String(parsed.env) : undefined,
          reviewers: Array.isArray(parsed.reviewers)
            ? parsed.reviewers.map((item) => String(item))
            : undefined,
          approval_file: parsed.approval_file ? String(parsed.approval_file) : undefined,
          signed_at: parsed.signed_at ? String(parsed.signed_at) : undefined,
          verified_at: parsed.verified_at ? String(parsed.verified_at) : undefined,
          verify_code: parsed.verify_code ? String(parsed.verify_code) : undefined,
          verify_reason: parsed.verify_reason ? String(parsed.verify_reason) : undefined,
        });
      } catch {
        // Skip malformed request files to keep panel resilient.
      }
    }
    return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  private async listAuditInvocations(limit: number): Promise<InvocationCandidate[]> {
    const auditRoot = process.env.SKILLGATE_AUDIT_LOG_DIR || '/tmp/skillgate-audit';
    const workspaceAuditDir = join(auditRoot, this.workspaceId);
    let logFiles: string[] = [];
    try {
      logFiles = await readdir(workspaceAuditDir);
    } catch {
      return [];
    }

    const ordered = logFiles
      .filter((name) => name.startsWith('audit-log-') && name.endsWith('.ndjson'))
      .sort()
      .reverse();
    const seen = new Set<string>();
    const items: InvocationCandidate[] = [];

    for (const fileName of ordered) {
      if (items.length >= limit) {
        break;
      }
      const fullPath = join(workspaceAuditDir, fileName);
      let lines: string[] = [];
      try {
        const raw = await readFile(fullPath, 'utf-8');
        lines = raw.split('\n').filter(Boolean).reverse();
      } catch {
        continue;
      }
      for (const line of lines) {
        if (items.length >= limit) {
          break;
        }
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          const invocationId = String(parsed.invocation_id ?? '');
          if (!invocationId || seen.has(invocationId)) {
            continue;
          }
          seen.add(invocationId);
          items.push({
            invocationId,
            decisionCode: String(parsed.decision_code ?? ''),
            decision: String(parsed.decision ?? ''),
            timestamp: String(parsed.timestamp ?? ''),
            source: 'audit-log',
          });
        } catch {
          // Ignore malformed lines; keep parsing remaining records.
        }
      }
    }
    return items;
  }

  async listRecentInvocations(limit = 20): Promise<InvocationCandidate[]> {
    const [requests, auditItems] = await Promise.all([
      this.listApprovalRequests(),
      this.listAuditInvocations(limit),
    ]);

    const merged: InvocationCandidate[] = [
      ...requests.map((item) => ({
        invocationId: item.invocation_id,
        decisionCode: item.decision_code,
        decision: undefined,
        timestamp: item.created_at,
        source: 'approval-request' as const,
      })),
      ...auditItems,
    ];

    const deduped = new Map<string, InvocationCandidate>();
    for (const item of merged) {
      if (!item.invocationId) {
        continue;
      }
      const existing = deduped.get(item.invocationId);
      if (!existing) {
        deduped.set(item.invocationId, item);
        continue;
      }
      const existingTs = existing.timestamp || '';
      const candidateTs = item.timestamp || '';
      if (candidateTs > existingTs) {
        deduped.set(item.invocationId, item);
      }
    }

    return [...deduped.values()]
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      .slice(0, limit);
  }

  async updateApprovalRequest(
    path: string,
    patch: Record<string, unknown>,
  ): Promise<ApprovalRequestRecord> {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const merged: Record<string, unknown> = {
      ...parsed,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    await writeFile(path, JSON.stringify(merged, null, 2), 'utf-8');
    return {
      approval_id: String(merged.approval_id ?? ''),
      status: String(merged.status ?? 'pending'),
      decision_code: String(merged.decision_code ?? ''),
      invocation_id: String(merged.invocation_id ?? ''),
      reasons: Array.isArray(merged.reasons) ? merged.reasons.map((item) => String(item)) : [],
      created_at: String(merged.created_at ?? ''),
      path,
      skill_id: merged.skill_id ? String(merged.skill_id) : undefined,
      skill_hash: merged.skill_hash ? String(merged.skill_hash) : undefined,
      env: merged.env ? String(merged.env) : undefined,
      reviewers: Array.isArray(merged.reviewers)
        ? merged.reviewers.map((item) => String(item))
        : undefined,
      approval_file: merged.approval_file ? String(merged.approval_file) : undefined,
      signed_at: merged.signed_at ? String(merged.signed_at) : undefined,
      verified_at: merged.verified_at ? String(merged.verified_at) : undefined,
      verify_code: merged.verify_code ? String(merged.verify_code) : undefined,
      verify_reason: merged.verify_reason ? String(merged.verify_reason) : undefined,
    };
  }

  async signApproval(params: {
    skillId: string;
    skillHash: string;
    reviewers: string[];
    env: string;
    output: string;
  }): Promise<Record<string, unknown>> {
    const args = [
      'approval',
      'sign',
      '--skill-id',
      params.skillId,
      '--skill-hash',
      params.skillHash,
      '--env',
      params.env,
      '--output',
      params.output,
    ];
    for (const reviewer of params.reviewers) {
      args.push('--reviewer', reviewer);
    }
    return this.runCliJson(args);
  }

  async verifyApproval(params: {
    approvalFile: string;
    skillId: string;
    skillHash: string;
    env: string;
    requiredReviewers: number;
  }): Promise<Record<string, unknown>> {
    return this.runCliJson([
      'approval',
      'verify',
      params.approvalFile,
      '--skill-id',
      params.skillId,
      '--skill-hash',
      params.skillHash,
      '--env',
      params.env,
      '--required-reviewers',
      String(params.requiredReviewers),
    ]);
  }

  async getGitHeadFile(relativePath: string): Promise<string> {
    const { stdout } = await execFileAsync('git', ['show', `HEAD:${relativePath}`], {
      cwd: this.cwd,
      timeout: 2_000,
      maxBuffer: 1_000_000,
    });
    return stdout;
  }

  async initializePolicyFile(): Promise<string> {
    await this.runCli(['init']);
    const candidates = ['.skillgate.yml', 'skillgate.yml'];
    for (const candidate of candidates) {
      try {
        await access(`${this.cwd}/${candidate}`, constants.F_OK);
        return candidate;
      } catch {
        // Continue searching candidate paths.
      }
    }
    throw new Error('Policy file was not created by skillgate init');
  }

  async getLicenseState(): Promise<LicenseState> {
    try {
      const payload = await this.runCliJson(['auth', 'whoami', '--json']);
      if (payload.authenticated === true) {
        return {
          mode: 'licensed',
          tier: String(payload.tier ?? 'unknown'),
        };
      }
    } catch {
      // Fall back to sidecar endpoint probing if CLI auth state is unavailable.
    }

    if (typeof fetch !== 'function') {
      return { mode: 'needs-login', tier: 'free' };
    }
    const token = await this.getSidecarToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${this.sidecarUrl}/v1/entitlements`, {
      method: 'GET',
      headers,
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
    const enrichedInvocation = this.enrichInvocation(invocation);
    const invocationId = String(enrichedInvocation.invocation_id ?? '');
    const token = await this.getSidecarToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${this.sidecarUrl}/v1/decide/full`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ invocation_id: invocationId, tool_invocation: enrichedInvocation }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          'Sidecar auth failed (401). Run `skillgate auth login` and retry setup checks.',
        );
      }
      throw new Error(`Sidecar request failed: ${response.status}`);
    }
    return (await response.json()) as DecisionRecord;
  }
}
