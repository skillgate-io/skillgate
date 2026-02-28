/* React Query auth hook contract for migration-mode parity (17.194). */
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  requestPasswordReset,
  confirmPasswordReset,
  requestEmailVerification,
  confirmEmailVerification,
} from '@/lib/api-client';
import { clearTokens } from '@/lib/auth';

export const authKeys = {
  all: ['auth'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  verification: () => [...authKeys.all, 'verification'] as const,
} as const;

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => requestPasswordReset(email),
    retry: false,
  });
}

export function useConfirmPasswordReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { token: string; newPassword: string }) => {
      return confirmPasswordReset(payload.token, payload.newPassword);
    },
    retry: false,
    onSuccess: () => {
      clearTokens();
      queryClient.setQueryData(authKeys.user(), null);
      queryClient.invalidateQueries({ queryKey: authKeys.user() });
    },
  });
}

export function useRequestEmailVerification() {
  return useMutation({
    mutationFn: async (email: string) => requestEmailVerification(email),
    retry: false,
  });
}

export function useConfirmEmailVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => confirmEmailVerification(token),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.user() });
      queryClient.invalidateQueries({ queryKey: authKeys.verification() });
    },
  });
}
