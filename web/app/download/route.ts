import { NextResponse } from "next/server";

const REPO = "whoami-wiki/whoami";

export async function GET() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
      next: { revalidate: 300 }, // cache for 5 minutes
    },
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch releases" },
      { status: 502 },
    );
  }

  const releases = await res.json();
  const desktopRelease = releases.find((r: any) =>
    r.tag_name.startsWith("desktop-v"),
  );

  if (!desktopRelease) {
    return NextResponse.json(
      { error: "No desktop release found" },
      { status: 404 },
    );
  }

  const dmg = desktopRelease.assets.find((a: any) =>
    a.name.endsWith(".dmg"),
  );

  if (!dmg) {
    return NextResponse.json(
      { error: "No DMG found in release" },
      { status: 404 },
    );
  }

  return NextResponse.redirect(dmg.browser_download_url);
}
