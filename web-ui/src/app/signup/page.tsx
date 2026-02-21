/* Signup page — create a new SkillGate account. */
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignupForm } from '@/components/auth/SignupForm';

export const metadata: Metadata = {
  title: 'Sign Up | SkillGate',
  description: 'Create your SkillGate account to scan agent skills for security risks.',
};

export default function SignupPage() {
  return (
    <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4 py-16">
      <Suspense>
        <SignupForm />
      </Suspense>
    </div>
  );
}
