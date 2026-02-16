import type { Metadata } from "next";
import { ChangelogTabs } from "./changelog-tabs";

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
  return all
    .filter(
      (r) =>
        r.tag_name.startsWith("desktop-v") || r.tag_name.startsWith("cli-v"),
    )
    .sort(
      (a, b) =>
        new Date(b.published_at).getTime() -
        new Date(a.published_at).getTime(),
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

        <ChangelogTabs releases={releases} />
      </div>
    </div>
  );
}
