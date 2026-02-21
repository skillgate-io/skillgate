/* 16.14: Typed API client with retry/backoff, timeout handling, and error envelopes.
 *
 * Contract gates (7.3):
 * - POST /api/v1/payments/checkout returns Stripe-hosted URL only
 * - All frontend payment actions are idempotent
 * - Every user-visible error maps to a typed backend error code
 */

/** Typed API error envelope matching backend error contract */
export interface ApiError {
  status: number;
  code: string;
  message: string;
  retryable: boolean;
}

// --- Auth types matching backend Pydantic models ---

export interface SignupRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface SignupResponse {
  status: string;
  verification_required: boolean;
  verification_token?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  session_id: string;
  user_id: string;
  email: string;
}

export interface UserResponse {
  user_id: string;
  email: string;
  full_name: string | null;
  email_verified: boolean;
  tier: 'free' | 'pro' | 'team' | 'enterprise';
  subscription_status: string | null;
  billing_interval: 'monthly' | 'yearly' | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface EmailVerificationRequestResponse {
  status: string;
  verification_token?: string;
}

/** Checkout request matching backend CheckoutRequest model */
export interface CheckoutRequest {
  tier: 'pro' | 'team' | 'enterprise';
  billing_interval?: 'monthly' | 'yearly'; // Sprint 7.2: annual billing support
  customer_email?: string;
  success_url: string;
  cancel_url: string;
}

/** Checkout response matching backend CheckoutResponse model */
export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
}

export type RoadmapStatus = 'live' | 'removed_from_ui' | 'planned' | 'in_progress';

export interface MarketingRoadmapItem {
  id: string;
  title: string;
  status: RoadmapStatus;
  reason: string;
  target_tier: 'free' | 'pro' | 'team' | 'enterprise' | 'multi-tier';
  proof_surface: string;
  implementation_task: string | null;
}

export interface MarketingRoadmapResponse {
  version: string;
  updated_at: string;
  category: string;
  posture: string;
  items: MarketingRoadmapItem[];
}

export interface PricingCatalogTier {
  id: 'free' | 'pro' | 'team' | 'enterprise';
  name: string;
  monthly_price: number;
  yearly_price: number;
  description: string;
  cta: string;
  highlighted: boolean;
  strategic_label?: string | null;
  narrative: string;
  control_layer_summary: string;
  stack_coverage: Array<
    | 'static_scan'
    | 'policy_engine'
    | 'ci_enforcement'
    | 'runtime_gateway'
    | 'capability_budgets'
    | 'trust_propagation'
    | 'intelligence_graph'
  >;
  features: string[];
  limits: string[];
  annual_contract_only?: boolean;
}

export interface PricingCatalogControlLayer {
  id: PricingCatalogTier['stack_coverage'][number];
  title: string;
  description: string;
}

export interface PricingCatalogComparisonRow {
  id: string;
  category: 'Static Governance' | 'CI & Fleet Governance' | 'Runtime & Org Control Plane';
  capability: string;
  free: 'yes' | 'partial' | 'no';
  pro: 'yes' | 'partial' | 'no';
  team: 'yes' | 'partial' | 'no';
  enterprise: 'yes' | 'partial' | 'no';
}

export interface PricingCatalogResponse {
  version: string;
  updated_at: string;
  narrative_variant_default: 'control-layer-led' | 'feature-led';
  annual_discount_percent: number;
  beta_free_onboarding_enabled?: boolean;
  tiers: PricingCatalogTier[];
  control_stack_layers: PricingCatalogControlLayer[];
  comparison_rows: PricingCatalogComparisonRow[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.skillgate.io/api/v1';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;

/**
 * Classify HTTP errors into user-actionable error states.
 */
function classifyError(status: number, body?: string): ApiError {
  const parsed = body ? tryParseJson(body) : null;
  const detail = parsed?.detail || 'An unexpected error occurred';

  switch (true) {
    case status === 400:
      return { status, code: 'BAD_REQUEST', message: detail, retryable: false };
    case status === 401:
      return { status, code: 'UNAUTHORIZED', message: 'Please sign in to continue.', retryable: false };
    case status === 403:
      return { status, code: 'FORBIDDEN', message: 'You don\'t have permission for this action.', retryable: false };
    case status === 404:
      return { status, code: 'NOT_FOUND', message: 'The requested resource was not found.', retryable: false };
    case status === 409:
      return { status, code: 'CONFLICT', message: detail, retryable: false };
    case status === 429:
      return { status, code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.', retryable: true };
    case status === 503:
      return { status, code: 'SERVICE_UNAVAILABLE', message: 'Service is temporarily unavailable. Please try again.', retryable: true };
    case status >= 500:
      return { status, code: 'SERVER_ERROR', message: 'Something went wrong on our end. Please try again.', retryable: true };
    default:
      return { status, code: 'UNKNOWN', message: detail, retryable: false };
  }
}

function tryParseJson(text: string): Record<string, string> | null {
  try {
    return JSON.parse(text) as Record<string, string>;
  } catch {
    return null;
  }
}

/**
 * Fetch with timeout support.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Execute an API call with exponential backoff retry for retryable errors.
 */
async function apiCall<T>(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<T> {
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);

      if (response.ok) {
        return (await response.json()) as T;
      }

      const body = await response.text();
      lastError = classifyError(response.status, body);

      // Only retry on retryable errors
      if (!lastError.retryable || attempt === retries) {
        throw lastError;
      }
    } catch (error) {
      if (isApiError(error)) {
        if (!error.retryable || attempt === retries) throw error;
        lastError = error;
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = {
          status: 408,
          code: 'TIMEOUT',
          message: 'Request timed out. Please check your connection and try again.',
          retryable: true,
        };
        if (attempt === retries) throw lastError;
      } else if (!navigator.onLine) {
        throw {
          status: 0,
          code: 'OFFLINE',
          message: 'You appear to be offline. Please check your connection.',
          retryable: false,
        } satisfies ApiError;
      } else {
        lastError = {
          status: 0,
          code: 'NETWORK_ERROR',
          message: 'Unable to reach the server. Please try again.',
          retryable: true,
        };
        if (attempt === retries) throw lastError;
      }
    }

    // Exponential backoff with jitter
    const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
    const jitter = Math.random() * backoff * 0.3;
    await new Promise((r) => setTimeout(r, backoff + jitter));
  }

  throw lastError;
}

/** Type guard for ApiError */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Create a Stripe Checkout session and return the hosted URL.
 *
 * Contract (7.3): Returns Stripe-hosted URL only — no card data touches our frontend.
 * Idempotent: Creating multiple sessions is safe; each session has its own ID.
 */
export async function createCheckoutSession(
  request: CheckoutRequest,
  idempotencyKey?: string,
): Promise<CheckoutResponse> {
  return apiCall<CheckoutResponse>(`${API_BASE}/payments/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(request),
  });
}

/**
 * Validate a license key.
 */
export async function validateLicense(apiKey: string): Promise<{
  valid: boolean;
  tier: string | null;
  rate_limit: number | null;
}> {
  return apiCall(`${API_BASE}/license/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  });
}

/**
 * Health check — verify API is reachable.
 */
export async function healthCheck(): Promise<{ status: string }> {
  return apiCall(`${API_BASE}/health`, { method: 'GET' }, 1);
}

// --- Auth API (16.19) ---

/** Create a new user account. */
export async function signup(request: SignupRequest): Promise<SignupResponse> {
  return apiCall<SignupResponse>(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  }, 0); // No retry on auth
}

/** Authenticate with email + password. */
export async function login(request: LoginRequest): Promise<AuthResponse> {
  return apiCall<AuthResponse>(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  }, 0);
}

/** Revoke the current session. */
export async function logout(accessToken: string): Promise<void> {
  await apiCall<{ status: string }>(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 0);
}

/** Exchange a refresh token for new access + refresh tokens. */
export async function refreshTokens(refreshToken: string): Promise<AuthResponse> {
  return apiCall<AuthResponse>(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken } satisfies RefreshRequest),
  }, 1);
}

/** Get the current authenticated user profile. */
export async function getMe(accessToken: string): Promise<UserResponse> {
  return apiCall<UserResponse>(`${API_BASE}/auth/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 1);
}

// --- Profile API ---

import type {
  ProfileUpdateRequest,
  AccountDeleteRequest,
  APIKeyInfo,
  APIKeyCreateRequest,
  APIKeyCreateResponse,
  UsageMetrics,
  ScanListResponse,
  CustomerPortalResponse,
} from '@/lib/types/dashboard';

/** Update user profile (name, email). */
export async function updateProfile(
  accessToken: string,
  req: ProfileUpdateRequest,
): Promise<UserResponse> {
  return apiCall<UserResponse>(`${API_BASE}/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(req),
  }, 0);
}

/** Request a new email verification link. */
export async function requestEmailVerification(email: string): Promise<EmailVerificationRequestResponse> {
  return apiCall<EmailVerificationRequestResponse>(`${API_BASE}/auth/verify-email/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }, 0);
}

/** Confirm email verification using token from verification link. */
export async function confirmEmailVerification(token: string): Promise<{ status: string }> {
  return apiCall<{ status: string }>(`${API_BASE}/auth/verify-email/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }, 0);
}

/** Soft-delete user account. Requires password + "DELETE" confirmation. */
export async function deleteAccount(
  accessToken: string,
  req: AccountDeleteRequest,
): Promise<void> {
  await apiCall<{ status: string }>(`${API_BASE}/auth/account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(req),
  }, 0);
}

// --- API Keys ---

/** List all API keys for the authenticated user. */
export async function listApiKeys(
  accessToken: string,
): Promise<{ keys: APIKeyInfo[] }> {
  return apiCall<{ keys: APIKeyInfo[] }>(`${API_BASE}/api-keys`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 1);
}

/** Create a new API key. Returns plaintext key ONE TIME only. */
export async function createApiKey(
  accessToken: string,
  req: APIKeyCreateRequest,
): Promise<APIKeyCreateResponse> {
  return apiCall<APIKeyCreateResponse>(`${API_BASE}/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(req),
  }, 0);
}

/** Revoke an API key. */
export async function revokeApiKey(
  accessToken: string,
  keyId: string,
): Promise<void> {
  await apiCall<{ status: string }>(`${API_BASE}/api-keys/${keyId}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 0);
}

/** Rotate an API key (revoke old, issue new). */
export async function rotateApiKey(
  accessToken: string,
  keyId: string,
): Promise<APIKeyCreateResponse> {
  return apiCall<APIKeyCreateResponse>(`${API_BASE}/api-keys/${keyId}/rotate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 0);
}

// --- Usage Metrics ---

/** Get aggregated usage metrics for the authenticated user. */
export async function getUsageMetrics(
  accessToken: string,
): Promise<UsageMetrics> {
  return apiCall<UsageMetrics>(`${API_BASE}/usage/metrics`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 1);
}

// --- Scans ---

/** List stored scan results with pagination. */
export async function listScans(
  accessToken: string,
  limit: number = 20,
  offset: number = 0,
): Promise<ScanListResponse> {
  return apiCall<ScanListResponse>(
    `${API_BASE}/scans?limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    1,
  );
}

// --- Billing ---

/** Create a Stripe Customer Portal session URL. */
export async function createCustomerPortal(
  accessToken: string,
): Promise<CustomerPortalResponse> {
  return apiCall<CustomerPortalResponse>(`${API_BASE}/payments/portal`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 0);
}

// --- Roadmap ---

/** Get backend-managed marketing roadmap and claim restoration backlog. */
export async function getMarketingRoadmap(): Promise<MarketingRoadmapResponse> {
  return apiCall<MarketingRoadmapResponse>(`${API_BASE}/roadmap/marketing`, {
    method: 'GET',
  }, 1);
}

/** Get backend-managed pricing catalog for marketing pages. */
export async function getPricingCatalog(): Promise<PricingCatalogResponse> {
  return apiCall<PricingCatalogResponse>(`${API_BASE}/pricing/catalog`, {
    method: 'GET',
  }, 1);
}
