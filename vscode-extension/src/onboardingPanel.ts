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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function html(state: PreflightState, logoUri: string): string {
  const sidecarTarget = state.sidecarUrl ?? 'http://127.0.0.1:9911';
  const rows = [
    ['SkillGate CLI', state.cliInstalled],
    ['Authenticated session', state.authenticated],
    [`Local sidecar (${sidecarTarget})`, state.sidecarRunning],
  ];
  const rowHtml = rows
    .map(
      ([label, ok]) =>
        `<tr><td>${label}</td><td><span style="font-weight:600;color:${asColor(Boolean(ok))}">${asBadge(Boolean(ok))}</span></td></tr>`,
    )
    .join('');
  const guidedSteps = state.guided?.steps ?? [];
  const guidedHtml =
    guidedSteps.length === 0
      ? ''
      : `<div style="margin-top:14px;padding-top:10px;border-top:1px solid #1f2937;">
          <p style="margin:0 0 8px;font-weight:600;color:#a7f3d0;">Guided flow</p>
          <ul style="margin:0 0 8px 18px;padding:0;">
            ${guidedSteps
              .map(
                (step) =>
                  `<li style="margin:4px 0;opacity:${step.done ? '0.95' : '0.85'};">${step.done ? '✓' : '○'} ${escapeHtml(step.label)}</li>`,
              )
              .join('')}
          </ul>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px;">
            ${guidedSteps
              .map(
                (step) =>
                  `<button class="guided-step" data-command="${escapeHtml(step.command)}">${step.done ? 'Re-run' : 'Run'} ${escapeHtml(step.label)}</button>`,
              )
              .join('')}
          </div>
          <p style="margin:0 0 8px;opacity:.8;font-size:12px;">
            PR checklist is a reviewer artifact. Use Approval Center only when simulation/policy requires approval.
          </p>
          ${
            state.guided?.nextActionCommand && state.guided?.nextActionLabel
              ? `<button id="guided" data-command="${escapeHtml(state.guided.nextActionCommand)}">${escapeHtml(state.guided.nextActionLabel)}</button>`
              : '<p style="margin:0;opacity:.8;">All guided steps complete.</p>'
          }
        </div>`;

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
      ${guidedHtml}
      ${
        state.authSummary
          ? `<p style="margin-top:12px;opacity:.9;">Authenticated user: <span style="color:#a7f3d0;font-weight:600;">${escapeHtml(state.authSummary)}</span></p>`
          : ''
      }
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
      <p style="margin-top:8px;opacity:.65;font-size:12px;">
        Status auto-refreshes every few seconds while this panel is open.
      </p>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      document.getElementById('retry').addEventListener('click', () => vscode.postMessage({ type: 'retry' }));
      document.getElementById('install').addEventListener('click', () => vscode.postMessage({ type: 'install-cli' }));
      document.getElementById('login').addEventListener('click', () => vscode.postMessage({ type: 'login' }));
      document.getElementById('sidecar').addEventListener('click', () => vscode.postMessage({ type: 'start-sidecar' }));
      const guided = document.getElementById('guided');
      if (guided) {
        guided.addEventListener('click', () =>
          vscode.postMessage({
            type: 'guided-next',
            command: guided.getAttribute('data-command') || '',
          }),
        );
      }
      document.querySelectorAll('.guided-step').forEach((button) => {
        button.addEventListener('click', () =>
          vscode.postMessage({
            type: 'guided-next',
            command: button.getAttribute('data-command') || '',
          }),
        );
      });
    </script>
  </body>
</html>`;
}

export function openOnboardingPanel(
  extensionUri: vscode.Uri,
  state: PreflightState,
  handlers: {
    onRetry: () => PreflightState | Promise<PreflightState>;
    onInstallCli: () => void | Promise<void>;
    onLogin: () => void | Promise<void>;
    onStartSidecar: () => void | Promise<void>;
    onGuidedNext?: (command: string) => void | Promise<void>;
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
  let latestState = state;
  let refreshInFlight = false;
  const refreshState = async (): Promise<PreflightState> => {
    if (refreshInFlight) {
      return latestState;
    }
    refreshInFlight = true;
    try {
      latestState = await handlers.onRetry();
      panel.webview.html = html(latestState, logoUri);
      return latestState;
    } finally {
      refreshInFlight = false;
    }
  };

  panel.webview.html = html(latestState, logoUri);

  const intervalHandle = setInterval(() => {
    void refreshState();
  }, 3000);
  panel.onDidDispose(() => {
    clearInterval(intervalHandle);
  });

  panel.webview.onDidReceiveMessage(async (event) => {
    if (event.type === 'retry') {
      await refreshState();
      return;
    }
    if (event.type === 'install-cli') {
      await handlers.onInstallCli();
      setTimeout(() => {
        void refreshState();
      }, 1200);
      return;
    }
    if (event.type === 'login') {
      await handlers.onLogin();
      setTimeout(() => {
        void refreshState();
      }, 1200);
      return;
    }
    if (event.type === 'start-sidecar') {
      await handlers.onStartSidecar();
      setTimeout(() => {
        void refreshState();
      }, 1200);
      return;
    }
    if (event.type === 'guided-next' && handlers.onGuidedNext) {
      await handlers.onGuidedNext(String(event.command || ''));
      setTimeout(() => {
        void refreshState();
      }, 300);
    }
  });
  return panel;
}
