Snapshot reliability improvements and vault-based storage for backups.

Features:
- Include snapshot vault in export/import backups
- Reorganise help text into Data and Backup sections

Fixes:
- Verify object and snapshot writes land on disk, with clear error on failure
- Warn on unreadable files during snapshot instead of silently skipping

Improvements:
- Move snapshot storage from ~/Archive to /Application Support/whoami/vault
- Upgrade tough-cookie to v5.1.0
