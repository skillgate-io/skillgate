/* React Query hooks for dashboard data.
 *
 * All data fetching goes through typed API client functions.
 * Mutations invalidate related query keys automatically.
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccessToken, clearTokens } from '@/lib/auth';
import {
  updateProfile,
  deleteAccount,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  rotateApiKey,
  getUsageMetrics,
  listScans,
  createCustomerPortal,
  type UserResponse,
} from '@/lib/api-client';
import type {
  ProfileUpdateRequest,
  AccountDeleteRequest,
  APIKeyCreateRequest,
} from '@/lib/types/dashboard';

// Shared query key for user profile (must match AuthProvider)
export const USER_QUERY_KEY = ['auth', 'user'] as const;

export const dashboardKeys = {
  all: ['dashboard'] as const,
  apiKeys: () => [...dashboardKeys.all, 'api-keys'] as const,
  usage: () => [...dashboardKeys.all, 'usage'] as const,
  scans: (params?: { limit?: number; offset?: number }) =>
    [...dashboardKeys.all, 'scans', params] as const,
} as const;

function requireToken(): string {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}

// --- Profile mutations ---

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: ProfileUpdateRequest) => {
      return updateProfile(requireToken(), req);
    },
    onSuccess: (updatedUser: UserResponse) => {
      queryClient.setQueryData(USER_QUERY_KEY, updatedUser);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: AccountDeleteRequest) => {
      await deleteAccount(requireToken(), req);
    },
    onSuccess: () => {
      clearTokens();
      queryClient.clear();
      window.location.href = '/';
    },
  });
}

// --- API Keys ---

export function useApiKeys() {
  return useQuery({
    queryKey: dashboardKeys.apiKeys(),
    queryFn: () => listApiKeys(requireToken()),
    staleTime: 2 * 60 * 1000, // 2 min
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: APIKeyCreateRequest) => {
      return createApiKey(requireToken(), req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.apiKeys() });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      await revokeApiKey(requireToken(), keyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.apiKeys() });
    },
  });
}

export function useRotateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      return rotateApiKey(requireToken(), keyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.apiKeys() });
    },
  });
}

// --- Usage Metrics ---

export function useUsageMetrics() {
  return useQuery({
    queryKey: dashboardKeys.usage(),
    queryFn: () => getUsageMetrics(requireToken()),
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 15 * 60 * 1000,
  });
}

// --- Scans ---

export function useScans(limit: number = 20, offset: number = 0) {
  return useQuery({
    queryKey: dashboardKeys.scans({ limit, offset }),
    queryFn: () => listScans(requireToken(), limit, offset),
    staleTime: 60 * 1000, // 1 min
    gcTime: 5 * 60 * 1000,
  });
}

// --- Billing ---

export function useCustomerPortal() {
  return useMutation({
    mutationFn: async () => {
      const result = await createCustomerPortal(requireToken());
      window.location.href = result.portal_url;
      return result;
    },
  });
}
