'use client';

import type { ReactNode } from 'react';

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-stripe-purple/10 px-2.5 py-0.5 text-xs font-medium text-stripe-purple ring-1 ring-inset ring-stripe-purple/20">
      {children}
    </span>
  );
}

export function RepoHeader({
  name,
  fullName,
}: {
  name: string;
  fullName: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-fd-border pb-4 mb-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stripe-purple/10 text-stripe-purple">
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
          />
        </svg>
      </div>
      <div>
        <h2 className="font-semibold text-fd-foreground">{name}</h2>
        <p className="text-sm text-fd-muted-foreground">{fullName}</p>
      </div>
      <Badge>PUBLIC API</Badge>
    </div>
  );
}
