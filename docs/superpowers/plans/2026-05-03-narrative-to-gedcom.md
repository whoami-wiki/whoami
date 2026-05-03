# Narrative ↔ GEDCOM round-trip with paste-to-vault ingestion

> **Status:** sketch — implementation deferred. Spawn a fresh session driven by this plan when the user wants to start using the paste-to-narrative-to-GEDCOM flow on real data.

**Goal:** Let a user paste raw text (an obituary, a chat excerpt, a memory) about a specific person into Claude, have the agent weave it into that person's wiki page with proper provenance, and — if the text contains GEDCOM-extractable facts — surface a confirmation prompt so the user can approve or reject updating the underlying `.ged` record.

## Why this exists

Today the pipeline is one-way: GEDCOM is the source of truth for
genealogy facts (names, dates, places, family relationships); derived
YAMLs flow from it; wiki pages render the YAMLs plus agent-authored
prose. There's no path from "the agent learned a new fact while
writing prose" back to the GEDCOM.

The audit (Severity 5.4) flagged this as a real contract gap. The user's
motivating use case made it concrete: they want to paste raw data,
have the agent both weave it into the narrative *and* propose updates
to the GEDCOM, with a confirmation step and full change tracking.

## The flow end-to-end

```
[ user pastes raw text into Claude ]
              │
              ▼
[ wai snapshot --inline → vault hash + Source: page ]
              │
              ▼
[ agent edits the person's wiki page; weaves the new fact in
  with a :::cite-vault directive pointing to the new hash ]
              │
              ▼
[ agent detects: does this fact also belong in the GEDCOM? ]
              │
              ├── no  → done. Wiki updated; GEDCOM unchanged.
              │
              └── yes →
                    │
                    ▼
              [ wai gedcom-propose <record> ]
                    │
                    ▼
              [ CLI prints unified GEDCOM diff;
                user reviews; types y/n ]
                    │
                    ├── reject → no-op. Wiki keeps the new fact;
                    │            GEDCOM unchanged.
                    │
                    └── accept →
                          │
                          ▼
                    [ patch .ged file → run wai sync-gedcom →
                      git commit with provenance ]
```

## Sketch of the components

### 1. Inline vault snapshots: `wai snapshot --inline`

Today `wai snapshot <dir>` walks a directory and adds files to the
content-addressed vault. Add an `--inline` flag (or a sibling subcommand)
that takes raw text from stdin or from `--text "..."`:

```
echo "Bob died in 1983 in Boston of a heart attack." | wai snapshot --inline --about "bob-smith" --kind "memory"
```

Returns the vault hash. Optionally generates or updates a `Source:`
page with metadata about the snapshot (when, who pasted it, what kind,
which person it's about).

The new entry point is small — file: `cli/src/commands/snapshot-inline.ts`,
or a flag on the existing snapshot command.

### 2. Cite-and-weave (existing tooling)

Once the text has a vault hash, weaving it into the narrative is just
a normal `wai edit`: the agent reads the page, inserts the new
sentences with `:::cite-vault{snapshot="..."}` directives, and writes
the page back with a summary like `"add detail from 2026-05-03 paste
about Bob's death"`.

No new infrastructure needed for this step — the cite-vault directive
is already implemented in `frontend/components/directives/`.

### 3. GEDCOM-extractable fact detection

The hard part. The agent has to recognize when a sentence in the new
prose carries a structured genealogy fact:

- Birth/death events (date, place, cause)
- Marriage events (date, place, spouse)
- Place changes (residence, immigration)
- Name variants (maiden names, alternate spellings, Hebrew names)
- Family-tree edges (newly-discovered parent, child, sibling)

A new module `core/src/gedcom/extract.ts` exports:

```ts
export interface ExtractableFact {
  kind: 'birth' | 'death' | 'marriage' | 'residence' | 'name' | 'parent' | 'child' | 'spouse';
  // Subject person (record id).
  subject: string;
  // Structured fields — exactly what the GEDCOM tag wants.
  date?: string;
  place?: string;
  // For relationship facts:
  related?: { record: string; role: 'parent' | 'spouse' | 'child' };
  // Provenance.
  vaultHash: string;
  sourcePassage: string;  // the sentence the fact was extracted from
}

export function extractFacts(opts: {
  prose: string;
  subjectRecord: string;
  vaultHash: string;
  existingRecord: DerivedRecord;
}): ExtractableFact[];
```

The function is pure (no I/O). It runs in the agent's context and
relies on the agent's reading of the prose. Implementation will likely
be agent-driven (a structured prompt that asks the model to identify
factual sentences) rather than rule-based — too much variability in
free prose for regex.

### 4. GEDCOM diff

Another pure module: `core/src/gedcom/diff.ts`. Given a current
`DerivedRecord` and a list of `ExtractableFact`s, produces a unified
diff of the underlying GEDCOM record.

```ts
export interface GedcomPatch {
  record: string;           // the .ged record id
  unifiedDiff: string;      // human-readable diff for confirmation UI
  apply(text: string): string;  // pure transform on the .ged file's text
}

export function buildPatch(opts: {
  currentRecord: DerivedRecord;
  currentGedcomText: string;
  facts: ExtractableFact[];
}): GedcomPatch;
```

The `unifiedDiff` is what the user sees. Format: standard `diff -u`
output of the affected GEDCOM record's lines, with `-` for removed
lines and `+` for added lines. Levels and tags visible — *this* is the
contract:

```
@@ Record I28906360453 — Leonid Berman @@
 0 @I28906360453@ INDI
 1 NAME Leonid /Berman/
 1 BIRT
 2 DATE 12 JAN 1936
 2 PLAC Kyiv, Ukraine
+1 DEAT
+2 DATE 1983
+2 PLAC Boston, Massachusetts, USA
+2 NOTE Heart attack — see vault hash 9b980e25...
```

### 5. CLI surface: `wai gedcom-propose`

```
wai gedcom-propose --patch <json>
```

The agent calls this with a serialized `GedcomPatch` (json on stdin).
The CLI:

1. Prints the `unifiedDiff` to stderr.
2. Prompts `Apply this change? [y/N]` on stdin.
3. On `y`: applies the patch to the `.ged` file, runs `wai sync-gedcom`
   internally to refresh the derived YAMLs, makes a git commit on the
   user-data repo with the message:
   ```
   chore: gedcom — add Leonid Berman's death (1983, Boston)

   Source: vault hash 9b980e2570...
   Page: leonid-berman
   Pasted: 2026-05-03
   ```
4. On `n` or anything else: exits 0 with no changes.

The commit message format is structured — the `Source:` line lets us
trace any GEDCOM change back to its originating paste, which is the
audit trail the user asked for.

### 6. Failure modes the implementation must address

- **Agent extracts a fact wrong from the pasted text.** Mitigation:
  the unified diff is verbose enough that the user catches it.
  Recovery: every change is a git commit; revert is one command on the
  user-data repo.
- **User confirms a wrong change.** Same mitigation. Add `wai gedcom-revert <commit>`
  if the standard `git revert` flow is too unwieldy.
- **GEDCOM and narrative diverge after a manual GEDCOM edit.** `wai recite`
  already exists for citation drift; the new flow should compose with
  it (after a `gedcom-propose` apply, the user's existing pages may
  have stale snapshot pointers — `wai recite --apply` advances them).
- **Pasted text contains private info the user didn't realize they
  pasted.** Vault objects can be removed (`wai vault rm <hash>`), and
  pages that cite them get the `:::cite-vault` directive marked as
  broken on next render. Add this remove path if it doesn't already
  exist.
- **Race between a paste-driven GEDCOM edit and a manual GEDCOM edit.**
  The `gedcom-propose` apply step should refuse if the `.ged` file's
  hash doesn't match the snapshot used to compute the diff, with
  guidance to re-run.

### 7. Optional surface: unified change feed

`wai timeline [--since 7d]` lists all changes across the user-data repo
in chronological order: wiki page edits, vault additions, GEDCOM
commits. Useful for "what did the agent do this week?" and for
auditing in general.

Not core to the round-trip flow; track separately if the simpler change
feed via `git log` doesn't suffice.

## Open questions

- **Where does the fact-extraction prompt live?** Probably in
  `plugins/whoami/skills/gedcom-extraction/` as its own skill so the
  prompting can iterate independently.
- **Multi-person facts.** "Leonid and Zina divorced in 1962" affects
  two records. The patch model needs to support multiple subjects in
  one paste, with one combined diff or one diff per record.
- **Fact precedence.** If the GEDCOM already has `DEAT 1980` and the
  paste says `DEAT 1983`, what happens? The diff shows the conflict;
  the user picks. Should the CLI surface a "this overrides existing
  data" warning louder than a normal addition? Lean: yes — different
  visual treatment in the diff (red instead of green).
- **Provenance trail in the GEDCOM itself.** The commit message
  records the source; should the GEDCOM also? Adding a `2 SOUR @S...@`
  line per added fact would make the source visible in the GEDCOM
  itself, which may be valuable when exporting the `.ged` to another
  tool. Decide with the user when implementing.

## Trigger to execute

The user starts using the paste-to-narrative flow on real data, or
expresses interest in building it out. The schema-migrations and
search-index-rebuild plans don't block this one — but the cli/server
contract plan probably does (the new endpoint surface for
`gedcom-propose` should ship through the typed contract from the start).

## References

- Audit finding: `~/.claude/plans/do-an-architecture-audit-partitioned-cherny.md` Severity 5.4
- Existing vault: `plugins/whoami/CLAUDE.md` ("Sources" section), `wai snapshot` command
- Existing cite-vault directive: `frontend/components/directives/`
- Existing recite tooling: `core/src/gedcom/recite.ts`, `cli/src/commands/recite.ts`
- GEDCOM types: `core/src/gedcom/types.ts`
- Eventual new modules:
  - `core/src/gedcom/extract.ts` (pure fact extraction)
  - `core/src/gedcom/diff.ts` (pure patch builder)
  - `cli/src/commands/snapshot-inline.ts`
  - `cli/src/commands/gedcom-propose.ts`
  - `plugins/whoami/skills/gedcom-extraction/SKILL.md`
- Related plans:
  - `2026-05-03-cli-server-contract.md` — should ship the new endpoints through typed contract
  - `2026-05-03-search-index-rebuild.md` — the new `wai gedcom-propose` apply flow triggers a rebuild
