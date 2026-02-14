import type { Metadata } from "next";

const REPO = "whoami-wiki/whoami";

export const metadata: Metadata = {
  title: "Download — whoami.wiki",
};

interface Asset {
  name: string;
  browser_download_url: string;
}

interface Release {
  tag_name: string;
  published_at: string;
  assets: Asset[];
}

async function getLatestDesktopRelease(): Promise<Release | null> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases`,
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
  if (!res.ok) return null;
  const releases: Release[] = await res.json();
  return releases.find((r) => r.tag_name.startsWith("desktop-v")) ?? null;
}

export default async function DownloadPage() {
  const release = await getLatestDesktopRelease();
  const dmg = release?.assets.find((a) => a.name.endsWith(".dmg"));
  const version = release?.tag_name.replace(/^desktop-v/, "v");
  const date = release
    ? new Date(release.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col w-dvw items-center">
      <div className="w-full max-w-3xl flex flex-col gap-8 py-18 px-6">
        <div>
          <div className="font-sans">Download</div>
          <div className="font-sans text-neutral-500 dark:text-neutral-400">
            Get the whoami desktop app for macOS.
          </div>
        </div>

        <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700" />

        {dmg ? (
          <div className="flex flex-row items-center justify-between">
            <a
              href={dmg.browser_download_url}
              className="font-sans text-sm inline-flex items-center justify-center px-4 py-2 rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-80 transition-opacity"
            >
              Download for macOS
            </a>
            <div className="font-sans text-sm text-neutral-500 dark:text-neutral-400">
              {version} &middot; {date}
            </div>
          </div>
        ) : (
          <div className="font-sans text-neutral-500">
            No release available yet.
          </div>
        )}
      </div>
    </div>
  );
}
