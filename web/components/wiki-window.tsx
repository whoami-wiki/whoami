"use client";

import type { WikiPage, TocEntry } from "@/components/desktop-scene";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { imageMap } from "@/utils/image-map";

interface Props {
  activePage: WikiPage | null;
  revealProgress: number;
  zIndex?: number;
}

// Parses [[Target]], [[Target|display text]], and {{cite|N}} into styled spans
function renderWikiText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\{\{cite\|(\d+)\}\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[3]) {
      // Citation: {{cite|N}}
      parts.push(
        <sup
          key={`cite-${match.index}`}
          className="text-blue-600 dark:text-blue-400 cursor-pointer text-[9px] ml-px"
        >
          [{match[3]}]
        </sup>,
      );
    } else {
      // Wiki link: [[Target]] or [[Target|display]]
      const display = match[2] || match[1];
      parts.push(
        <span
          key={match.index}
          className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
        >
          {display}
        </span>,
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function RevealBlock({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function WikiWindow({ activePage, revealProgress, zIndex }: Props) {
  // Reveal steps: 0=title+subtitle+divider, 1=intro, 2=infobox, 3..N+2=sections
  const totalSteps = (activePage?.sections.length ?? 0) + 3;
  const visibleSteps = Math.floor(revealProgress * totalSteps);

  const showIntro = visibleSteps >= 1;
  const showInfobox = visibleSteps >= 2;
  const sectionsVisible = Math.max(0, visibleSteps - 2);

  // Count top-level TOC entries that correspond to revealed sections
  // Each top-level TOC entry maps to one section heading
  const revealedTocCount = sectionsVisible;

  return (
    <AnimatePresence>
      {activePage && (
        <motion.div
          key="wiki-window"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.1 }}
          className="absolute w-3/4 max-w-4xl h-6/7 rounded-xl bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex flex-col shadow-2xl border border-primary left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ zIndex }}
        >
          <div className="flex items-center gap-2 p-3 bg-neutral-200 dark:bg-neutral-800 shrink-0 border-b border-primary">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <div className="ml-4 text-xs font-sans text-muted" />
          </div>

          <div className="relative flex-1 overflow-hidden">
            {/* Table of contents — outside scroll offset so it stays fixed */}
            {revealedTocCount > 0 && (
              <div className="absolute top-[6.5rem] left-6 w-48 bg-neutral-100 dark:bg-neutral-900 p-3 hidden md:block z-10">
                <RevealBlock>
                  <div className="font-sans text-xs font-medium text-muted uppercase tracking-wider mb-2">
                    Contents
                  </div>
                </RevealBlock>
                <RevealedTocList
                  entries={activePage.toc}
                  visibleCount={revealedTocCount}
                />
              </div>
            )}

            <div
              className="p-6"
              style={{ marginTop: -(activePage.scrollTop ?? 0) }}
            >
              {/* Article content — offset right to clear the TOC */}
              <div className="md:ml-52">
                {/* Step 0: Title + subtitle + divider (always visible) */}
                <h1 className="font-serif text-2xl font-normal mb-1">
                  {activePage.title}
                </h1>
                <div className="font-sans text-xs text-muted mb-4">
                  From whoami.wiki, your personal encyclopedia
                </div>
                <div className="h-px bg-neutral-200 dark:bg-neutral-700 mb-4" />

                {/* Step 2: Infobox — always in layout to prevent reflow, visibility toggled */}
                    <div
                      className="float-right ml-4 mb-3 w-48 border border-muted text-sm font-sans overflow-hidden relative z-10 bg-neutral-100 dark:bg-neutral-900"
                      style={{ visibility: showInfobox ? "visible" : "hidden" }}
                    >
                      <div className="bg-neutral-200 dark:bg-neutral-700 px-3 py-1.5 font-medium text-center text-xs">
                        {activePage.title}
                      </div>
                      {activePage.infoboxImage && (
                        <WikiImage
                          id={activePage.infoboxImage}
                          className="w-full h-28"
                        />
                      )}
                      {activePage.infobox.map((item) => (
                        <div
                          key={item.label}
                          className="flex border-t border-muted"
                        >
                          <div className="w-20 shrink-0 px-2 py-1 bg-neutral-50 dark:bg-neutral-800 text-muted text-xs font-medium">
                            {item.label}
                          </div>
                          <div className="px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>

                {/* Step 1: Intro */}
                {showIntro && (
                  <RevealBlock>
                    <p className="font-sans text-sm leading-[1.7] text-neutral-700 dark:text-neutral-300 mb-4">
                      {renderWikiText(activePage.intro)}
                    </p>
                  </RevealBlock>
                )}

                {/* Steps 3..N+2: Sections, one by one */}
                {activePage.sections.slice(0, sectionsVisible).map((section) => (
                  <RevealBlock key={section.heading}>
                    <div className="mb-4">
                      <h2 className="font-serif text-lg font-normal mb-1 text-primary">
                        {section.heading}
                      </h2>
                      <div className="h-px bg-neutral-200 dark:bg-neutral-700 mb-2" />
                      {section.images && section.images.length === 1 && (
                        <Thumb id={section.images[0]} />
                      )}
                      <p className="font-sans text-sm leading-[1.7] text-neutral-700 dark:text-neutral-300">
                        {renderWikiText(section.body)}
                      </p>
                      {section.table && <WikiTable table={section.table} />}
                      {section.quote && (
                        <blockquote className="my-4 ml-2 pl-3 border-l-2 border-neutral-300 dark:border-neutral-600 font-sans text-sm italic text-neutral-700 dark:text-neutral-300">
                          {renderWikiText(section.quote)}
                          {section.quoteAttrib && (
                            <span className="block mt-0.5 text-sm not-italic text-muted">
                              {section.quoteAttrib}
                            </span>
                          )}
                        </blockquote>
                      )}
                      {section.audio && <VoiceNote audio={section.audio} />}
                      {section.images && section.images.length >= 2 && (
                        <Gallery images={section.images} />
                      )}
                    </div>
                  </RevealBlock>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RevealedTocList({
  entries,
  visibleCount,
}: {
  entries: TocEntry[];
  visibleCount: number;
}) {
  // Each top-level entry corresponds to one section. Show entries up to visibleCount.
  let remaining = visibleCount;
  const visibleEntries: TocEntry[] = [];
  for (const entry of entries) {
    if (remaining <= 0) break;
    visibleEntries.push(entry);
    // Each top-level entry (with or without children) consumes one section slot
    remaining--;
  }

  return (
    <ol className="font-sans text-sm space-y-1 text-blue-600 dark:text-blue-400 list-decimal list-inside">
      {visibleEntries.map((entry) => (
        <li key={entry.label}>
          {entry.label}
          {entry.children && (
            <ol className="ml-4 mt-1 space-y-1 list-decimal list-inside">
              {entry.children.map((child) => (
                <li key={child.label}>{child.label}</li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ol>
  );
}

function WikiImage({ id, className = "" }: { id: string; className?: string }) {
  const entry = imageMap[id];
  if (!entry) return null;

  if (entry.src) {
    return (
      <div key={entry.src} className={`relative ${className}`}>
        <Image
          src={entry.src}
          alt={entry.alt}
          fill
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${entry.color} flex items-center justify-center ${className}`}
    >
      <span className="text-[10px] font-sans text-black/30 select-none">
        {entry.alt}
      </span>
    </div>
  );
}

function Thumb({ id }: { id: string }) {
  const entry = imageMap[id];
  if (!entry) return null;
  return (
    <div className="float-right ml-3 mb-2 w-36 border border-muted bg-neutral-50 dark:bg-neutral-800/50 overflow-hidden">
      <WikiImage id={id} className="w-full h-24" />
      <div className="px-2 py-1 flex flex-row">
        <span className="font-sans text-[10px] text-muted leading-3.5">
          {entry.alt}
        </span>
      </div>
    </div>
  );
}

function WikiTable({
  table,
}: {
  table: { caption?: string; headers: string[]; rows: string[][] };
}) {
  return (
    <div className="my-3">
      <table className="w-full font-sans text-sm border border-muted">
        <thead>
          <tr className="bg-neutral-200 dark:bg-neutral-700">
            {table.headers.map((h) => (
              <th
                key={h}
                className="px-3 py-1.5 text-left text-xs font-medium text-neutral-700 dark:text-neutral-300"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-3 py-1.5 border-t border-muted text-neutral-700 dark:text-neutral-300"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.caption && (
        <div className="mt-1 text-xs text-muted font-sans">{table.caption}</div>
      )}
    </div>
  );
}

function VoiceNote({
  audio,
}: {
  audio: { title: string; duration: string; transcription: string };
}) {
  // Generate a natural-looking waveform: quiet start, build up, plateau with variation, taper
  const count = 48;
  const bars = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1); // 0→1
    // Envelope: ramp up, sustain, taper down
    const envelope =
      t < 0.1 ? t / 0.1 :
      t > 0.85 ? (1 - t) / 0.15 :
      1;
    // Pseudo-random variation seeded by index
    const noise = Math.sin(i * 127.1 + 3.7) * 0.5 + Math.sin(i * 43.3 + 1.2) * 0.3;
    const normalized = 0.2 + envelope * 0.8 * (0.45 + 0.55 * (noise * 0.5 + 0.5));
    return Math.round(normalized * 100);
  });

  return (
    <div className="my-3 border border-muted bg-neutral-50 dark:bg-neutral-800/50 rounded p-3 font-sans">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-0.5">
            &#9654;
          </span>
        </div>
        <div className="flex items-end h-5 flex-1 min-w-0">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 min-w-0 mx-px rounded-sm bg-neutral-400/60 dark:bg-neutral-500/60"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <span className="text-xs text-muted shrink-0">{audio.duration}</span>
      </div>
      <div className="mt-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {audio.title}
      </div>
      <p className="mt-1 text-xs italic text-muted leading-relaxed">
        {audio.transcription}
      </p>
    </div>
  );
}

function Gallery({ images }: { images: string[] }) {
  return (
    <div className="mt-3 mb-2 flex gap-1 justify-center bg-neutral-50 dark:bg-neutral-800/50 border border-muted p-2">
      {images.map((id) => {
        const entry = imageMap[id];
        const alt = entry?.alt ?? id;
        return (
          <div
            key={id}
            className="flex flex-col items-center gap-2 flex-1 min-w-0"
          >
            <WikiImage id={id} className="w-full h-40" />
            <span className="font-sans text-[10px] text-muted text-center leading-none px-1 line-clamp-2">
              {alt}
            </span>
          </div>
        );
      })}
    </div>
  );
}
