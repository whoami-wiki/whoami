import type { NextConfig } from "next";
import path from "path";

// Browsing the dev server through Tailscale (100.x.x.x) is the project's
// access pattern. Next 16 blocks cross-origin static assets by default, so
// without this list the browser silently fails to fetch dynamic chunks
// (e.g. the Leaflet map bundle), and `next/dynamic` placeholders never resolve.
// Default includes the project owner's Tailscale node so a fresh checkout
// works without extra setup. Override or extend with WHOAMI_ALLOWED_DEV_ORIGINS
// (comma-separated). `allowedDevOrigins` is a dev-only setting — Next strips
// it from production builds — so there's no security implication of shipping
// a default IP here.
const DEFAULT_DEV_ORIGINS = ['100.85.23.19'];
const envOrigins = (process.env.WHOAMI_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowedDevOrigins = envOrigins.length > 0 ? envOrigins : DEFAULT_DEV_ORIGINS;

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  allowedDevOrigins,
};

export default nextConfig;
