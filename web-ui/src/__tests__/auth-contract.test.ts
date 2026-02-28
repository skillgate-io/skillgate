import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  requestPasswordReset,
  confirmPasswordReset,
  requestEmailVerification,
  confirmEmailVerification,
  login,
  getMe,
} from '@/lib/api-client';

describe('frontend-backend auth contract', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('login envelope remains stable across migration modes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'at',
            refresh_token: 'rt',
            token_type: 'bearer',
            session_id: 'sid',
            user_id: 'uid',
            email: 'u@example.com',
          }),
      }),
    );

    const res = await login({ email: 'u@example.com', password: 'password' });
    expect(res.access_token).toBe('at');
    expect(res.refresh_token).toBe('rt');
    expect(res.user_id).toBe('uid');
    expect(res.email).toBe('u@example.com');
  });

  it('me envelope remains stable across migration modes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            user_id: 'uid',
            email: 'u@example.com',
            full_name: 'User',
            email_verified: true,
            tier: 'free',
            subscription_status: null,
            billing_interval: null,
            current_period_end: null,
            cancel_at_period_end: false,
          }),
      }),
    );

    const res = await getMe('token');
    expect(res.user_id).toBe('uid');
    expect(res.tier).toBe('free');
    expect(res.email_verified).toBe(true);
  });

  it('password-reset and verify endpoints keep response envelope shape', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'sent' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'password_updated' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'sent' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'verified' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const reqReset = await requestPasswordReset('u@example.com');
    const confirmReset = await confirmPasswordReset('token', 'new-password-123456!');
    const reqVerify = await requestEmailVerification('u@example.com');
    const confirmVerify = await confirmEmailVerification('token');

    expect(reqReset.status).toBe('sent');
    expect(confirmReset.status).toBe('password_updated');
    expect(reqVerify.status).toBe('sent');
    expect(confirmVerify.status).toBe('verified');
  });
});
