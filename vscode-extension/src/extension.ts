import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import { openApprovalCenterPanel } from './approvalCenterPanel';
import { detectCapabilityDiff } from './capabilityDiff';
import { debounce } from './debounce';
import { detectInstructionWarnings } from './instructionWarnings';
import { openOnboardingPanel } from './onboardingPanel';
import { lintPolicyDocument } from './policyLint';
import { buildPrChecklist } from './prChecklist';
import { detectInlineRiskHints } from './riskHints';
import { InvocationCandidate, SkillgateClient } from './skillgateClient';
import { openSimulationPanel } from './simulationPanel';
import { ApprovalRequestRecord, DecisionRecord, LintIssue, PreflightState } from './types';

function isPolicyFile(document: vscode.TextDocument): boolean {
  const name = document.fileName.replace(/\\/g, '/');
  return name.endsWith('/.skillgate.yml') || name.endsWith('/skillgate.yml');
}

function isInstructionFile(document: vscode.TextDocument): boolean {
  const name = document.fileName.replace(/\\/g, '/');
  return (
    name.endsWith('/CLAUDE.md') ||
    name.endsWith('/AGENTS.md') ||
    name.endsWith('/.claude/instructions.md')
  );
}

function isHookFile(document: vscode.TextDocument): boolean {
  const name = document.fileName.replace(/\\/g, '/');
  return /\/\.claude\/hooks\/.+\.(sh|json)$/.test(name);
}

function isMemoryFile(document: vscode.TextDocument): boolean {
  const name = document.fileName.replace(/\\/g, '/');
  return name.endsWith('/MEMORY.md') || name.includes('/.claude/memory/');
}

function toDiagnostics(document: vscode.TextDocument, issues: LintIssue[]): vscode.Diagnostic[] {
  return issues.map((issue) => {
    const line = Math.max(0, issue.line - 1);
    const range = new vscode.Range(line, 0, line, Math.max(1, document.lineAt(line).text.length));
    const diagnostic = new vscode.Diagnostic(
      range,
      issue.message,
      issue.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : issue.severity === 'warning'
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information,
    );
    diagnostic.source = issue.source;
    return diagnostic;
  });
}

async function renderDiagnostics(
  client: SkillgateClient,
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection,
): Promise<void> {
  const issues: LintIssue[] = [];
  const text = document.getText();

  if (isPolicyFile(document)) {
    issues.push(...lintPolicyDocument(text));
    try {
      const folder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (folder) {
        const relative = vscode.workspace.asRelativePath(document.uri, false);
        const head = await client.getGitHeadFile(relative);
        const diffs = detectCapabilityDiff(head, text);
        issues.push(
          ...diffs.map((item) => ({
            message: item.message,
            severity: item.severity,
            line: 1,
            source: 'skillgate.policy.diff',
          })),
        );
      }
    } catch {
      // Missing git baseline should not block diagnostics.
    }
  }

  if (isInstructionFile(document)) {
    for (const warning of detectInstructionWarnings(text)) {
      issues.push({
        message: `${warning.message} (${warning.category})`,
        severity: 'error',
        line: warning.line,
        source: 'skillgate.instruction',
      });
    }
  }

  if (isHookFile(document)) {
    const hints = detectInlineRiskHints(text);
    for (const hint of hints) {
      issues.push({
        message: `${hint.message} ${hint.code}`,
        severity: hint.severity,
        line: hint.line,
        source: 'skillgate.hooks',
      });
    }
  }

  if (isMemoryFile(document)) {
    for (const warning of detectInstructionWarnings(text)) {
      if (warning.category !== 'capability-override') {
        continue;
      }
      issues.push({
        message: 'Memory policy violation: capability override pattern detected.',
        severity: 'warning',
        line: warning.line,
        source: 'skillgate.memory',
      });
    }
  }

  issues.push(
    ...detectInlineRiskHints(text).map((hint) => ({
      message: `${hint.message} ${hint.code}`,
      severity: hint.severity,
      line: hint.line,
      source: 'skillgate.inline-risk',
    })),
  );

  collection.set(document.uri, toDiagnostics(document, issues));
}

const DEFAULT_PREFLIGHT: PreflightState = {
  cliInstalled: false,
  authenticated: false,
  sidecarRunning: false,
  authSummary: undefined,
  sidecarUrl: 'http://127.0.0.1:9911',
  nextStep: 'install-cli',
  cliInstallHint: 'https://docs.skillgate.io/installation',
  checkedAt: new Date(0).toISOString(),
};

interface GuidedProgress {
  simulationRun: boolean;
  checklistGenerated: boolean;
  approvalCenterOpened: boolean;
}

interface InvocationContext {
  invocationId: string;
  decisionCode: string;
  decision?: string;
  timestamp: string;
  source: 'simulation' | 'approval-request' | 'audit-log';
}

const GUIDED_STATE_KEY = 'skillgate.guidedProgress.v1';
const LAST_INVOCATION_KEY = 'skillgate.lastInvocationContext.v1';
const LAST_SCAN_REPORT_KEY = 'skillgate.lastScanReport.v1';

function isRuntimeReady(preflight: PreflightState): boolean {
  return preflight.cliInstalled && preflight.authenticated && preflight.sidecarRunning;
}

type SidecarMode = 'shared' | 'managed-isolation';

function hashWorkspacePath(value: string): number {
  let hash = 0;
  for (const ch of value) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function resolveSidecarEndpoint(
  config: vscode.WorkspaceConfiguration,
  workspaceFolder: string,
): { url: string; port: number; mode: SidecarMode; source: 'override' | 'mode' } {
  const inspect = config.inspect<string>('sidecarUrl');
  const hasOverride = Boolean(
    inspect?.globalValue || inspect?.workspaceValue || inspect?.workspaceFolderValue,
  );
  if (hasOverride) {
    const explicit = (config.get<string>('sidecarUrl', 'http://127.0.0.1:9911') || '').trim();
    const parsed = Number.parseInt(explicit.split(':').pop() ?? '9911', 10);
    return {
      url: explicit.replace(/\/$/, ''),
      port: Number.isFinite(parsed) ? parsed : 9911,
      mode: 'shared',
      source: 'override',
    };
  }

  const mode = config.get<SidecarMode>('sidecarMode', 'shared');
  const basePort = config.get<number>('sidecarBasePort', 9911);
  const port =
    mode === 'managed-isolation'
      ? basePort + (hashWorkspacePath(workspaceFolder) % 1000)
      : basePort;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    mode,
    source: 'mode',
  };
}

function buildWorkspaceId(workspacePath: string): string {
  const normalized = workspacePath.replace(/\\/g, '/').toLowerCase();
  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return `ws-${digest}`;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('skillgate');
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  const binaryPath = config.get<string>('binaryPath', 'skillgate');
  const sidecarEndpoint = resolveSidecarEndpoint(config, workspaceFolder);
  const client = new SkillgateClient({
    binaryPath,
    sidecarUrl: sidecarEndpoint.url,
    cwd: workspaceFolder,
    workspaceId: buildWorkspaceId(workspaceFolder),
    actorId: 'vscode-user',
  });

  let preflightState: PreflightState = DEFAULT_PREFLIGHT;
  let lastDecision: DecisionRecord | undefined;
  let guidedProgress = context.workspaceState.get<GuidedProgress>(GUIDED_STATE_KEY, {
    simulationRun: false,
    checklistGenerated: false,
    approvalCenterOpened: false,
  });
  let lastInvocationContext = context.workspaceState.get<InvocationContext | undefined>(
    LAST_INVOCATION_KEY,
    undefined,
  );
  let lastScanReport = context.workspaceState.get<string | undefined>(LAST_SCAN_REPORT_KEY, undefined);

  const diagnostics = vscode.languages.createDiagnosticCollection('skillgate');
  context.subscriptions.push(diagnostics);

  const setupBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 120);
  setupBar.command = 'skillgate.openOnboarding';
  setupBar.text = 'SkillGate Setup: Checking';
  setupBar.show();
  context.subscriptions.push(setupBar);

  const licenseBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  licenseBar.command = 'skillgate.showLicenseState';
  licenseBar.text = 'SkillGate: checking license';
  licenseBar.show();
  context.subscriptions.push(licenseBar);

  const persistGuidedProgress = async (): Promise<void> => {
    await context.workspaceState.update(GUIDED_STATE_KEY, guidedProgress);
  };

  const markGuidedStep = async (step: keyof GuidedProgress): Promise<void> => {
    if (guidedProgress[step]) {
      return;
    }
    guidedProgress = { ...guidedProgress, [step]: true };
    await persistGuidedProgress();
  };

  const persistLastInvocationContext = async (): Promise<void> => {
    await context.workspaceState.update(LAST_INVOCATION_KEY, lastInvocationContext);
  };

  const persistLastScanReport = async (): Promise<void> => {
    await context.workspaceState.update(LAST_SCAN_REPORT_KEY, lastScanReport);
  };

  const rememberInvocation = async (
    invocationId: string,
    decisionCode: string,
    source: InvocationContext['source'],
    decision?: string,
  ): Promise<void> => {
    if (!invocationId) {
      return;
    }
    lastInvocationContext = {
      invocationId,
      decisionCode,
      decision,
      timestamp: new Date().toISOString(),
      source,
    };
    await persistLastInvocationContext();
  };

  const hasPolicyFile = async (): Promise<boolean> => {
    const [dotPolicy] = await vscode.workspace.findFiles('**/.skillgate.yml', '**/node_modules/**', 1);
    if (dotPolicy) {
      return true;
    }
    const [policy] = await vscode.workspace.findFiles('**/skillgate.yml', '**/node_modules/**', 1);
    return Boolean(policy);
  };

  const findPolicyFile = async (): Promise<vscode.Uri | undefined> => {
    const [dotPolicy] = await vscode.workspace.findFiles('**/.skillgate.yml', '**/node_modules/**', 1);
    if (dotPolicy) {
      return dotPolicy;
    }
    const [policy] = await vscode.workspace.findFiles('**/skillgate.yml', '**/node_modules/**', 1);
    return policy;
  };

  const withGuidedState = async (state: PreflightState): Promise<PreflightState> => {
    const policyInitialized = await hasPolicyFile();
    const steps = [
      {
        id: 'init-policy' as const,
        label: 'Initialize Policy File',
        done: policyInitialized,
        command: 'skillgate.initPolicyFile',
      },
      {
        id: 'simulate' as const,
        label: 'Run Simulation',
        done: guidedProgress.simulationRun,
        command: 'skillgate.simulateInvocation',
      },
      {
        id: 'checklist' as const,
        label: 'Generate PR Checklist',
        done: guidedProgress.checklistGenerated,
        command: 'skillgate.generatePrChecklist',
      },
      {
        id: 'approval-center' as const,
        label: 'Open Approval Center',
        done: guidedProgress.approvalCenterOpened,
        command: 'skillgate.openApprovalCenter',
      },
    ];
    const next = steps.find((step) => !step.done);
    return {
      ...state,
      guided: {
        steps,
        nextActionCommand: next?.command,
        nextActionLabel: next ? `Run: ${next.label}` : undefined,
        completed: !next,
      },
    };
  };

  const refreshLicense = async () => {
    try {
      const state = await client.getLicenseState();
      if (state.mode === 'licensed') {
        licenseBar.text = `SkillGate: Licensed (${state.tier})`;
        licenseBar.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        return;
      }
      if (state.mode === 'limited') {
        licenseBar.text = `SkillGate: Limited (${state.tier})`;
        licenseBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        return;
      }
      licenseBar.text = 'SkillGate: Needs Login';
      licenseBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } catch {
      licenseBar.text = 'SkillGate: Needs Login';
      licenseBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
  };

  const refreshPreflight = async (): Promise<PreflightState> => {
    try {
      preflightState = await withGuidedState(await client.runPreflight());
    } catch {
      preflightState = await withGuidedState({
        cliInstalled: false,
        authenticated: false,
        sidecarRunning: false,
        authSummary: undefined,
        sidecarUrl: sidecarEndpoint.url,
        nextStep: 'install-cli',
        cliInstallHint: 'https://docs.skillgate.io/installation',
        checkedAt: new Date().toISOString(),
      });
    }

    if (isRuntimeReady(preflightState)) {
      setupBar.text = 'SkillGate Setup: Ready';
      setupBar.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    } else {
      setupBar.text = 'SkillGate Setup: Action Required';
      setupBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    return preflightState;
  };

  const openInstallGuide = (): void => {
    void vscode.env.openExternal(vscode.Uri.parse(preflightState.cliInstallHint));
  };

  const requestDirPath = `${workspaceFolder}/.skillgate/approvals/requests`;
  const defaultApprovalOutput = `${workspaceFolder}/.skillgate/approvals/approval.json`;
  const checklistOutputPath = `${workspaceFolder}/.skillgate/pr-checklist.md`;

  const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\"'\"'`)}'`;

  const createSkillgateTerminal = (name: string): vscode.Terminal => vscode.window.createTerminal(name);

  const buildCliCommand = (args: string[]): string => {
    const configured = binaryPath.trim() || 'skillgate';
    const quotedArgs = args.map((arg) => shellQuote(arg)).join(' ');
    if (process.platform === 'win32') {
      return `${shellQuote(configured)} ${quotedArgs}`.trim();
    }
    return `SG_BIN=${shellQuote(configured)}; SG_CMD="$SG_BIN"; if ! command -v "$SG_CMD" >/dev/null 2>&1; then if [ -x "$HOME/.local/bin/$SG_BIN" ]; then SG_CMD="$HOME/.local/bin/$SG_BIN"; else echo "SkillGate CLI not found in PATH or $HOME/.local/bin"; exit 1; fi; fi; "$SG_CMD" ${quotedArgs}`.trim();
  };

  const startCliInstall = (): void => {
    const terminal = createSkillgateTerminal('SkillGate Install CLI');
    terminal.show();
    terminal.sendText(
      "PKG='skillgate[api]'; for py in python3.13 python3.12 python3.11 python3.10; do if command -v \"$py\" >/dev/null 2>&1; then if pipx list --short 2>/dev/null | grep -qx \"skillgate\"; then pipx upgrade --python \"$py\" \"$PKG\" || pipx reinstall --python \"$py\" \"$PKG\"; else pipx install --python \"$py\" \"$PKG\"; fi && exit 0; fi; done; echo \"SkillGate CLI requires Python 3.10-3.13. Install one of these versions and retry.\"; exit 1",
    );
    void vscode.window
      .showInformationMessage(
        'Running CLI install/upgrade in terminal (tries Python 3.13/3.12/3.11/3.10). If install fails, open the install guide.',
        'Open Install Guide',
      )
      .then((action) => {
        if (action === 'Open Install Guide') {
          openInstallGuide();
        }
      });
  };

  const runScanWorkspace = async (): Promise<void> => {
    if (!(await requireCli('Workspace scan'))) {
      return;
    }
    const reportPath = `${workspaceFolder}/.skillgate/reports/scan-${Date.now()}.json`;
    lastScanReport = reportPath;
    await persistLastScanReport();

    const terminal = createSkillgateTerminal('SkillGate Scan Workspace');
    terminal.show();
    terminal.sendText(`mkdir -p ${shellQuote(`${workspaceFolder}/.skillgate/reports`)}`);
    terminal.sendText(
      buildCliCommand([
        'scan',
        workspaceFolder,
        '--output',
        'json',
        '--report-file',
        reportPath,
      ]),
    );

    void vscode.window
      .showInformationMessage(
        'Scan started in terminal. You can submit the generated JSON report next.',
        'Submit Report',
        'Open Report Folder',
      )
      .then(async (action) => {
        if (action === 'Submit Report') {
          await vscode.commands.executeCommand('skillgate.submitScanReport');
          return;
        }
        if (action === 'Open Report Folder') {
          await vscode.commands.executeCommand(
            'revealFileInOS',
            vscode.Uri.file(`${workspaceFolder}/.skillgate/reports`),
          );
        }
      });
  };

  const runSubmitScanReport = async (): Promise<void> => {
    if (!(await requireCli('Scan submission'))) {
      return;
    }

    let reportPath = lastScanReport ?? '';
    if (!reportPath) {
      const recent = await discoverScanReports();
      if (recent.length > 0) {
        const picked = await vscode.window.showQuickPick(
          recent.map((uri) => ({
            label: uri.path.split('/').pop() ?? uri.path,
            description: uri.fsPath,
          })),
          {
            title: 'Select scan report to submit',
            placeHolder: 'Pick .skillgate/reports/*.json',
          },
        );
        if (!picked?.description) {
          return;
        }
        reportPath = picked.description;
      }
    }

    if (!reportPath) {
      const manual = await vscode.window.showInputBox({
        title: 'Scan report path',
        prompt: 'Path to report JSON generated by SkillGate scan',
        value: `${workspaceFolder}/.skillgate/reports/`,
      });
      if (!manual) {
        return;
      }
      reportPath = manual;
    }

    lastScanReport = reportPath;
    await persistLastScanReport();
    const terminal = createSkillgateTerminal('SkillGate Submit Scan');
    terminal.show();
    terminal.sendText(buildCliCommand(['submit-scan', reportPath]));
  };

  const openOnboarding = () => {
    openOnboardingPanel(context.extensionUri, preflightState, {
      onRetry: async () => {
        const nextState = await refreshPreflight();
        await refreshLicense();
        return nextState;
      },
      onInstallCli: () => {
        startCliInstall();
      },
      onLogin: () => {
        if (!preflightState.cliInstalled) {
          void vscode.window.showWarningMessage('Install SkillGate CLI before login.');
          startCliInstall();
          return;
        }
        const terminal = createSkillgateTerminal('SkillGate Login');
        terminal.show();
        terminal.sendText(buildCliCommand(['auth', 'login']));
      },
      onStartSidecar: () => {
        if (!preflightState.cliInstalled) {
          void vscode.window.showWarningMessage('Install SkillGate CLI before starting the sidecar.');
          startCliInstall();
          return;
        }
        const terminal = createSkillgateTerminal('SkillGate Sidecar');
        terminal.show();
        terminal.sendText(
          buildCliCommand([
            'sidecar',
            'start',
            '--host',
            '127.0.0.1',
            '--port',
            String(sidecarEndpoint.port),
          ]),
        );
        if (sidecarEndpoint.source === 'mode' && sidecarEndpoint.mode === 'managed-isolation') {
          void vscode.window.showInformationMessage(
            `SkillGate managed isolation mode: starting workspace sidecar on port ${sidecarEndpoint.port}.`,
          );
        }
      },
      onGuidedNext: async (command) => {
        if (!command) {
          return;
        }
        await vscode.commands.executeCommand(command);
      },
    });
  };

  const requireCli = async (feature: string): Promise<boolean> => {
    if (preflightState.cliInstalled) {
      return true;
    }
    const action = await vscode.window.showWarningMessage(
      `${feature} requires SkillGate CLI installation.`,
      'Open Setup',
      'Install CLI Guide',
    );
    if (action === 'Install CLI Guide') {
      openInstallGuide();
      return false;
    }
    if (action === 'Open Setup') {
      openOnboarding();
    }
    return false;
  };

  const requireRuntimeAuth = async (feature: string): Promise<boolean> => {
    if (isRuntimeReady(preflightState)) {
      return true;
    }
    const action = await vscode.window.showWarningMessage(
      `${feature} requires CLI + login + local sidecar.`,
      'Open Setup',
      'Retry Checks',
      'Install CLI Guide',
    );
    if (action === 'Install CLI Guide') {
      openInstallGuide();
      return false;
    }
    if (action === 'Retry Checks') {
      await refreshPreflight();
      if (isRuntimeReady(preflightState)) {
        return true;
      }
    }
    if (action === 'Open Setup') {
      openOnboarding();
    }
    return false;
  };

  const collectApprovalRequests = async (): Promise<ApprovalRequestRecord[]> => {
    try {
      return await client.listApprovalRequests();
    } catch {
      return [];
    }
  };

  const isGitWorkspace = async (): Promise<boolean> => {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(`${workspaceFolder}/.git`));
      return true;
    } catch {
      return false;
    }
  };

  const toSlug = (value: string): string => {
    return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
  };

  const deriveSkillContext = async (): Promise<{ skillId: string; skillHash: string }> => {
    const workspaceName = workspaceFolder.split(/[\\/]/).pop() || 'workspace';
    const policyUri = await findPolicyFile();
    if (policyUri) {
      const doc = await vscode.workspace.openTextDocument(policyUri);
      const policyHash = createHash('sha256').update(doc.getText(), 'utf8').digest('hex');
      return {
        skillId: `${toSlug(workspaceName)}-policy`,
        skillHash: policyHash,
      };
    }
    const fallbackHash = createHash('sha256').update(workspaceFolder, 'utf8').digest('hex');
    return {
      skillId: `${toSlug(workspaceName)}-workspace`,
      skillHash: fallbackHash,
    };
  };

  const selectApprovalRequest = async (
    mode: 'sign' | 'verify',
  ): Promise<ApprovalRequestRecord | undefined> => {
    const requests = await collectApprovalRequests();
    const filtered = requests.filter((item) => {
      if (mode === 'sign') {
        return item.status === 'pending';
      }
      return Boolean(item.approval_file || item.status === 'signed' || item.status === 'verified');
    });
    const candidates = filtered.length > 0 ? filtered : requests;
    if (candidates.length === 0) {
      return undefined;
    }
    if (candidates.length === 1) {
      return candidates[0];
    }
    const picked = await vscode.window.showQuickPick(
      candidates.map((item) => ({
        label: item.approval_id,
        description: `${item.status} · ${item.decision_code} · ${item.invocation_id}`,
        detail: item.created_at ? new Date(item.created_at).toLocaleString() : item.path,
        request: item,
      })),
      {
        title: mode === 'sign' ? 'Select approval request to sign' : 'Select approval request to verify',
      },
    );
    return picked?.request;
  };

  const discoverScanReports = async (): Promise<vscode.Uri[]> => {
    const reportUris = await vscode.workspace.findFiles(
      '**/.skillgate/reports/*.json',
      '**/node_modules/**',
      100,
    );
    const withStats = await Promise.all(
      reportUris.map(async (uri) => ({
        uri,
        mtime: (await vscode.workspace.fs.stat(uri)).mtime,
      })),
    );
    return withStats.sort((a, b) => b.mtime - a.mtime).map((item) => item.uri);
  };

  const collectInvocationCandidates = async (): Promise<InvocationContext[]> => {
    const recent = await client.listRecentInvocations(20);
    const fromRecent: InvocationContext[] = recent
      .filter((item) => item.invocationId)
      .map((item: InvocationCandidate) => ({
        invocationId: item.invocationId,
        decisionCode: item.decisionCode,
        decision: item.decision,
        timestamp: item.timestamp ?? new Date().toISOString(),
        source: item.source,
      }));
    const items: InvocationContext[] = [...fromRecent];
    if (lastInvocationContext?.invocationId) {
      items.unshift(lastInvocationContext);
    }
    if (lastDecision?.invocation_id) {
      items.unshift({
        invocationId: lastDecision.invocation_id,
        decisionCode: lastDecision.decision_code,
        decision: lastDecision.decision,
        timestamp: new Date().toISOString(),
        source: 'simulation',
      });
    }

    const seen = new Set<string>();
    return items.filter((item) => {
      if (!item.invocationId || seen.has(item.invocationId)) {
        return false;
      }
      seen.add(item.invocationId);
      return true;
    });
  };

  const selectInvocationId = async (): Promise<InvocationContext | undefined> => {
    const candidates = await collectInvocationCandidates();
    if (candidates.length === 0) {
      return undefined;
    }
    if (candidates.length === 1) {
      return candidates[0];
    }
    const quickPick = await vscode.window.showQuickPick(
      [
        ...candidates.map((item) => ({
          label: item.invocationId,
          description: `${item.decisionCode || item.decision || 'unknown'} · ${item.source}`,
          detail: item.timestamp ? new Date(item.timestamp).toLocaleString() : '',
          item,
        })),
        {
          label: 'Enter manually',
          description: 'Use a custom invocation ID',
          detail: 'If the invocation is not listed above',
          item: undefined,
        },
      ],
      {
        title: 'Select invocation for approval',
        placeHolder: 'Pick a recent invocation or choose manual entry',
      },
    );
    return quickPick?.item;
  };

  const createApprovalRequestInteractive = async (): Promise<void> => {
    if (!(await requireCli('Approval request'))) {
      return;
    }
    const selected = await selectInvocationId();
    let invocation = selected?.invocationId ?? '';
    let decisionCode = selected?.decisionCode || lastDecision?.decision_code || 'SG_APPROVAL_REQUIRED';

    if (!invocation) {
      const manualInvocation = await vscode.window.showInputBox({
        title: 'Invocation ID requiring approval',
        value: lastDecision?.invocation_id ?? '',
        prompt: 'Use invocation ID from simulation or blocked runtime event.',
      });
      if (!manualInvocation) {
        return;
      }
      invocation = manualInvocation;
      decisionCode = 'SG_APPROVAL_REQUIRED';
    }

    const created = await client.createApprovalRequest({
      decisionCode,
      invocationId: invocation,
      reasons: ['manual-review'],
    });
    await rememberInvocation(invocation, decisionCode, 'approval-request');
    void vscode.window.showInformationMessage(
      `Approval request created: ${String(created.approval_id)}`,
    );
    const action = await vscode.window.showInformationMessage(
      `Approval request ready for ${invocation}. Next step: sign approval.`,
      'Sign Approval',
    );
    if (action === 'Sign Approval') {
      await signApprovalInteractive();
    }
  };

  const signApprovalInteractive = async (): Promise<void> => {
    if (!(await requireCli('Approval signing'))) {
      return;
    }
    const request = await selectApprovalRequest('sign');
    if (!request) {
      void vscode.window.showWarningMessage('No approval request found. Create a request first.');
      return;
    }
    const skillContext = await deriveSkillContext();
    const reviewersRaw = await vscode.window.showInputBox({
      title: 'Reviewers',
      prompt: 'Comma-separated reviewer IDs (minimum one, two for quorum).',
      value: 'security-lead,platform-lead',
    });
    if (!reviewersRaw) {
      return;
    }
    const env = (await vscode.window.showInputBox({
      title: 'Environment',
      value: request.env || 'prod',
      prompt: 'Approved environment (dev/ci/prod/strict).',
    })) || 'prod';
    const output = `${workspaceFolder}/.skillgate/approvals/${request.approval_id}.approval.json`;
    const reviewers = reviewersRaw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (reviewers.length === 0) {
      void vscode.window.showWarningMessage('At least one reviewer is required.');
      return;
    }
    try {
      const result = await client.signApproval({
        skillId: skillContext.skillId,
        skillHash: skillContext.skillHash,
        reviewers,
        env,
        output,
      });
      await client.updateApprovalRequest(request.path, {
        status: 'signed',
        skill_id: skillContext.skillId,
        skill_hash: skillContext.skillHash,
        env,
        reviewers,
        approval_file: output,
        signed_at: new Date().toISOString(),
      });
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(output));
      await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
      void vscode.window.showInformationMessage(
        `Approval ${request.approval_id} signed (${String(result.ok)}).`,
      );
      const action = await vscode.window.showInformationMessage(
        'Approval signed. Next step: verify approval artifact.',
        'Verify Approval',
      );
      if (action === 'Verify Approval') {
        await verifyApprovalInteractive();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Approval signing failed.';
      void vscode.window.showErrorMessage(message);
    }
  };

  const verifyApprovalInteractive = async (): Promise<void> => {
    if (!(await requireCli('Approval verification'))) {
      return;
    }
    const request = await selectApprovalRequest('verify');
    if (!request) {
      void vscode.window.showWarningMessage('No signed approval request found to verify.');
      return;
    }
    const skillContext = await deriveSkillContext();
    const approvalFile = request.approval_file || defaultApprovalOutput;
    const skillId = request.skill_id || skillContext.skillId;
    const skillHash = request.skill_hash || skillContext.skillHash;
    const env = request.env || 'prod';
    const requiredReviewersRaw = (await vscode.window.showInputBox({
      title: 'Required reviewers',
      value: String(request.reviewers?.length ?? 2),
    })) || String(request.reviewers?.length ?? 2);
    const requiredReviewers = Number.parseInt(requiredReviewersRaw, 10);
    try {
      const result = await client.verifyApproval({
        approvalFile,
        skillId,
        skillHash,
        env,
        requiredReviewers: Number.isFinite(requiredReviewers) ? requiredReviewers : 2,
      });
      const allowed =
        result.allowed === true ||
        String(result.code ?? '').toUpperCase() === 'SG_ALLOW' ||
        String(result.code ?? '').toUpperCase() === 'ALLOW';
      await client.updateApprovalRequest(request.path, {
        status: allowed ? 'verified' : 'verification_failed',
        verified_at: new Date().toISOString(),
        verify_code: String(result.code ?? ''),
        verify_reason: String(result.reason ?? ''),
      });
      void vscode.window.showInformationMessage(
        `Approval verify: ${String(result.code)} (${String(result.reason)})`,
      );
      if (allowed) {
        const gitWorkspace = await isGitWorkspace();
        if (gitWorkspace) {
          void vscode.window.showInformationMessage(
            'Attach .skillgate/pr-checklist.md and .skillgate/approvals/* artifacts in your PR/MR.',
          );
        } else {
          void vscode.window.showInformationMessage(
            'No git repo detected. Share .skillgate/pr-checklist.md and .skillgate/approvals/* as review evidence.',
          );
        }
      }
    } catch (error) {
      await client.updateApprovalRequest(request.path, {
        status: 'verification_failed',
        verified_at: new Date().toISOString(),
      }).catch(() => undefined);
      const message = error instanceof Error ? error.message : 'Approval verify failed.';
      void vscode.window.showErrorMessage(message);
    }
  };

  const policyDebounced = debounce((document: vscode.TextDocument) => {
    void renderDiagnostics(client, document, diagnostics);
  }, config.get<number>('policyDebounceMs', 500));

  const instructionDebounced = debounce((document: vscode.TextDocument) => {
    void renderDiagnostics(client, document, diagnostics);
  }, config.get<number>('instructionDebounceMs', 800));

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (isInstructionFile(document)) {
        instructionDebounced(document);
        return;
      }
      policyDebounced(document);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isInstructionFile(event.document)) {
        instructionDebounced(event.document);
        return;
      }
      policyDebounced(event.document);
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      void renderDiagnostics(client, document, diagnostics);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('skillgate.openOnboarding', () => openOnboarding()),
    vscode.commands.registerCommand('skillgate.preflight.retry', async () => {
      await refreshPreflight();
      await refreshLicense();
    }),
    vscode.commands.registerCommand('skillgate.scanWorkspace', async () => {
      await runScanWorkspace();
    }),
    vscode.commands.registerCommand('skillgate.submitScanReport', async () => {
      await runSubmitScanReport();
    }),
    vscode.commands.registerCommand('skillgate.simulateInvocation', async () => {
      if (!(await requireRuntimeAuth('Invocation simulation'))) {
        return;
      }
      openSimulationPanel(client, {
        onDecision: async (record) => {
          lastDecision = record;
          await rememberInvocation(
            record.invocation_id,
            record.decision_code,
            'simulation',
            record.decision,
          );
          await markGuidedStep('simulationRun');
          if (record.decision === 'REQUIRE_APPROVAL') {
            const action = await vscode.window.showInformationMessage(
              `Simulation requires approval (${record.invocation_id}). Continue in Approval Center.`,
              'Create Approval Request',
              'Open Approval Center',
            );
            if (action === 'Create Approval Request') {
              await createApprovalRequestInteractive();
              return;
            }
            if (action === 'Open Approval Center') {
              await vscode.commands.executeCommand('skillgate.openApprovalCenter');
            }
            return;
          }
          const action = await vscode.window.showInformationMessage(
            'Simulation complete. Generate PR checklist next.',
            'Generate PR Checklist',
          );
          if (action === 'Generate PR Checklist') {
            await vscode.commands.executeCommand('skillgate.generatePrChecklist');
          }
        },
      });
    }),
    vscode.commands.registerCommand('skillgate.generatePrChecklist', async () => {
      let editor = vscode.window.activeTextEditor;
      if (!editor) {
        const policyUri = await findPolicyFile();
        if (policyUri) {
          const doc = await vscode.workspace.openTextDocument(policyUri);
          editor = await vscode.window.showTextDocument(doc, { preview: false });
        }
      }
      if (!editor) {
        const action = await vscode.window.showWarningMessage(
          'No active document found for checklist generation.',
          'Initialize Policy File',
        );
        if (action === 'Initialize Policy File') {
          await vscode.commands.executeCommand('skillgate.initPolicyFile');
        }
        return;
      }

      const relative = vscode.workspace.asRelativePath(editor.document.uri, false);
      let head = '';
      try {
        head = await client.getGitHeadFile(relative);
      } catch {
        head = '';
      }
      const changes = detectCapabilityDiff(head, editor.document.getText());
      const checklist = buildPrChecklist(changes);
      await vscode.env.clipboard.writeText(checklist);
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(`${workspaceFolder}/.skillgate`));
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(checklistOutputPath),
        Buffer.from(checklist, 'utf8'),
      );
      const preview = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: checklist,
      });
      await vscode.window.showTextDocument(preview, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
      });
      await markGuidedStep('checklistGenerated');
      void vscode.window
        .showInformationMessage(
          'SkillGate PR checklist copied, preview opened, and saved to .skillgate/pr-checklist.md.',
          'Open Approval Center',
        )
        .then((action) => {
          if (action === 'Open Approval Center') {
            void vscode.commands.executeCommand('skillgate.openApprovalCenter');
          }
        });
    }),
    vscode.commands.registerCommand('skillgate.initPolicyFile', async () => {
      if (!(await requireCli('Policy initialization'))) {
        return;
      }
      try {
        const relative = await client.initializePolicyFile();
        const targetUri = vscode.Uri.file(`${workspaceFolder}/${relative}`);
        const doc = await vscode.workspace.openTextDocument(targetUri);
        await vscode.window.showTextDocument(doc, { preview: false });
        const action = await vscode.window.showInformationMessage(
          `Initialized policy file: ${relative}`,
          'Run Simulation',
        );
        if (action === 'Run Simulation') {
          await vscode.commands.executeCommand('skillgate.simulateInvocation');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to initialize policy file.';
        void vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand('skillgate.openApprovalRequest', async () => {
      await createApprovalRequestInteractive();
    }),
    vscode.commands.registerCommand('skillgate.signApproval', async () => {
      await signApprovalInteractive();
    }),
    vscode.commands.registerCommand('skillgate.verifyApproval', async () => {
      await verifyApprovalInteractive();
    }),
    vscode.commands.registerCommand('skillgate.openApprovalCenter', async () => {
      await markGuidedStep('approvalCenterOpened');
      const items = await collectApprovalRequests();
      openApprovalCenterPanel(items, {
        onRefresh: collectApprovalRequests,
        onCreate: createApprovalRequestInteractive,
        onSign: signApprovalInteractive,
        onVerify: verifyApprovalInteractive,
        onOpenFolder: async () => {
          await vscode.commands.executeCommand(
            'revealFileInOS',
            vscode.Uri.file(requestDirPath),
          );
        },
      });
    }),
    vscode.commands.registerCommand('skillgate.approveInstructionLine', async () => {
      if (!(await requireCli('Instruction exception approval'))) {
        return;
      }
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const line = editor.selection.active.line + 1;
      const relative = vscode.workspace.asRelativePath(editor.document.uri, false);
      await client.approveInstructionLine(relative, line);
      void vscode.window.showInformationMessage(`Approved inline exception: ${relative}:${line}`);
    }),
    vscode.commands.registerCommand('skillgate.approveHook', async () => {
      if (!(await requireCli('Hook approval'))) {
        return;
      }
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const relative = vscode.workspace.asRelativePath(editor.document.uri, false);
      await client.approveHook(relative);
      void vscode.window.showInformationMessage(`Hook approved: ${relative}`);
    }),
    vscode.commands.registerCommand('skillgate.showLicenseState', () => refreshLicense()),
  );

  await refreshPreflight();
  await refreshLicense();
}

export function deactivate(): void {
  // no-op
}
