import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

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
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
      next: { revalidate: 300, tags: ["github-releases"] },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const releases: Release[] = await res.json();
  return releases.find((r) => r.tag_name.startsWith("desktop-v")) ?? null;
}

function findDmg(assets: Asset[], arch: "arm64" | "x64"): Asset | undefined {
  const dmgs = assets.filter((a) => a.name.endsWith(".dmg"));
  if (arch === "arm64") {
    return dmgs.find((a) => a.name.includes("arm64"));
  }
  // Intel: prefer explicit x64, fall back to the one without arm64
  return (
    dmgs.find((a) => a.name.includes("x64")) ??
    dmgs.find((a) => !a.name.includes("arm64"))
  );
}

type Platform = "macos-arm" | "macos-intel";

export default async function DownloadPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const { platform } = await searchParams;
  const release = await getLatestDesktopRelease();
  const version = release?.tag_name.replace(/^desktop-v/, "v");
  const date = release
    ? new Date(release.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const armDmg = release ? findDmg(release.assets, "arm64") : undefined;
  const intelDmg = release ? findDmg(release.assets, "x64") : undefined;

  const validPlatforms: Platform[] = ["macos-arm", "macos-intel"];
  const selectedPlatform = validPlatforms.includes(platform as Platform)
    ? (platform as Platform)
    : null;

  const downloads: { label: string; asset: Asset }[] = [];
  if (selectedPlatform === "macos-arm" || !selectedPlatform) {
    if (armDmg)
      downloads.push({ label: "Download for macOS (Apple Silicon)", asset: armDmg });
  }
  if (selectedPlatform === "macos-intel" || !selectedPlatform) {
    if (intelDmg)
      downloads.push({ label: "Download for macOS (Intel)", asset: intelDmg });
  }

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

        {downloads.length > 0 ? (
          <div className="flex flex-col gap-4">
            {downloads.map((d) => (
              <div
                key={d.asset.name}
                className="flex flex-row items-center justify-between"
              >
                <Link href={d.asset.browser_download_url} tabIndex={-1}>
                  <Button accent="tertiary" text={d.label} />
                </Link>
                <div className="font-sans text-sm text-neutral-500 dark:text-neutral-400">
                  {version} &middot; {date}
                </div>
              </div>
            ))}
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
