#!/usr/bin/env node

const baseUrl = (process.env.DOCS_HEALTH_BASE_URL || 'https://docs.skillgate.io').replace(/\/+$/, '');
const timeoutMs = Number(process.env.DOCS_HEALTH_TIMEOUT_MS || '8000');

const paths = ['/', '/rules', '/policy'];

async function checkUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'skillgate-web-docs-healthcheck/1.0',
      },
    });

    return {
      url,
      ok: response.status < 400,
      status: response.status,
      finalUrl: response.url,
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: null,
      finalUrl: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const checks = await Promise.all(paths.map((path) => checkUrl(`${baseUrl}${path}`)));
  const failed = checks.filter((entry) => !entry.ok);

  for (const entry of checks) {
    if (entry.ok) {
      console.log(`OK    ${entry.url} -> ${entry.status}${entry.finalUrl && entry.finalUrl !== entry.url ? ` (${entry.finalUrl})` : ''}`);
    } else {
      console.error(`FAIL  ${entry.url} -> ${entry.status ?? 'error'}${entry.error ? ` (${entry.error})` : ''}`);
    }
  }

  if (failed.length > 0) {
    console.error(`\nDocs healthcheck failed: ${failed.length}/${checks.length} endpoint(s) unhealthy.`);
    process.exit(1);
  }

  console.log(`\nDocs healthcheck passed: ${checks.length}/${checks.length} endpoint(s) healthy.`);
}

main().catch((error) => {
  console.error(`Docs healthcheck crashed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
