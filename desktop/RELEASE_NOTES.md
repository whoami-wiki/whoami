Trim MediaWiki bundle from 462MB to 128MB to fix code signing failures on CI.

Improvements:
- Remove unused extensions, skins, languages, and test/doc artifacts from MediaWiki bundle
- Bundle shrinks from 462MB / 29k files to 128MB / 10k files
- DMG size reduced from 208MB to 132MB
- Resolves EMFILE (too many open files) errors during code signing
