/* Runtime docs link helpers with automatic fallback. */
'use client';

import { useEffect, useMemo, useState } from 'react';

const PRIMARY_DEFAULT = 'https://docs.skillgate.io';
const FALLBACK_BASE = 'https://skillgate.io/docs';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeConfiguredBase(): string {
  const configured = (process.env.NEXT_PUBLIC_DOCS_BASE_URL || '').trim();
  if (!configured) return PRIMARY_DEFAULT;
  return trimTrailingSlash(configured);
}

function isRelativeBase(value: string): boolean {
  return value.startsWith('/');
}

export function useDocsBaseUrl(): string {
  const primaryBase = useMemo(normalizeConfiguredBase, []);
  const [resolvedBase, setResolvedBase] = useState<string>(
    isRelativeBase(primaryBase) ? primaryBase : FALLBACK_BASE,
  );

  useEffect(() => {
    if (isRelativeBase(primaryBase)) {
      setResolvedBase(primaryBase);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);

    fetch(primaryBase, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(() => setResolvedBase(primaryBase))
      .catch(() => setResolvedBase(FALLBACK_BASE))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [primaryBase]);

  return resolvedBase;
}

export function docsUrl(base: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimTrailingSlash(base)}${normalizedPath}`;
}
