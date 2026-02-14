Consolidate build to single esbuild bundle and fix auto-updater for private repos.

Fixes:
- `wai update` now uses `gh release download` instead of unauthenticated curl, fixing updates for private repos

Improvements:
- Single build artifact (`dist/wai.cjs`) replaces separate tsc + esbuild steps, fixing version drift between builds
- Removed unused `install.sh`
- CI and release workflows simplified to single build step
