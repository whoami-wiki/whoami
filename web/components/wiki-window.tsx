"use client";

import type { WikiPage, TocEntry } from "@/components/desktop-scene";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { imageMap } from "@/utils/image-map";

interface Props {
  activePage: WikiPage | null;
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

export function WikiWindow({ activePage, zIndex }: Props) {

  return (
    <AnimatePresence>
      {activePage && (
        <motion.div
          key="wiki-window"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.1 }}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex }}
        >
          {/* Desktop: browser window */}
          <div
            className="hidden md:flex absolute w-3/4 max-w-4xl h-6/7 rounded-xl bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex-col shadow-2xl border border-primary left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="flex items-center gap-2 p-3 bg-neutral-200 dark:bg-neutral-800 shrink-0 border-b border-primary">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="ml-4 text-xs font-sans text-muted" />
            </div>
            <WikiArticle activePage={activePage} />
          </div>

          {/* Mobile: backdrop tint to push desktop back */}
          <div className="md:hidden absolute inset-0 bg-black/25 dark:bg-black/50" />

          {/* Mobile: phone frame */}
          <div className="md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[80dvh] aspect-[445/901]">
            {/* Screen content area — slightly larger than cutout, bezel masks the excess */}
            <div className="absolute inset-[2%] overflow-hidden bg-neutral-100 dark:bg-neutral-900 flex flex-col pt-8" style={{ borderRadius: '16% / 8%' }}>
              <WikiArticle activePage={activePage} />
            </div>
            {/* Phone bezel overlay */}
            <PhoneBezel />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WikiArticle({ activePage }: { activePage: WikiPage }) {
  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Table of contents — hidden on mobile, fixed on desktop */}
      <div className="absolute top-[6.5rem] left-6 w-48 bg-neutral-100 dark:bg-neutral-900 p-3 hidden md:block z-10">
        <div className="font-sans text-xs font-medium text-muted uppercase tracking-wider mb-2">
          Contents
        </div>
        <TocList entries={activePage.toc} />
      </div>

      <div
        className="px-5 py-3 md:p-6"
        style={{ marginTop: -(activePage.scrollTop ?? 0) }}
      >
        {/* Article content — offset right to clear the TOC on desktop */}
        <div className="md:ml-52">
          {/* Title + subtitle + divider */}
          <h1 className="font-serif text-xl md:text-2xl font-normal mb-1">
            {activePage.title}
          </h1>
          <div className="font-sans text-xs text-muted mb-4">
            From whoami.wiki, your personal encyclopedia
          </div>
          <div className="h-px bg-neutral-200 dark:bg-neutral-700 mb-4" />

          {/* Infobox — full-width block on mobile, floated right on desktop */}
              <div
                className="w-full mb-4 md:float-right md:ml-4 md:mb-3 md:w-48 border border-muted text-sm font-sans overflow-hidden relative z-10 bg-neutral-100 dark:bg-neutral-900"
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

          {/* Intro */}
          <p className="font-sans text-sm leading-[1.7] text-neutral-700 dark:text-neutral-300 mb-4">
            {renderWikiText(activePage.intro)}
          </p>

          {/* Sections */}
          {activePage.sections.map((section) => (
              <div key={section.heading} className="mb-4">
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
          ))}
        </div>
      </div>
    </div>
  );
}

function PhoneBezel() {
  return (
    <svg
      viewBox="0 0 445 901"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-2xl"
    >
      <path
        d="M441.949 102.733C441.949 81.9328 441.649 67.9828 441.049 60.8828C440.182 50.2161 438.149 41.7661 434.949 35.5328C431.882 29.5328 427.965 24.1328 423.199 19.3328C418.465 14.5661 413.099 10.6661 407.099 7.63281C400.832 4.43281 392.382 2.39948 381.749 1.53281C374.682 0.93281 360.732 0.632812 339.899 0.632812L105.399 0.632812C84.5986 0.632812 70.6486 0.93281 63.5486 1.53281C52.9153 2.39948 44.4653 4.43281 38.1986 7.63281C32.1986 10.6661 26.832 14.5661 22.0986 19.3328C17.332 24.1328 13.3986 29.5328 10.2986 35.5328C7.09863 41.7661 5.08197 50.2161 4.24863 60.8828C3.64863 67.9828 3.34863 81.9328 3.34863 102.733L3.34863 142.983H1.54863C0.748634 142.983 0.348633 143.383 0.348633 144.183L0.348633 177.333C0.348633 178.133 0.748634 178.533 1.54863 178.533H3.34863L3.34863 207.383H1.54863C0.748634 207.383 0.348633 207.783 0.348633 208.583L0.348633 274.833C0.348633 275.166 0.465298 275.466 0.698631 275.733C0.898631 275.966 1.18197 276.083 1.54863 276.083H3.34863L3.34863 291.383H1.54863C1.18197 291.383 0.898631 291.516 0.698631 291.783C0.465298 292.016 0.348633 292.316 0.348633 292.683L0.348633 358.883C0.348633 359.683 0.748634 360.083 1.54863 360.083H3.34863L3.34863 798.383C3.34863 819.249 3.64863 833.233 4.24863 840.333C5.08197 850.966 7.09863 859.399 10.2986 865.633C13.3986 871.633 17.332 877.016 22.0986 881.783C26.832 886.583 32.1986 890.499 38.1986 893.533C44.4653 896.699 52.9153 898.733 63.5486 899.633C70.6486 900.166 84.5986 900.433 105.399 900.433H339.899C360.732 900.433 374.682 900.166 381.749 899.633C392.382 898.733 400.832 896.699 407.099 893.533C413.099 890.499 418.465 886.583 423.199 881.783C427.999 877.016 431.915 871.633 434.949 865.633C438.149 859.399 440.182 850.966 441.049 840.333C441.649 833.233 441.949 819.249 441.949 798.383V338.633H443.749C444.082 338.633 444.382 338.499 444.649 338.233C444.882 338.033 444.999 337.766 444.999 337.433V233.133C444.999 232.766 444.882 232.483 444.649 232.283C444.382 232.049 444.082 231.933 443.749 231.933H441.949V102.733ZM353.699 22.7828C367.332 22.7828 376.482 22.9828 381.149 23.3828C388.082 23.9161 393.599 25.2161 397.699 27.2828C405.699 31.4161 411.782 37.4828 415.949 45.4828C417.982 49.5828 419.299 55.1161 419.899 62.0828C420.265 66.7161 420.449 75.8661 420.449 89.5328V811.683C420.449 825.283 420.265 834.399 419.899 839.033C419.299 845.999 417.982 851.516 415.949 855.583C411.782 863.683 405.699 869.766 397.699 873.833C393.599 875.933 388.082 877.249 381.149 877.783C376.482 878.183 367.332 878.383 353.699 878.383H91.5986C77.9653 878.383 68.8153 878.183 64.1486 877.783C57.2153 877.249 51.6986 875.933 47.5986 873.833C39.5986 869.766 33.5153 863.683 29.3486 855.583C27.3153 851.516 26.0153 845.999 25.4486 839.033C25.0486 834.399 24.8486 825.283 24.8486 811.683L24.8486 89.5328C24.8486 75.8661 25.0486 66.7161 25.4486 62.0828C26.0153 55.1161 27.3153 49.5828 29.3486 45.4828C33.5153 37.4828 39.5986 31.4161 47.5986 27.2828C51.6986 25.2161 57.2153 23.9161 64.1486 23.3828C68.8153 22.9828 77.9653 22.7828 91.5986 22.7828H112.049C113.049 22.7828 113.699 22.8328 113.999 22.9328C114.699 23.1661 115.182 23.6328 115.449 24.3328C115.549 24.6328 115.599 25.2828 115.599 26.2828C115.599 31.0495 115.649 34.2328 115.749 35.8328C115.882 38.2661 116.232 40.2328 116.799 41.7328C117.799 44.4328 119.315 46.8161 121.349 48.8828C123.415 50.9828 125.799 52.4995 128.499 53.4328C129.999 53.9995 131.965 54.3495 134.399 54.4828C136.065 54.5828 139.249 54.6328 143.949 54.6328H301.349C306.082 54.6328 309.249 54.5828 310.849 54.4828C313.315 54.3495 315.299 53.9995 316.799 53.4328C319.499 52.4995 321.865 50.9828 323.899 48.8828C325.999 46.8161 327.532 44.4328 328.499 41.7328C329.032 40.2328 329.382 38.2661 329.549 35.8328C329.649 34.2328 329.699 31.0495 329.699 26.2828C329.699 25.2828 329.749 24.6328 329.849 24.3328C330.082 23.6328 330.549 23.1661 331.249 22.9328C331.549 22.8328 332.199 22.7828 333.199 22.7828H353.699Z"
        className="fill-gray-200 dark:fill-neutral-800"
      />
    </svg>
  );
}

function TocList({ entries }: { entries: TocEntry[] }) {
  return (
    <ol className="font-sans text-sm space-y-1 text-blue-600 dark:text-blue-400 list-decimal list-inside">
      {entries.map((entry) => (
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
