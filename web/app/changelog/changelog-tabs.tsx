"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import { MarkdownBlocks } from "@/components/markdown-blocks";

interface Release {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

type Tab = "all" | "desktop" | "cli";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "desktop", label: "Desktop" },
  { key: "cli", label: "CLI" },
];

function tagLabel(tag: string): string {
  if (tag.startsWith("desktop-v")) return "Desktop";
  if (tag.startsWith("cli-v")) return "CLI";
  return tag;
}

function tagVersion(tag: string): string {
  return tag.replace(/^(desktop|cli)-v/, "v");
}

function filterReleases(releases: Release[], tab: Tab): Release[] {
  if (tab === "all") return releases;
  const prefix = tab === "desktop" ? "desktop-v" : "cli-v";
  return releases.filter((r) => r.tag_name.startsWith(prefix));
}

export function ChangelogTabs({ releases }: { releases: Release[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const filtered = filterReleases(releases, activeTab);

  return (
    <>
      <div className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`font-sans text-sm px-3 py-1.5 rounded-md cursor-pointer ${
              activeTab === tab.key
                ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700" />

      {filtered.length === 0 && (
        <div className="font-sans text-neutral-500">No releases yet.</div>
      )}

      <div className="flex flex-col gap-12">
        {filtered.map((release, releaseIndex) => (
          <article key={release.tag_name} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-sans font-medium">
                {tagVersion(release.tag_name)}
              </span>
              <span className="font-sans text-xs px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded-md">
                {tagLabel(release.tag_name)}
              </span>
              <time
                className="font-sans text-sm text-neutral-500 dark:text-neutral-400"
                dateTime={release.published_at}
              >
                {new Date(release.published_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>

            {release.body && (
              <div className="font-sans text-neutral-700 dark:text-neutral-300 prose dark:prose-invert prose-li:m-0 prose-p:m-0 prose-ul:mt-0 prose-code:before:content-none prose-code:after:content-none flex flex-col gap-4">
                <Markdown components={MarkdownBlocks}>
                  {release.body}
                </Markdown>
              </div>
            )}

            {releaseIndex !== filtered.length - 1 && (
              <div className="w-full h-px bg-neutral-200 dark:bg-neutral-700 mt-10" />
            )}
          </article>
        ))}
      </div>
    </>
  );
}
