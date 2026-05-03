# Family Browser: Portraits & Monogram Avatars Plan

**Goal:** Add a small avatar to person tiles and rows — initially a monogram (initials on a side-tinted background) so the user gets recognition value from existing data; ready to upgrade to real portraits when the user adds `portrait:` frontmatter.

**Audit result:** No `portrait`/`image`/`photo` fields exist in any wiki page (`~/whoami/pages/*.md` checked 2026-05-03). Shipping monogram-only for now is honest and unblocks the visual gain immediately.

**Architecture:**
- `frontend/lib/initials.ts` (new, tested) — `initials(name)` returns up to 2 uppercase letters; handles "First Middle Last" and single-name cases.
- `frontend/components/family/avatar-monogram.tsx` (new) — small circular div with initials, tinted by `side` (paternal/maternal/self/none), with a portrait `<img>` taking over when `portrait` URL is supplied.
- Slug join already pulls page metadata; extend `core/src/pages/index.ts` ListEntry to include `portrait?: string` from frontmatter, then surface via `BrowserPersonView.portrait` when joining slug.
- `AncestorTile`, `PersonRow`, and `LifespanBar` get an optional avatar slot. Compact size (1.5rem / 24px).

---

### Task 1: initials helper

**Files:**
- Create: `frontend/lib/initials.ts`
- Test: `frontend/lib/initials.test.ts`

- [ ] Step 1: Tests

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initials } from './initials';

test('initials: first and last name', () => {
  assert.equal(initials('Steven Barash'), 'SB');
});

test('initials: middle names ignored', () => {
  assert.equal(initials('Steven Nicholas Barash'), 'SB');
});

test('initials: single name returns one letter', () => {
  assert.equal(initials('Madonna'), 'M');
});

test('initials: empty/whitespace returns ?', () => {
  assert.equal(initials(''), '?');
  assert.equal(initials('   '), '?');
});

test('initials: handles diacritics', () => {
  assert.equal(initials('Élise Müller'), 'ÉM');
});
```

- [ ] Step 2: Implementation

```ts
// frontend/lib/initials.ts
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
```

- [ ] Step 3: Run + commit

```bash
cd frontend && npx tsx --test lib/initials.test.ts
git add frontend/lib/initials.ts frontend/lib/initials.test.ts
git commit -m "feat: add initials helper"
```

---

### Task 2: AvatarMonogram component

**Files:**
- Create: `frontend/components/family/avatar-monogram.tsx`

- [ ] Step 1: Component

```tsx
import { initials } from '@/lib/initials';

interface Props {
  name: string;
  side?: 'self' | 'paternal' | 'maternal' | null;
  portrait?: string | null;
  size?: 'sm' | 'md';
}

export function AvatarMonogram({ name, side, portrait, size = 'sm' }: Props) {
  const tint =
    side === 'paternal' ? 'var(--paternal)'
    : side === 'maternal' ? 'var(--maternal)'
    : 'var(--muted-foreground)';
  const px = size === 'md' ? 28 : 22;
  if (portrait) {
    return (
      <img
        src={portrait}
        alt=""
        aria-hidden
        className="shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
        width={px}
        height={px}
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display text-[0.62rem] font-medium tabular-nums text-background"
      aria-hidden
      style={{ width: px, height: px, backgroundColor: tint, opacity: 0.85 }}
    >
      {initials(name)}
    </span>
  );
}
```

- [ ] Step 2: Type-check + commit

```bash
cd frontend && npx tsc --noEmit
git add frontend/components/family/avatar-monogram.tsx
git commit -m "feat: add avatar monogram component"
```

---

### Task 3: Wire portrait through page list + family view

**Files:**
- Modify: `core/src/pages/index.ts` to expose `portrait?: string` on ListEntry (read from frontmatter `portrait` key).
- Modify: `frontend/lib/family.ts` so `BrowserPersonView`/`BrowserRelationView` get a `portrait?: string` field, populated alongside `slug` via the cached page list.

- [ ] Step 1: Inspect ListEntry shape and frontmatter loader

Run: `grep -n 'export interface ListEntry\|gedcomRecord' core/src/pages/index.ts`
Then read the matched span to confirm extension fits.

- [ ] Step 2: Add `portrait?: string` to ListEntry, populate from `frontmatter.portrait` (string check). No change required if there's no portrait field anywhere in the data — defaults to undefined.

- [ ] Step 3: In `frontend/lib/family.ts`, build a parallel `portraitByRecord`/`portraitByName` map alongside the slug join, and have `findSlug` return both via a new `enrichSlug(record, name): { slug?: string; portrait?: string }` style helper. Add `portrait?: string` to `BrowserPersonView`, `BrowserRelationView`, `BrowserDescendantView`. Pass through everywhere `findSlug` was used.

- [ ] Step 4: Type-check + commit

```bash
cd frontend && npx tsc --noEmit
git add core/src/pages/index.ts frontend/lib/family.ts
git commit -m "feat: thread portrait paths through family view"
```

---

### Task 4: Render avatars in tiles, rows, and lifespan bars

**Files:**
- Modify: `frontend/components/family/ancestor-tile.tsx` — accept `name`, `side`, `portrait` props (already has name); render `<AvatarMonogram>` to the left of the existing 1.5rem ordinal column. Adjust grid to `grid-cols-[1.5rem_1.5rem_1fr]`.
- Modify: `frontend/components/family/person-row.tsx` — same change, slightly larger avatar (size="md").
- Modify: `frontend/components/family/lifespan-bar.tsx` — add avatar before name.
- Update call sites in `frontend/app/family/tree/page.tsx` to pass `side` + `portrait` to each.

- [ ] Step 1: Update components and page wiring.
- [ ] Step 2: Type-check.
- [ ] Step 3: Visual smoke (curl) — confirm 200, no runtime errors.
- [ ] Step 4: Commit

```bash
git add frontend/components/family/ancestor-tile.tsx frontend/components/family/person-row.tsx frontend/components/family/lifespan-bar.tsx frontend/app/family/tree/page.tsx
git commit -m "feat: show avatar monogram on family tiles, rows, and lifespan bars"
```

---

### Task 5: Roadmap

- [ ] Mark feature #6 shipped, commit.
