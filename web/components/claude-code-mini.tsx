"use client";

import { useEffect, useRef, useState } from "react";

interface Entry {
  content: React.ReactNode;
  delay: number;
}

const sequence: Entry[] = [
  {
    delay: 600,
    content: (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <div className="h-1.5 bg-neutral-500 rounded-full w-12" />
          <div className="h-1.5 bg-neutral-600 rounded-full w-32" />
        </div>
        <div className="ml-4 flex flex-col gap-1">
          <div className="h-1.5 bg-neutral-700 rounded-full w-28" />
          <div className="h-1.5 bg-neutral-700 rounded-full w-20" />
        </div>
      </div>
    ),
  },
  {
    delay: 1000,
    content: (
      <div className="flex items-start gap-1.5">
        <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-1.5 bg-neutral-500 rounded-full w-full" />
          <div className="h-1.5 bg-neutral-500 rounded-full w-3/5" />
        </div>
      </div>
    ),
  },
  {
    delay: 750,
    content: (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <div className="h-1.5 bg-neutral-500 rounded-full w-10" />
          <div className="h-1.5 bg-neutral-600 rounded-full w-36" />
        </div>
        <div className="ml-4 flex flex-col gap-1">
          <div className="h-1.5 bg-neutral-700 rounded-full w-16" />
          <div className="h-1.5 bg-neutral-700 rounded-full w-14" />
        </div>
      </div>
    ),
  },
  {
    delay: 900,
    content: (
      <div className="flex items-start gap-1.5">
        <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-0.5" />
        <div className="h-1.5 bg-neutral-500 rounded-full w-3/4" />
      </div>
    ),
  },
  {
    delay: 500,
    content: (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <div className="h-1.5 bg-neutral-500 rounded-full w-10" />
          <div className="h-1.5 bg-neutral-600 rounded-full w-28" />
        </div>
        <div className="ml-4 flex flex-col gap-1">
          <div className="h-1.5 bg-neutral-700 rounded-full w-10" />
          <div className="h-1.5 bg-neutral-700 rounded-full w-24" />
          <div className="h-1.5 bg-neutral-700 rounded-full w-20" />
        </div>
      </div>
    ),
  },
  {
    delay: 1100,
    content: (
      <div className="flex items-start gap-1.5">
        <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-1.5 bg-neutral-500 rounded-full w-full" />
          <div className="h-1.5 bg-neutral-500 rounded-full w-2/5" />
        </div>
      </div>
    ),
  },
  {
    delay: 750,
    content: (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <div className="h-1.5 bg-neutral-500 rounded-full w-10" />
          <div className="h-1.5 bg-neutral-600 rounded-full w-32" />
        </div>
        <div className="ml-4 flex flex-col gap-1">
          <div className="h-1.5 bg-neutral-700 rounded-full w-24" />
          <div className="h-1.5 bg-neutral-700 rounded-full w-20" />
        </div>
      </div>
    ),
  },
  {
    delay: 1250,
    content: (
      <div className="flex items-start gap-1.5">
        <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-1.5 bg-neutral-500 rounded-full w-full" />
          <div className="h-1.5 bg-neutral-500 rounded-full w-4/5" />
        </div>
      </div>
    ),
  },
  {
    delay: 750,
    content: (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <div className="h-1.5 bg-neutral-500 rounded-full w-10" />
          <div className="h-1.5 bg-neutral-600 rounded-full w-28" />
        </div>
        <div className="ml-4 flex flex-col gap-1">
          <div className="h-1.5 bg-neutral-700 rounded-full w-16" />
          <div className="h-1.5 bg-neutral-700 rounded-full w-14" />
        </div>
      </div>
    ),
  },
  {
    delay: 1000,
    content: (
      <div className="flex items-start gap-1.5">
        <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-1.5 bg-neutral-500 rounded-full w-full" />
          <div className="h-1.5 bg-neutral-500 rounded-full w-3/5" />
        </div>
      </div>
    ),
  },
  {
    delay: 600,
    content: (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <div className="h-1.5 bg-neutral-500 rounded-full w-10" />
          <div className="h-1.5 bg-neutral-600 rounded-full w-32" />
        </div>
        <div className="ml-4 flex flex-col gap-1">
          <div className="h-1.5 bg-neutral-700 rounded-full w-20" />
          <div className="h-1.5 bg-neutral-700 rounded-full w-12" />
        </div>
      </div>
    ),
  },
];

export function ClaudeCodeMini() {
  const [visibleCount, setVisibleCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    function scheduleNext() {
      const idx = indexRef.current % sequence.length;
      const delay = sequence[idx].delay;

      return setTimeout(() => {
        indexRef.current++;
        setVisibleCount((c) => c + 1);
        scheduleNext();
      }, delay);
    }

    const timeout = scheduleNext();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [visibleCount]);

  const entries = Array.from({ length: visibleCount }, (_, i) => ({
    key: i,
    content: sequence[i % sequence.length].content,
  }));

  return (
    <div className="not-prose w-full rounded-xl overflow-hidden bg-neutral-900 shadow-2xl border border-neutral-700/50 aspect-[4/3]">
      <div className="aspect-[4/3] overflow-hidden origin-top-left scale-[0.65] w-[153.8%] flex flex-col">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-neutral-800 border-b border-neutral-700/50 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shrink-0" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shrink-0" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 shrink-0" />
          <div className="ml-2 h-1.5 bg-neutral-600 rounded-full w-2/3" />
        </div>

        {/* Terminal content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-hidden relative"
        >
          <div className="p-4 sm:p-5 flex flex-col gap-3">
            {entries.map((entry) => (
              <div key={entry.key}>{entry.content}</div>
            ))}
            <div className="w-1.5 h-3 bg-neutral-500 animate-pulse rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
