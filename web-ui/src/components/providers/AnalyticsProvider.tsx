/* 16.17: Analytics provider — initializes event tracking at app mount */
'use client';

import { useEffect } from 'react';
import { initAnalytics, trackEvent } from '@/lib/analytics';

export function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initAnalytics();
    trackEvent('page_view');
  }, []);

  return <>{children}</>;
}
