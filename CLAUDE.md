# CLAUDE.md

## Commit Message Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
type: short description (#PR)
```

### Types

- `feat` — new feature or enhancement to existing functionality
- `fix` — bug fix
- `chore` — maintenance, refactoring, CI/build changes
- `release` — version release (automated)

### Rules

1. **Lowercase** the entire subject line after the type prefix
2. **No scope** — use plain `feat:` not `feat(web):`
3. **Imperative mood** — write "add search page" not "added search page" or "adds search page"
4. **Keep it short** — aim for under 72 characters in the subject line
5. **PR number** — squash-merged PRs include `(#N)` at the end
6. **No trailing period** in the subject line

### Release commits

Release commits follow a special format with the product name and semver version:

```
release: cli-v1.1.0
release: desktop-v1.0.5
```

### Examples

```
feat: add mobile navigation drawer for docs sidebar (#38)
fix: cli install and auto-update (#26)
chore: improve desktop release flow (#14)
feat: support inline audio/video players (#29)
fix: harden write command and improve cli error reporting (#30)
release: cli-v1.0.6
```
