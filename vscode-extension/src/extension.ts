import * as vscode from 'vscode';
import { detectCapabilityDiff } from './capabilityDiff';
import { debounce } from './debounce';
import { detectInstructionWarnings } from './instructionWarnings';
import { openOnboardingPanel } from './onboardingPanel';
import { lintPolicyDocument } from './policyLint';
import { buildPrChecklist } from './prChecklist';
import { detectInlineRiskHints } from './riskHints';
import { SkillgateClient } from './skillgateClient';
import { openSimulationPanel } from './simulationPanel';
import { LintIssue, PreflightState } from './types';

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
  nextStep: 'install-cli',
  cliInstallHint: 'https://docs.skillgate.io/installation',
  checkedAt: new Date(0).toISOString(),
};

function isRuntimeReady(preflight: PreflightState): boolean {
  return preflight.cliInstalled && preflight.authenticated && preflight.sidecarRunning;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('skillgate');
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  const binaryPath = config.get<string>('binaryPath', 'skillgate');
  const client = new SkillgateClient({
    binaryPath,
    sidecarUrl: config.get<string>('sidecarUrl', 'http://127.0.0.1:9911'),
    cwd: workspaceFolder,
  });

  let preflightState: PreflightState = DEFAULT_PREFLIGHT;

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
      preflightState = await client.runPreflight();
    } catch {
      preflightState = {
        cliInstalled: false,
        authenticated: false,
        sidecarRunning: false,
        nextStep: 'install-cli',
        cliInstallHint: 'https://docs.skillgate.io/installation',
        checkedAt: new Date().toISOString(),
      };
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

  const startCliInstall = (): void => {
    const terminal = vscode.window.createTerminal('SkillGate Install CLI');
    terminal.show();
    terminal.sendText(
      'if command -v python3.12 >/dev/null 2>&1; then pipx install --python python3.12 skillgate || pipx install skillgate; else pipx install skillgate; fi',
    );
    void vscode.window
      .showInformationMessage(
        'Running CLI install in terminal (prefers Python 3.12 when available). If install fails, open the install guide.',
        'Open Install Guide',
      )
      .then((action) => {
        if (action === 'Open Install Guide') {
          openInstallGuide();
        }
      });
  };

  const openOnboarding = () => {
    openOnboardingPanel(context.extensionUri, preflightState, {
      onRetry: () => {
        void refreshPreflight();
        void refreshLicense();
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
        const terminal = vscode.window.createTerminal('SkillGate Login');
        terminal.show();
        terminal.sendText(`${binaryPath} auth login`);
      },
      onStartSidecar: () => {
        if (!preflightState.cliInstalled) {
          void vscode.window.showWarningMessage('Install SkillGate CLI before starting the sidecar.');
          startCliInstall();
          return;
        }
        const terminal = vscode.window.createTerminal('SkillGate Sidecar');
        terminal.show();
        terminal.sendText(
          'python -m uvicorn skillgate.sidecar.app:create_sidecar_app --factory --host 127.0.0.1 --port 9911',
        );
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
    vscode.commands.registerCommand('skillgate.simulateInvocation', async () => {
      if (!(await requireRuntimeAuth('Invocation simulation'))) {
        return;
      }
      openSimulationPanel(client);
    }),
    vscode.commands.registerCommand('skillgate.generatePrChecklist', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
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
      void vscode.window.showInformationMessage('SkillGate PR checklist copied to clipboard.');
    }),
    vscode.commands.registerCommand('skillgate.openApprovalRequest', async () => {
      if (!(await requireCli('Approval request'))) {
        return;
      }
      const invocation = await vscode.window.showInputBox({
        title: 'Invocation ID requiring approval',
      });
      if (!invocation) {
        return;
      }
      const created = await client.createApprovalRequest({
        decisionCode: 'SG_APPROVAL_REQUIRED',
        invocationId: invocation,
        reasons: ['manual-review'],
      });
      void vscode.window.showInformationMessage(
        `Approval request created: ${String(created.approval_id)}`,
      );
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
