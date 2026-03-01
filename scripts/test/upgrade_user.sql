-- Set user tier directly for beta testing (no Stripe integration yet).
--
-- Why this script does UPDATE then INSERT:
-- subscriptions.user_id is not unique, so ON CONFLICT (user_id) is invalid.
-- This pattern works without requiring a unique constraint on user_id.
--
-- Change these values:
--   target_email: user email
--   target_tier:  free | pro | team | enterprise

WITH config AS (
  SELECT
    'praveen.yellamaraju@gmail.com'::text AS target_email,
    'pro'::text AS target_tier
),
target_user AS (
  SELECT u.id
  FROM users u
  JOIN config c ON u.email = c.target_email
  LIMIT 1
),
updated_rows AS (
  UPDATE subscriptions s
  SET
    tier = c.target_tier,
    status = 'active',
    billing_interval = 'monthly',
    current_period_end = (now() + interval '30 days')::timestamp,
    cancel_at_period_end = false,
    updated_at = now()::timestamp
  FROM target_user tu, config c
  WHERE s.user_id = tu.id
  RETURNING s.user_id
)
INSERT INTO subscriptions (
  id,
  user_id,
  stripe_subscription_id,
  stripe_customer_id,
  tier,
  status,
  billing_interval,
  current_period_end,
  cancel_at_period_end,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  tu.id,
  'beta_sub_' || replace(tu.id, '-', ''),
  'beta_cus_' || replace(tu.id, '-', ''),
  c.target_tier,
  'active',
  'monthly',
  (now() + interval '30 days')::timestamp,
  false,
  now()::timestamp,
  now()::timestamp
FROM target_user tu
CROSS JOIN config c
WHERE NOT EXISTS (SELECT 1 FROM updated_rows);

-- Verify result for the configured email.
WITH config AS (
  SELECT 'praveen.yellamaraju@gmail.com'::text AS target_email
)
SELECT
  u.email,
  s.tier,
  s.status,
  s.billing_interval,
  s.current_period_end
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
JOIN config c ON c.target_email = u.email;
