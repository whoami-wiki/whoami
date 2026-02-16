Replace XML export/import with full wiki backup and improve write reliability.

Features:
- `wai export <dir>` creates a portable `.tar` archive of the full wiki data directory (SQLite databases, secrets, uploaded images) with a dated filename (`whoami-YYYY-MM-DD.tar`)
- `wai import <file>` restores from an archive, with `--force` to overwrite existing data
- Both commands work without auth or a running server — useful for disaster recovery
- `--dry-run` support for both commands

Fixes:
- Reject empty or whitespace-only content in `wai write` before hitting the API
- Improve error messages for file read failures and API errors
