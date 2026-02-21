/* AUTO-GENERATED FILE. Run: npm run docs:api:sync */
export const API_INFO = {
  title: "SkillGate API",
  version: "1.0.0",
  server: "https://api.skillgate.io/api/v1",
  specHash: "5aa102288478b97f"
} as const;

export const API_ENDPOINTS = [
  {
    "path": "/api-keys",
    "method": "GET",
    "summary": "List API keys",
    "operationId": "api_keys_list"
  },
  {
    "path": "/api-keys",
    "method": "POST",
    "summary": "Create API key",
    "operationId": "api_keys_create"
  },
  {
    "path": "/api-keys/{key_id}",
    "method": "DELETE",
    "summary": "Revoke API key",
    "operationId": "api_keys_revoke"
  },
  {
    "path": "/auth/login",
    "method": "POST",
    "summary": "Login",
    "operationId": "auth_login"
  },
  {
    "path": "/auth/me",
    "method": "GET",
    "summary": "Current user",
    "operationId": "auth_me"
  },
  {
    "path": "/auth/signup",
    "method": "POST",
    "summary": "Create user account",
    "operationId": "auth_signup"
  },
  {
    "path": "/health",
    "method": "GET",
    "summary": "Health check",
    "operationId": "health_check"
  },
  {
    "path": "/payments/checkout",
    "method": "POST",
    "summary": "Create Stripe Checkout session",
    "operationId": "payments_checkout"
  },
  {
    "path": "/payments/subscription",
    "method": "GET",
    "summary": "Get subscription",
    "operationId": "payments_subscription"
  },
  {
    "path": "/payments/webhook",
    "method": "POST",
    "summary": "Stripe webhook receiver",
    "operationId": "payments_webhook"
  },
  {
    "path": "/scans",
    "method": "GET",
    "summary": "List scan reports",
    "operationId": "scans_list"
  },
  {
    "path": "/scans",
    "method": "POST",
    "summary": "Store scan report",
    "operationId": "scans_create"
  },
  {
    "path": "/teams",
    "method": "GET",
    "summary": "List teams",
    "operationId": "teams_list"
  },
  {
    "path": "/teams",
    "method": "POST",
    "summary": "Create team",
    "operationId": "teams_create"
  }
] as const;
