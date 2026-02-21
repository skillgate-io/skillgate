import { Suspense } from 'react';
import type { Metadata } from 'next';
import { VerifyEmailPanel } from '@/components/auth/VerifyEmailPanel';

export const metadata: Metadata = {
  title: 'Verify Email | SkillGate',
  description: 'Verify your email to continue to the SkillGate dashboard.',
};

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-160px)] w-full max-w-xl items-center px-4 py-16">
      <Suspense>
        <VerifyEmailPanel />
      </Suspense>
    </div>
  );
}
