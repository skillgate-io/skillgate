/* Auth context provider — React Query-powered session management.
 *
 * Performance optimizations for scale:
 * - useQuery for /me: cached, deduplicated, stale-while-revalidate
 * - useMutation for login/signup/logout: no duplicate requests
 * - Token refresh is lazy (only on 401), not polling
 * - Query cache invalidation on auth state change
 */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type UserResponse,
  type SignupRequest,
  type SignupResponse,
  type LoginRequest,
  signup as apiSignup,
  login as apiLogin,
  logout as apiLogout,
  refreshTokens,
  getMe,
  isApiError,
} from '@/lib/api-client';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  setEmailVerified,
  clearTokens,
} from '@/lib/auth';

export const USER_QUERY_KEY = ['auth', 'user'] as const;

interface AuthState {
  user: UserResponse | null;
  loading: boolean;
  signup: (req: SignupRequest) => Promise<SignupResponse>;
  login: (req: LoginRequest) => Promise<UserResponse>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  tier: 'free' | 'pro' | 'team' | 'enterprise';
}

const AuthContext = createContext<AuthState | null>(null);

/** Fetch current user, with transparent token refresh on 401. */
async function fetchCurrentUser(): Promise<UserResponse | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    return await getMe(token);
  } catch (err) {
    if (isApiError(err) && err.status === 401) {
      // Try refresh
      const rt = getRefreshToken();
      if (rt) {
        try {
          const res = await refreshTokens(rt);
          setTokens(res.access_token, res.refresh_token);
          return await getMe(res.access_token);
        } catch {
          clearTokens();
          return null;
        }
      }
      clearTokens();
    }
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Mounted guard: SSR and initial client hydration both render with loading=true
  // to avoid hydration mismatch on auth-dependent UI (Header links, etc.)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Cached user query — deduplicated across all components using useAuth()
  const { data: user = null, isLoading } = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 10 * 60 * 1000, // 10 min — user profile rarely changes
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: mounted,
  });

  useEffect(() => {
    if (!mounted) return;
    if (user !== null) setEmailVerified(user.email_verified);
  }, [user, mounted]);

  const signupMutation = useMutation({
    mutationFn: async (req: SignupRequest) => apiSignup(req),
    onSuccess: () => {
      clearTokens();
      queryClient.setQueryData(USER_QUERY_KEY, null);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (req: LoginRequest) => {
      const res = await apiLogin(req);
      setTokens(res.access_token, res.refresh_token);
      return getMe(res.access_token);
    },
    onSuccess: (userData) => {
      setEmailVerified(userData.email_verified);
      queryClient.setQueryData(USER_QUERY_KEY, userData);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const token = getAccessToken();
      if (token) {
        try { await apiLogout(token); } catch { /* best-effort */ }
      }
      clearTokens();
    },
    onSuccess: () => {
      queryClient.setQueryData(USER_QUERY_KEY, null);
      // Clear all cached queries on logout (security)
      queryClient.clear();
    },
  });

  const signup = useCallback(
    async (req: SignupRequest) => signupMutation.mutateAsync(req),
    [signupMutation],
  );

  const login = useCallback(
    async (req: LoginRequest) => loginMutation.mutateAsync(req),
    [loginMutation],
  );

  const logout = useCallback(
    async () => { await logoutMutation.mutateAsync(); },
    [logoutMutation],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading: !mounted || isLoading,
      signup,
      login,
      logout,
      isAuthenticated: user !== null,
      tier: user?.tier || 'free',
    }),
    [user, isLoading, mounted, signup, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
