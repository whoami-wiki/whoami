import type { NextConfig } from "next";
import path from "path";

// Browsing the dev server through Tailscale (100.x.x.x) is the project's
// access pattern. Next 16 blocks cross-origin static assets by default, so
// without this list the browser silently fails to fetch dynamic chunks
// (e.g. the Leaflet map bundle), and `next/dynamic` placeholders never resolve.
// Set WHOAMI_ALLOWED_DEV_ORIGINS (comma-separated, e.g. "100.85.23.19") to
// allow your Tailscale node. Empty by default so this config is portable.
const allowedDevOrigins = (process.env.WHOAMI_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  allowedDevOrigins,
};

export default nextConfig;
