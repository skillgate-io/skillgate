import * as vscode from 'vscode';
import { PreflightState } from './types';

function asBadge(ok: boolean): string {
  return ok ? 'OK' : 'Required';
}

function asColor(ok: boolean): string {
  return ok ? '#10b981' : '#f59e0b';
}

function nextStepText(state: PreflightState): string {
  if (state.nextStep === 'install-cli') return 'Install SkillGate CLI first.';
  if (state.nextStep === 'login') return 'Sign in to SkillGate.';
  if (state.nextStep === 'start-sidecar') return 'Start the local sidecar.';
  return 'Setup complete. Runtime features are ready.';
}

function html(state: PreflightState, logoUri: string): string {
  const rows = [
    ['SkillGate CLI', state.cliInstalled],
    ['Authenticated session', state.authenticated],
    ['Local sidecar (127.0.0.1:9911)', state.sidecarRunning],
  ];
  const rowHtml = rows
    .map(
      ([label, ok]) =>
        `<tr><td>${label}</td><td><span style="font-weight:600;color:${asColor(Boolean(ok))}">${asBadge(Boolean(ok))}</span></td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 18px; color: #e5e7eb; background: #0b1020; }
      .card { border: 1px solid #1f2937; border-radius: 12px; padding: 16px; background: #111827; }
      .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
      .brand img { width: 32px; height: 32px; }
      .step { margin: 0 0 10px; font-weight: 600; color: #a7f3d0; }
      table td { padding: 6px 0; border-bottom: 1px solid #1f2937; }
      button { border: 1px solid #374151; background: #0f172a; color: #e5e7eb; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
      button:hover { background: #111827; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">
        <img src="${logoUri}" alt="SkillGate" />
        <h2 style="margin:0;">SkillGate Setup</h2>
      </div>
      <p class="step">Next step: ${nextStepText(state)}</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tbody>${rowHtml}</tbody>
      </table>
      <p style="margin-top:12px;opacity:.8;">Last checked: ${state.checkedAt}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap; margin-top: 14px;">
        <button id="retry">Retry Checks</button>
        <button id="install">Install CLI</button>
        <button id="login">Login</button>
        <button id="sidecar">Start Sidecar</button>
      </div>
      <p style="margin-top:10px;opacity:.8;">
        Install guide: <a href="${state.cliInstallHint}" style="color:#34d399;">${state.cliInstallHint}</a>
      </p>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      document.getElementById('retry').addEventListener('click', () => vscode.postMessage({ type: 'retry' }));
      document.getElementById('install').addEventListener('click', () => vscode.postMessage({ type: 'install-cli' }));
      document.getElementById('login').addEventListener('click', () => vscode.postMessage({ type: 'login' }));
      document.getElementById('sidecar').addEventListener('click', () => vscode.postMessage({ type: 'start-sidecar' }));
    </script>
  </body>
</html>`;
}

export function openOnboardingPanel(
  extensionUri: vscode.Uri,
  state: PreflightState,
  handlers: {
    onRetry: () => void;
    onInstallCli: () => void;
    onLogin: () => void;
    onStartSidecar: () => void;
  },
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'skillgate-onboarding',
    'SkillGate Setup',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')],
    },
  );
  const logoUri = panel.webview
    .asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'extension-icon.png'))
    .toString();
  panel.webview.html = html(state, logoUri);
  panel.webview.onDidReceiveMessage((event) => {
    if (event.type === 'retry') {
      handlers.onRetry();
      return;
    }
    if (event.type === 'install-cli') {
      handlers.onInstallCli();
      return;
    }
    if (event.type === 'login') {
      handlers.onLogin();
      return;
    }
    if (event.type === 'start-sidecar') {
      handlers.onStartSidecar();
    }
  });
  return panel;
}
