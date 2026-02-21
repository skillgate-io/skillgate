/* Profile page — edit name/email, view verification status, delete account. */
'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUpdateProfile, useDeleteAccount } from '@/lib/hooks/use-dashboard';
import { isApiError } from '@/lib/api-client';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Card } from '@/components/dashboard/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export default function ProfilePage() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const deleteAccountMutation = useDeleteAccount();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    try {
      await updateProfile.mutateAsync({
        full_name: fullName || undefined,
        email: email !== user?.email ? email : undefined,
      });
      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      setProfileError(
        isApiError(err) ? err.message : 'Failed to update profile.',
      );
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    if (deleteConfirmation !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm.');
      return;
    }

    try {
      await deleteAccountMutation.mutateAsync({
        password: deletePassword,
        confirmation: 'DELETE',
      });
      // Redirect happens in the mutation onSuccess
    } catch (err) {
      setDeleteError(
        isApiError(err) ? err.message : 'Failed to delete account.',
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Manage your account information."
      />

      {/* Profile form */}
      <Card title="Account Information">
        <form onSubmit={handleProfileSubmit} className="max-w-md space-y-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            maxLength={120}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-400">Email verification:</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                user?.email_verified
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {user?.email_verified ? 'Verified' : 'Unverified'}
            </span>
          </div>

          {profileError && (
            <p className="text-sm text-red-400" role="alert">{profileError}</p>
          )}
          {profileSuccess && (
            <p className="text-sm text-emerald-400" role="status">{profileSuccess}</p>
          )}

          <Button
            type="submit"
            loading={updateProfile.isPending}
            size="sm"
          >
            Save Changes
          </Button>
        </form>
      </Card>

      {/* Danger zone */}
      <Card
        title="Danger Zone"
        className="border-red-500/20"
      >
        <p className="mb-3 text-sm text-surface-400">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setDeleteModalOpen(true)}
        >
          Delete Account
        </Button>
      </Card>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletePassword('');
          setDeleteConfirmation('');
          setDeleteError('');
        }}
        title="Delete Account"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            This will permanently deactivate your account, revoke all API keys,
            and anonymize your data. You will not be able to recover your account.
          </p>
          <Input
            label="Password"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
          <Input
            label='Type "DELETE" to confirm'
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="DELETE"
          />

          {deleteError && (
            <p className="text-sm text-red-400" role="alert">{deleteError}</p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              className="text-surface-300"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteAccount}
              loading={deleteAccountMutation.isPending}
              disabled={deleteConfirmation !== 'DELETE' || !deletePassword}
            >
              Delete My Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
