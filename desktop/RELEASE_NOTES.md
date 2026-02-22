Fix crash on launch caused by macOS rejecting Homebrew PHP's code signature.

Fixes:
- Bundle a static PHP binary in release builds instead of a symlink to Homebrew PHP
- Bundle a static ffmpeg binary in release builds instead of a symlink
