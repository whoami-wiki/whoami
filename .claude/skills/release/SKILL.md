---
name: release
description: Release a new version of a package (cli, desktop)
triggers: ["release", "publish", "ship"]
user_invocable: true
---

# Release

Create a release for a package in this monorepo.

## Usage

`/release <package> [version]`

Examples:
- `/release cli` — release the CLI (prompts for version)
- `/release cli 1.0.3` — release CLI v1.0.3

## Packages

| Package   | Tag format           | Script                        |
|-----------|----------------------|-------------------------------|
| cli       | `cli-v{version}`     | `cli/scripts/release.sh`      |
| desktop   | `desktop-v{version}` | `desktop/scripts/release.sh`  |

## Steps

### 1. Determine version

Parse the package name and optional version from the arguments. If no version
is given, read the current version from the package's `package.json` and ask
the user what the new version should be.

### 2. Verify preconditions

- Confirm the working tree is clean (`git status --porcelain` should be empty
  inside the package directory)
- Confirm the current branch is `main`
- Run the package's build: `pnpm build`
- Run tests if available: `pnpm test`

If any check fails, stop and explain what needs to be fixed.

### 3. Write release notes

Find the previous release tag:
```
git tag --list '<package>-v*' --sort=-version:refname | head -1
```

Review all changes since that tag, scoped to the package directory:
```
git log <prev-tag>..HEAD --oneline -- <package-dir>/
git diff <prev-tag>..HEAD -- <package-dir>/
```

Write `<package-dir>/RELEASE_NOTES.md` with a concise, human-friendly summary
of what changed. Focus on user-facing changes. Use this format:

```markdown
Summary sentence of the release.

<section>:
- Change description
```

Group changes into sections like Features, Fixes, Improvements as appropriate.
Skip sections with no entries. Don't list every commit — synthesise related
changes into clear bullet points.

Show the draft to the user and ask for approval before proceeding.

### 4. Run the release script

```
bash <package-dir>/scripts/release.sh <version>
```

The script handles: version bump in source files, git commit, tag, and push.
GitHub Actions will build and publish the release using the committed
`RELEASE_NOTES.md`.

### 5. Confirm

Print the release URL: `https://github.com/whoami-wiki/whoami/releases/tag/<tag>`
