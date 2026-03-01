import * as vscode from 'vscode';
import { SkillgateClient } from './skillgateClient';

const DEFAULT_INVOCATION = {
  invocation_id: 'inv-1',
  timestamp: '2026-02-26T00:00:00Z',
  actor: {
    type: 'agent',
    id: 'agent-1',
    workspace_id: 'ws-1',
    session_id: 'session-1',
  },
  agent: {
    name: 'codex',
    version: '1.0.0',
    framework: 'codex',
    trust_tier: 'trusted',
  },
  tool: {
    name: 'shell',
    provider: 'local',
    capabilities: ['shell.exec'],
    risk_class: 'high',
  },
  request: {
    params: { command: 'echo hello' },
    resource_refs: [],
  },
  context: {
    repo: '/repo',
    environment: 'dev',
    data_classification: 'internal',
    network_zone: 'local',
  },
};

function panelHtml(): string {
  return `<!doctype html>
<html>
  <body>
    <h2>SkillGate Invocation Simulation</h2>
    <p>Paste ToolInvocation JSON and run local sidecar decision.</p>
    <textarea id="invocation" style="width:100%;height:220px"></textarea>
    <br />
    <button id="run">Simulate</button>
    <pre id="result"></pre>
    <script>
      const vscode = acquireVsCodeApi();
      const textarea = document.getElementById('invocation');
      const result = document.getElementById('result');
      textarea.value = ${JSON.stringify(JSON.stringify(DEFAULT_INVOCATION, null, 2))};
      document.getElementById('run').addEventListener('click', () => {
        vscode.postMessage({ type: 'simulate', payload: textarea.value });
      });
      window.addEventListener('message', (event) => {
        result.textContent = event.data;
      });
    </script>
  </body>
</html>`;
}

export function openSimulationPanel(client: SkillgateClient): void {
  const panel = vscode.window.createWebviewPanel(
    'skillgate-simulation',
    'SkillGate Simulation',
    vscode.ViewColumn.Beside,
    { enableScripts: true },
  );
  panel.webview.html = panelHtml();
  panel.webview.onDidReceiveMessage(async (event) => {
    if (event.type !== 'simulate') {
      return;
    }
    try {
      const payload = JSON.parse(String(event.payload)) as Record<string, unknown>;
      const result = await client.simulateInvocation(payload);
      panel.webview.postMessage(JSON.stringify(result, null, 2));
    } catch (error) {
      panel.webview.postMessage(`Simulation failed: ${String(error)}`);
    }
  });
}
