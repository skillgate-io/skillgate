/* Dashboard TypeScript types matching backend Pydantic models. */

// --- Profile ---

export interface ProfileUpdateRequest {
  full_name?: string;
  email?: string;
}

export interface AccountDeleteRequest {
  password: string;
  confirmation: 'DELETE';
}

// --- API Keys ---

export interface APIKeyInfo {
  key_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  revoked: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface APIKeyCreateRequest {
  name: string;
  scopes: string[];
}

export interface APIKeyCreateResponse {
  key_id: string;
  api_key: string; // one-time plaintext — show once, never retrievable
  key_prefix: string;
  name: string;
  scopes: string[];
  created_at: string;
}

// --- Usage ---

export interface UsageMetrics {
  tier: string;
  scan_count_total: number;
  scan_count_30d: number;
  scan_count_7d: number;
  scan_count_today: number;
  api_key_count: number;
  api_key_active_count: number;
  scan_limit_per_day: number | null; // null = unlimited
  api_rate_limit_per_min: number;
  last_scan_at: string | null;
}

// --- Scans ---

export interface ScanListItem {
  scan_id: string;
  stored_at: string;
  report: {
    bundle_name?: string;
    risk_score?: { total: number; severity: string };
    findings?: Array<{ rule_id: string; severity: string; message: string }>;
    policy?: { passed: boolean };
  };
}

export interface ScanListResponse {
  scans: ScanListItem[];
  total: number;
}

// --- Billing ---

export interface CustomerPortalResponse {
  portal_url: string;
}

export type Tier = 'free' | 'pro' | 'team' | 'enterprise';

export const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  pro: 1,
  team: 2,
  enterprise: 3,
};

/** Check if user's tier meets the required tier level. */
export function hasTierAccess(current: Tier, required: Tier): boolean {
  return TIER_ORDER[current] >= TIER_ORDER[required];
}
