import type { Metadata } from "next";
import Markdown from "react-markdown";
import { MarkdownBlocks } from "@/components/markdown-blocks";

const REPO = "whoami-wiki/whoami";

export const metadata: Metadata = {
  title: "Changelog — whoami.wiki",
};

interface Release {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

function tagLabel(tag: string): string {
  if (tag.startsWith("desktop-v")) return "Desktop";
  if (tag.startsWith("cli-v")) return "CLI";
  return tag;
}

function tagVersion(tag: string): string {
  return tag.replace(/^(desktop|cli)-v/, "v");
}

async function getReleases(): Promise<Release[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases?per_page=50`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
      next: { revalidate: 300, tags: ["github-releases"] },
    },
  );
  if (!res.ok) return [];
  const all: Release[] = await res.json();
  return all.filter(
    (r) => r.tag_name.startsWith("desktop-v") || r.tag_name.startsWith("cli-v"),
  );
}

export default async function ChangelogPage() {
  const releases = await getReleases();

  return (
    <div className="flex flex-col w-dvw items-center">
      <div className="w-full max-w-3xl flex flex-col gap-8 py-18 px-6">
        <div>
          <div className="font-sans">Changelog</div>
          <div className="font-sans text-neutral-500 dark:text-neutral-400">
            Release history for the desktop app and CLI.
          </div>
        </div>

        <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700" />

        {releases.length === 0 && (
          <div className="font-sans text-neutral-500">No releases yet.</div>
        )}

        <div className="flex flex-col gap-12">
          {releases.map((release, releaseIndex) => (
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

              {releaseIndex !== releases.length - 1 && (
                <div className="w-full h-px bg-neutral-200 dark:bg-neutral-700 mt-10" />
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
