'use client';

import React, { useState, useCallback } from 'react';

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable (e.g. non-HTTPS dev context) — fail silently
    }
  }, [code]);

  return (
    <div className="group relative">
      <pre
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-[#1b2a43] bg-[#09101d] p-4 pr-10 text-sm text-surface-200 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy code'}
        className={`absolute right-2 top-2 z-10 flex items-center rounded-md border p-1.5 transition-all duration-150 ${
          copied
            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
            : 'border-white/20 bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500'
        }`}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}
