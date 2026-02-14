Snapshot command now archives files to a content-addressable store and creates Source wiki pages. Import handles namespace prefixes correctly.

Features:
- `wai snapshot` hashes files, deduplicates into `~/Archive/objects/`, writes a manifest to `~/Archive/snapshots/`, and creates a `Source:` wiki page
- `wai snapshot` accepts `--name` and `--dry-run` flags

Fixes:
- `wai import` reconciles namespace prefixes — pages with `ns > 0` get the correct prefix (e.g. `Source:`) added if missing, using siteinfo from the dump or falling back to the wiki API

Improvements:
- Auto-update check uses `gh api` instead of raw HTTPS, removing the `node:https` dependency
