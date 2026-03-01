import * as vscode from 'vscode';
import { ApprovalRequestRecord } from './types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function html(items: ApprovalRequestRecord[]): string {
  const rows =
    items.length === 0
      ? '<tr><td colspan="5" style="opacity:.8;">No pending approval requests found.</td></tr>'
      : items
          .map(
            (item) => `<tr>
  <td title="${escapeHtml(item.approval_id)}">${escapeHtml(item.approval_id)}</td>
  <td>${escapeHtml(item.status)}</td>
  <td>${escapeHtml(item.decision_code)}</td>
  <td title="${escapeHtml(item.invocation_id)}">${escapeHtml(item.invocation_id)}</td>
  <td title="${escapeHtml(item.created_at)}">${escapeHtml(item.created_at)}</td>
</tr>`,
          )
          .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 16px; color: #e5e7eb; background: #0b1020; }
      .card { border: 1px solid #1f2937; border-radius: 12px; padding: 14px; background: #111827; }
      table { border-collapse: collapse; width: 100%; margin-top: 8px; table-layout: fixed; }
      td, th { border-bottom: 1px solid #1f2937; padding: 6px 4px; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
      th:nth-child(1), td:nth-child(1) { width: 22%; }
      th:nth-child(2), td:nth-child(2) { width: 12%; }
      th:nth-child(3), td:nth-child(3) { width: 22%; }
      th:nth-child(4), td:nth-child(4) { width: 24%; }
      th:nth-child(5), td:nth-child(5) { width: 20%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      button { border: 1px solid #374151; background: #0f172a; color: #e5e7eb; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
      button:hover { background: #111827; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2 style="margin:0 0 8px;">SkillGate Approval Center</h2>
      <p style="margin:0;opacity:.85;">
        End-to-end approval workflow for blocked invocations: create request, sign approval, verify approval.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button id="refresh">Refresh</button>
        <button id="create">Create Request</button>
        <button id="sign">Sign Approval</button>
        <button id="verify">Verify Approval</button>
        <button id="folder">Open Requests Folder</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Approval ID</th>
            <th>Status</th>
            <th>Decision</th>
            <th>Invocation</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
      document.getElementById('create').addEventListener('click', () => vscode.postMessage({ type: 'create' }));
      document.getElementById('sign').addEventListener('click', () => vscode.postMessage({ type: 'sign' }));
      document.getElementById('verify').addEventListener('click', () => vscode.postMessage({ type: 'verify' }));
      document.getElementById('folder').addEventListener('click', () => vscode.postMessage({ type: 'folder' }));
    </script>
  </body>
</html>`;
}

export function openApprovalCenterPanel(
  items: ApprovalRequestRecord[],
  handlers: {
    onRefresh: () => Promise<ApprovalRequestRecord[]>;
    onCreate: () => Promise<void>;
    onSign: () => Promise<void>;
    onVerify: () => Promise<void>;
    onOpenFolder: () => Promise<void>;
  },
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'skillgate-approval-center',
    'SkillGate Approval Center',
    vscode.ViewColumn.Beside,
    { enableScripts: true },
  );

  let latestItems = items;
  const redraw = (): void => {
    panel.webview.html = html(latestItems);
  };
  redraw();

  panel.webview.onDidReceiveMessage(async (event) => {
    if (event.type === 'refresh') {
      latestItems = await handlers.onRefresh();
      redraw();
      return;
    }
    if (event.type === 'create') {
      await handlers.onCreate();
      latestItems = await handlers.onRefresh();
      redraw();
      return;
    }
    if (event.type === 'sign') {
      await handlers.onSign();
      latestItems = await handlers.onRefresh();
      redraw();
      return;
    }
    if (event.type === 'verify') {
      await handlers.onVerify();
      return;
    }
    if (event.type === 'folder') {
      await handlers.onOpenFolder();
    }
  });
  return panel;
}
