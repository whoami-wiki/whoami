'use client';

import dynamic from 'next/dynamic';

export const BirthplacesMap = dynamic(
  () => import('./birthplaces-map.client').then(m => m.BirthplacesMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] w-full items-center justify-center rounded-md bg-muted/30 ring-1 ring-foreground/12">
        <p className="font-display text-sm text-muted-foreground">Loading map…</p>
      </div>
    ),
  },
);
