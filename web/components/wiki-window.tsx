"use client";

import type { WikiPage, TocEntry } from "@/components/desktop-scene";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { imageMap } from "@/utils/image-map";

interface Props {
  activePage: WikiPage | null;
  zIndex?: number;
}

// Parses [[Target]] and [[Target|display text]] into styled spans
function renderWikiText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const display = match[2] || match[1];
    parts.push(
      <span
        key={match.index}
        className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
      >
        {display}
      </span>,
    );
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
          className="absolute w-3/4 max-w-4xl h-6/7 rounded-xl bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex flex-col shadow-2xl border border-primary left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
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
            <div className="absolute top-[6.5rem] left-6 w-48 bg-neutral-100 dark:bg-neutral-900 p-3 hidden md:block z-10">
              <div className="font-sans text-xs font-medium text-muted uppercase tracking-wider mb-2">
                Contents
              </div>
              <TocList entries={activePage.toc} />
            </div>

            <div
              className="p-6"
              style={{ marginTop: -(activePage.scrollTop ?? 0) }}
            >
              {/* Article content — offset right to clear the TOC */}
              <div className="md:ml-52">
                <h1 className="font-serif text-2xl font-medium mb-1">
                  {activePage.title}
                </h1>
                <div className="font-sans text-xs text-muted mb-4">
                  From whoami.wiki, your personal encyclopedia
                </div>
                <div className="h-px bg-neutral-200 dark:bg-neutral-700 mb-4" />

                {/* Infobox */}
                <div className="float-right ml-4 mb-3 w-48 border border-muted text-sm font-sans overflow-hidden relative z-10 bg-neutral-100 dark:bg-neutral-900">
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
                <p className="font-serif text-[15px] leading-[1.7] text-neutral-700 dark:text-neutral-300 mb-4">
                  {renderWikiText(activePage.intro)}
                </p>

                {/* Sections */}
                {activePage.sections.map((section) => (
                  <div key={section.heading} className="mb-4">
                    <h2 className="font-serif text-lg font-medium mb-1 text-primary">
                      {section.heading}
                    </h2>
                    <div className="h-px bg-neutral-200 dark:bg-neutral-700 mb-2" />
                    {section.images && section.images.length === 1 && (
                      <Thumb id={section.images[0]} />
                    )}
                    <p className="font-serif text-[15px] leading-[1.7] text-neutral-700 dark:text-neutral-300">
                      {renderWikiText(section.body)}
                    </p>
                    {section.quote && (
                      <blockquote className="my-4 ml-2 pl-3 border-l-2 border-neutral-300 dark:border-neutral-600 font-serif text-[15px] text-neutral-700 dark:text-neutral-300">
                        {renderWikiText(section.quote)}
                        {section.quoteAttrib && (
                          <span className="block mt-0.5 text-sm not-italic text-muted">
                            {section.quoteAttrib}
                          </span>
                        )}
                      </blockquote>
                    )}
                    {section.images && section.images.length >= 2 && (
                      <Gallery images={section.images} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
      <img
        src={entry.src}
        alt={entry.alt}
        className={`object-cover ${className}`}
      />
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
