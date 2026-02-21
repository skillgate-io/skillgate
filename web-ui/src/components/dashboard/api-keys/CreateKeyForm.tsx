/* Create API key form with name + scope selection. */
'use client';

import { useState, type FormEvent } from 'react';
import { useCreateApiKey } from '@/lib/hooks/use-dashboard';
import { isApiError } from '@/lib/api-client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { APIKeyCreateResponse } from '@/lib/types/dashboard';

const AVAILABLE_SCOPES = [
  { id: 'scan:read', label: 'Read scans' },
  { id: 'scan:write', label: 'Submit scans' },
  { id: 'team:read', label: 'Read team' },
  { id: 'team:write', label: 'Manage team' },
  { id: 'billing:read', label: 'Read billing' },
] as const;

interface CreateKeyFormProps {
  onCreated: (key: APIKeyCreateResponse) => void;
  onCancel: () => void;
}

export function CreateKeyForm({ onCreated, onCancel }: CreateKeyFormProps) {
  const createKey = useCreateApiKey();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<Set<string>>(new Set(['scan:read', 'scan:write']));
  const [error, setError] = useState('');

  function toggleScope(scope: string) {
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (scopes.size === 0) {
      setError('Select at least one scope.');
      return;
    }

    try {
      const result = await createKey.mutateAsync({
        name: name.trim(),
        scopes: Array.from(scopes),
      });
      onCreated(result);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Failed to create API key.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Key Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. CI Pipeline, Local Dev"
        maxLength={80}
        autoFocus
      />

      <div>
        <p className="mb-2 text-sm font-medium text-surface-200">Scopes</p>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_SCOPES.map((scope) => (
            <button
              key={scope.id}
              type="button"
              onClick={() => toggleScope(scope.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                scopes.has(scope.id)
                  ? 'border-brand-500/50 bg-brand-600/10 text-brand-400'
                  : 'border-white/10 bg-white/[0.02] text-surface-400 hover:border-white/20'
              }`}
            >
              {scope.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">{error}</p>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-surface-300"
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={createKey.isPending}>
          Create Key
        </Button>
      </div>
    </form>
  );
}
