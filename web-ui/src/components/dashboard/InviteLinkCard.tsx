'use client';

import { useState } from 'react';
import { Card } from '@/components/dashboard/Card';
import { Button } from '@/components/ui/Button';
import { trackEvent } from '@/lib/analytics';

interface InviteLinkCardProps {
  userId: string | null | undefined;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function InviteLinkCard({ userId }: InviteLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function handleCopyInviteLink() {
    if (!userId) return;
    setError('');
    const origin = window.location.origin;
    const inviteLink = `${origin}/signup?ref=${encodeURIComponent(userId)}`;
    const ok = await copyText(inviteLink);

    if (!ok) {
      setError('Could not copy link. Please try again.');
      return;
    }

    setCopied(true);
    trackEvent('share_clicked', 'dashboard_invite_link', { surface: 'dashboard' });
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Card
      title="Invite a Teammate"
      description="Share a signup link. Bring one teammate to unlock faster team rollout."
      action={(
        <Button size="sm" onClick={handleCopyInviteLink} disabled={!userId}>
          {copied ? 'Copied' : 'Copy Invite Link'}
        </Button>
      )}
    >
      <p className="text-sm text-surface-400">
        This link opens signup with invite attribution so you can measure team-led growth.
      </p>
      {error && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
      {copied && (
        <p className="mt-2 text-xs text-emerald-400" role="status">
          Invite link copied.
        </p>
      )}
    </Card>
  );
}
