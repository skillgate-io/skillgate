/* API Keys management page — create, list, revoke, rotate. */
'use client';

import { useState, useCallback } from 'react';
import {
  useApiKeys,
  useRevokeApiKey,
  useRotateApiKey,
} from '@/lib/hooks/use-dashboard';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card } from '@/components/dashboard/Card';
import { DataTable, type Column } from '@/components/dashboard/DataTable';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CreateKeyForm } from '@/components/dashboard/api-keys/CreateKeyForm';
import type { APIKeyInfo, APIKeyCreateResponse } from '@/lib/types/dashboard';

export default function ApiKeysPage() {
  const { data, isLoading } = useApiKeys();
  const revokeKey = useRevokeApiKey();
  const rotateKey = useRotateApiKey();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKey, setNewKey] = useState<APIKeyCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'revoke' | 'rotate';
    keyId: string;
    keyName: string;
  } | null>(null);
  const [rotatedKey, setRotatedKey] = useState<APIKeyCreateResponse | null>(null);

  const handleCreated = useCallback((key: APIKeyCreateResponse) => {
    setNewKey(key);
    setShowCreateForm(false);
  }, []);

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;

    if (confirmAction.type === 'revoke') {
      await revokeKey.mutateAsync(confirmAction.keyId);
    } else {
      const result = await rotateKey.mutateAsync(confirmAction.keyId);
      setRotatedKey(result);
    }
    setConfirmAction(null);
  }

  const keys = data?.keys ?? [];

  const columns: Column<APIKeyInfo>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (k) => <span className="font-medium">{k.name}</span>,
    },
    {
      key: 'prefix',
      header: 'Key',
      render: (k) => (
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
          {k.key_prefix}****
        </code>
      ),
    },
    {
      key: 'scopes',
      header: 'Scopes',
      render: (k) => (
        <div className="flex flex-wrap gap-1">
          {k.scopes.map((s) => (
            <span
              key={s}
              className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-surface-400"
            >
              {s}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'last_used',
      header: 'Last Used',
      render: (k) =>
        k.last_used_at
          ? new Date(k.last_used_at).toLocaleDateString()
          : 'Never',
    },
    {
      key: 'status',
      header: 'Status',
      render: (k) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            k.revoked
              ? 'bg-red-500/20 text-red-400'
              : 'bg-emerald-500/20 text-emerald-400'
          }`}
        >
          {k.revoked ? 'Revoked' : 'Active'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (k) =>
        k.revoked ? null : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setConfirmAction({ type: 'rotate', keyId: k.key_id, keyName: k.name })
              }
              className="text-xs text-surface-400 hover:text-brand-400"
            >
              Rotate
            </button>
            <button
              type="button"
              onClick={() =>
                setConfirmAction({ type: 'revoke', keyId: k.key_id, keyName: k.name })
              }
              className="text-xs text-surface-400 hover:text-red-400"
            >
              Revoke
            </button>
          </div>
        ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Create and manage API keys for programmatic access."
        action={
          !showCreateForm && (
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              Create Key
            </Button>
          )
        }
      />

      {/* New key reveal banner */}
      {(newKey || rotatedKey) && (
        <Card className="border-brand-500/30 bg-brand-600/5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-brand-400">
              {rotatedKey ? 'Rotated key' : 'New key'} created. Copy it now because it will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white">
                {(rotatedKey || newKey)!.api_key}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy((rotatedKey || newKey)!.api_key)}
                className="shrink-0 border-white/20 text-surface-200"
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNewKey(null);
                setRotatedKey(null);
              }}
              className="text-surface-400"
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Create form */}
      {showCreateForm && (
        <Card title="Create API Key">
          <CreateKeyForm
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </Card>
      )}

      {/* Key list */}
      {keys.length === 0 && !isLoading ? (
        <EmptyState
          title="No API keys"
          description="Create an API key to access the SkillGate API programmatically."
          action={
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              Create Your First Key
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={keys}
          keyExtractor={(k) => k.key_id}
          loading={isLoading}
        />
      )}

      {/* Confirm revoke/rotate modal */}
      <Modal
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'revoke' ? 'Revoke API Key' : 'Rotate API Key'}
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            {confirmAction?.type === 'revoke'
              ? `This will permanently revoke "${confirmAction.keyName}". Any integrations using this key will stop working.`
              : `This will revoke the current key "${confirmAction?.keyName}" and issue a new one.`}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmAction(null)}
              className="text-surface-300"
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction?.type === 'revoke' ? 'danger' : 'primary'}
              size="sm"
              onClick={handleConfirmAction}
              loading={revokeKey.isPending || rotateKey.isPending}
            >
              {confirmAction?.type === 'revoke' ? 'Revoke Key' : 'Rotate Key'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
