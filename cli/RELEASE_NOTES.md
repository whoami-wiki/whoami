`wai source list` now queries the wiki's Source namespace instead of reading from a local config file.

Improvements:
- `wai source list` fetches pages from the Source namespace via the MediaWiki API
- Removed the static `sources` array from `~/.whoami/config.json`
