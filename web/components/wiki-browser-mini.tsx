"use client";

import { useEffect, useRef, useState } from "react";

type Entry =
  | { type: "page"; titleWidth: string; infoboxRows: number; delay: number }
  | { type: "paragraph"; lines: [string, ...string[]]; delay: number }
  | { type: "section"; width: string; delay: number }
  | { type: "image"; height: string; color: string; delay: number }
  | { type: "image-row"; colors: string[]; delay: number }
  | { type: "image-grid"; colors: string[]; cols: number; delay: number };

const sequence: Entry[] = [
  // Page 1 — person page with infobox photo
  { type: "page", titleWidth: "w-3/5", infoboxRows: 4, delay: 750 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-full", "w-4/5"], delay: 400 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-3/5"], delay: 500 },
  { type: "section", width: "w-2/5", delay: 600 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-3/4"], delay: 450 },
  { type: "image", height: "h-16", color: "bg-amber-100", delay: 400 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-full", "w-1/2"], delay: 500 },
  { type: "section", width: "w-1/3", delay: 600 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-2/3"], delay: 450 },
  { type: "image-grid", colors: ["bg-sky-100", "bg-sky-50", "bg-indigo-50", "bg-sky-100"], cols: 2, delay: 400 },
  { type: "paragraph", lines: ["w-full", "w-4/5"], delay: 400 },

  // Page 2 — trip page with photo gallery
  { type: "page", titleWidth: "w-2/5", infoboxRows: 3, delay: 1000 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-full", "w-3/5"], delay: 450 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-1/2"], delay: 400 },
  { type: "section", width: "w-1/2", delay: 600 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-4/5"], delay: 500 },
  { type: "image-row", colors: ["bg-emerald-100", "bg-teal-50", "bg-green-100"], delay: 400 },
  { type: "paragraph", lines: ["w-full", "w-3/4"], delay: 400 },
  { type: "section", width: "w-2/5", delay: 600 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-full", "w-2/3"], delay: 450 },
  { type: "image", height: "h-20", color: "bg-emerald-50", delay: 400 },
  { type: "paragraph", lines: ["w-full", "w-1/2"], delay: 400 },

  // Page 3 — event page
  { type: "page", titleWidth: "w-1/2", infoboxRows: 5, delay: 1000 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-3/4"], delay: 400 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-full", "w-2/5"], delay: 500 },
  { type: "image", height: "h-14", color: "bg-rose-50", delay: 400 },
  { type: "section", width: "w-1/3", delay: 600 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-2/3"], delay: 450 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-3/5"], delay: 400 },
  { type: "image-row", colors: ["bg-violet-100", "bg-purple-50"], delay: 400 },
  { type: "section", width: "w-2/5", delay: 600 },
  { type: "paragraph", lines: ["w-full", "w-4/5"], delay: 450 },
  { type: "image-grid", colors: ["bg-rose-50", "bg-orange-50", "bg-rose-100", "bg-pink-50", "bg-orange-100", "bg-rose-50"], cols: 3, delay: 400 },
  { type: "paragraph", lines: ["w-full", "w-full", "w-1/2"], delay: 400 },
];

function Paragraph({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      {lines.map((w, i) => (
        <div key={i} className={`h-1.5 bg-neutral-200 rounded-full ${w}`} />
      ))}
    </div>
  );
}

function SectionHeading({ width }: { width: string }) {
  return (
    <div>
      <div className={`h-2 bg-neutral-400 rounded ${width} mb-0.5`} />
      <div className="h-px bg-neutral-200" />
    </div>
  );
}

function ImageBlock({ height, color }: { height: string; color: string }) {
  return <div className={`${height} ${color} rounded border border-neutral-200`} />;
}

function ImageRow({ colors }: { colors: string[] }) {
  return (
    <div className="flex gap-1.5">
      {colors.map((c, i) => (
        <div key={i} className={`flex-1 h-12 ${c} rounded border border-neutral-200`} />
      ))}
    </div>
  );
}

function ImageGrid({ colors, cols }: { colors: string[]; cols: number }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {colors.map((c, i) => (
        <div key={i} className={`h-10 ${c} rounded border border-neutral-200`} />
      ))}
    </div>
  );
}

function Infobox({ rows }: { rows: number }) {
  const widths = [0.6, 0.8, 0.7, 0.5, 0.9];
  return (
    <div className="hidden sm:flex w-28 shrink-0 border border-neutral-300 flex-col self-start">
      <div className="bg-neutral-100 px-2 py-1.5 border-b border-neutral-300">
        <div className="h-1.5 bg-neutral-400 rounded-full w-full" />
      </div>
      <div className="bg-blue-50 h-14" />
      <div className="px-2 py-1 border-b border-neutral-300">
        <div className="h-1 bg-neutral-300 rounded-full w-4/5 mx-auto" />
      </div>
      {widths.slice(0, rows).map((w, i) => (
        <div key={i} className="flex border-b border-neutral-200 last:border-b-0">
          <div className="w-10 shrink-0 px-1.5 py-1.5 bg-neutral-50">
            <div className="h-1 bg-neutral-300 rounded-full" />
          </div>
          <div className="px-1.5 py-1.5 flex-1">
            <div
              className="h-1 bg-neutral-200 rounded-full"
              style={{ width: `${w * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WikiBrowserMini() {
  const [titleWidth, setTitleWidth] = useState("w-3/5");
  const [infoboxRows, setInfoboxRows] = useState(4);
  const [contentBlocks, setContentBlocks] = useState<React.ReactNode[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    function scheduleNext() {
      const idx = indexRef.current % sequence.length;
      const entry = sequence[idx];

      return setTimeout(() => {
        indexRef.current++;

        if (entry.type === "page") {
          setTitleWidth(entry.titleWidth);
          setInfoboxRows(entry.infoboxRows);
          setContentBlocks([]);
        } else if (entry.type === "paragraph") {
          setContentBlocks((prev) => [
            ...prev,
            <Paragraph key={`p-${indexRef.current}`} lines={entry.lines} />,
          ]);
        } else if (entry.type === "section") {
          setContentBlocks((prev) => [
            ...prev,
            <SectionHeading key={`s-${indexRef.current}`} width={entry.width} />,
          ]);
        } else if (entry.type === "image") {
          setContentBlocks((prev) => [
            ...prev,
            <ImageBlock key={`i-${indexRef.current}`} height={entry.height} color={entry.color} />,
          ]);
        } else if (entry.type === "image-row") {
          setContentBlocks((prev) => [
            ...prev,
            <ImageRow key={`r-${indexRef.current}`} colors={entry.colors} />,
          ]);
        } else if (entry.type === "image-grid") {
          setContentBlocks((prev) => [
            ...prev,
            <ImageGrid key={`g-${indexRef.current}`} colors={entry.colors} cols={entry.cols} />,
          ]);
        }

        scheduleNext();
      }, entry.delay);
    }

    const timeout = scheduleNext();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [contentBlocks]);

  return (
    <div className="not-prose w-full rounded-xl overflow-hidden bg-white shadow-2xl border border-neutral-200 aspect-[4/3]">
      <div className="aspect-[4/3] overflow-hidden origin-top-left scale-[0.65] w-[153.8%] flex flex-col">
        {/* Browser title bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 border-b border-neutral-200 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <div className="ml-1 bg-white rounded px-2 py-1 border border-neutral-200 flex-1 max-w-[70%]">
            <div className="h-1.5 bg-neutral-200 rounded-full w-3/4" />
          </div>
        </div>

        {/* Wiki content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-hidden px-4 sm:px-5 pt-3 pb-4 flex flex-col"
        >
          {/* Page title */}
          <div
            className={`h-3 sm:h-4 bg-neutral-400 rounded ${titleWidth} mb-1.5 shrink-0`}
          />
          <div className="h-px bg-neutral-200 mb-1 shrink-0" />

          {/* Wiki tabs */}
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <div className="h-1.5 bg-neutral-400 rounded-full w-8" />
            <div className="h-1.5 bg-blue-300 rounded-full w-12" />
            <div className="ml-auto flex gap-1.5">
              <div className="h-1.5 bg-neutral-300 rounded-full w-6" />
              <div className="h-1.5 bg-blue-200 rounded-full w-5" />
              <div className="h-1.5 bg-blue-200 rounded-full w-10" />
            </div>
          </div>

          <div className="flex gap-3 flex-1">
            {/* Body text */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              {contentBlocks}
            </div>

            {/* Infobox */}
            <Infobox rows={infoboxRows} />
          </div>
        </div>
      </div>
    </div>
  );
}
