import type { TestCase, CheckpointSpec } from '../types.js';

export function buildSourcePrompt(task: TestCase, wikiUrl: string): string {
  const sources = task.sources
    .map((s) => `- ${s.path}`)
    .join('\n');

  return `You are developing source documentation pages for whoami.wiki.

Task: Document the following data sources.

Source directories (already pre-staged into the vault by the runner):
${sources}

Wiki URL: ${wikiUrl}

Instructions:
1. Sources are pre-snapshotted into the vault by the runner — you do NOT need to ingest them. Citation hashes will resolve.
2. For each source, write a markdown page named \`source-<name>\` (slug, lowercase-hyphenated). Use \`wai write source-<name> --summary "init source page" --stdin\` to author it (or \`--file <path>\` to upload from disk).
3. Read existing source pages with \`wai search source\` (find source-prefixed pages) and \`wai read source-<name>\` to inspect what is already there.
4. Enrich each source page with detailed documentation:
   - Open databases and files in the source directory to extract statistics
   - Add an overview table (account holder, platform, date range, total records)
   - Document key files, content breakdowns, top conversations
   - Add data quality notes and querying instructions (SQL recipes, key tables)
   - Follow the editorial guide's source page structure
5. Update each source page using \`wai write source-<name> --summary "<msg>" --stdin\`.`;
}

export function buildContentPrompt(task: TestCase, wikiUrl: string): string {
  return `You are writing a ${task.pageType} page for whoami.wiki — a personal encyclopedia documenting a person's life through primary sources (chat logs, social media exports, databases).

Task: ${task.description}

Wiki URL: ${wikiUrl}

## Research strategy

Your goal is to write a rich, encyclopedic article about a person — not a data analysis report. The page should read like a Wikipedia biography grounded in primary sources.

### Phase 1: Understand the data landscape
1. Run \`wai search source\` to list source-prefixed pages, then \`wai read source-<name>\` for each
2. Study the **Top conversations** table to find relevant threads
3. Note the **Querying** section — it shows how to resolve snapshot hashes to vault objects

### Phase 2: Deep-read conversations for biographical facts
This is the most important phase. You need to read actual message content, not just aggregate statistics.

- **Sample broadly across the timeline**: Don't just read the first/last N messages. Use the monthly volume table to identify high-activity periods, then sample 50-100 messages from each.
- **Search for biographical keywords**: Query messages containing words like "born", "birthday", "school", "college", "work", "job", "moved", "family", "sister", "brother", "mom", "dad", "home" to find identity-revealing passages.
- **Read key narrative moments**: First contact, first meeting, confessions, conflicts, reunions, farewells — these are the backbone of a person page.
- **Cross-reference sources**: If a person appears in both Instagram and WhatsApp, compare what's said in each to build a fuller picture.
- **Extract direct quotes**: Find memorable or revealing statements that can be used as blockquotes. These bring the page to life.

### Phase 3: Write the page
- **Infobox first**: Fill in as many fields as the data supports. Use a container directive:
  \`\`\`
  :::infobox-person
  name: Full Name
  birth_date: 1990-01-01
  birth_place: City, State
  ...
  :::
  \`\`\`
- **Lead paragraph**: Identify the person, their relationship to the wiki owner, and the arc of their connection — in documentary voice, not data-report voice.
- **Sections**: Organize by topic with markdown headings (\`## Background\`, \`## Education\`, \`## Connection with [wiki owner]\`, etc.), not by data source. Aim for 5+ sections with subsections (\`### Subheading\`).
- **Density**: Target 800+ words of prose. Include blockquotes, direct quotes, and specific details (dates, places, names).
- **Citations**: Every factual claim needs a \`::cite-message{snapshot=H date=YYYY-MM-DD thread="..."}\` leaf directive (single line, single colon-pair). Use \`::cite-vault{snapshot=H}\` in the Bibliography.
- **Talk page**: Talk pages are markdown files named \`<slug>.talk\` — write open editorial gaps (unverified claims, missing data) as separate threads using the \`::open\` admonition. Author via \`wai write <slug>.talk --summary "<msg>" --stdin\`.

### Markdown directive syntax (critical)
- **Leaf** directives are single-line, single colon-pair: \`::cite-message{snapshot=H ...}\`, \`::cite-vault{snapshot=H}\`, \`::cite-voice-note{speaker="X" ...}\`, \`::cite-testimony{speaker="X" date=D}\`, \`::open\`, \`::closed\`, \`::superseded\`, \`::gap\`.
- **Container** directives are triple-colon, body on subsequent lines, closed by \`:::\` on its own line:
  \`\`\`
  :::blockquote{by="Person Name"}
  Quoted text goes here.
  :::
  \`\`\`
  Same shape for \`:::dialogue{speaker="X"}\`, \`:::infobox-person\`. The one-line \`:::name{...}:::\` form does NOT parse — never write that.
- **Headings**: \`## H2\`, \`### H3\`. **Bold**: \`**bold**\`. **Italic**: \`*italic*\`.
- **Wiki links**: \`[[Page]]\`, \`[[Page|alt]]\`, \`[[Page#section]]\` are preserved.
- **Images**: \`![caption](/assets/name.jpg)\`.
- **Footnotes** (formerly \`<ref>\`): \`text[^id]\` with the body \`[^id]: source\` later in the file. Footnotes auto-collect at the end — do not add a manual references section.

### Common mistakes to avoid
- Writing a "thread analysis" or "message profile" instead of a biography
- Only extracting aggregate stats (message counts, date ranges) without reading what was actually said
- Sampling only from the edges of a conversation (first/last messages) instead of the biographical middle
- Leaving infobox fields empty when the data is available in messages
- Omitting blockquotes and dialogue — these are expected in person pages

## Tools
- \`wai search source\` — list source-prefixed pages
- \`wai read <slug>\` — read a wiki page (slugs are lowercase-hyphenated; e.g. "Steven Barash" → \`steven-barash\`)
- \`wai create <slug> --summary "<msg>" --stdin\` (or \`--file <path>\`) — create a new page
- \`wai write <slug> --summary "<msg>" --stdin\` (or \`--file <path>\`) — overwrite an existing page
- \`wai edit <slug>\` — open the page in \$EDITOR for in-place edits
- \`wai delete <slug> --summary "<msg>"\` — delete a page
- \`wai write <slug>.talk --summary "<msg>" --stdin\` — author/update a talk page
- \`wai search <query>\` — search pages
- Use \`jq\` and \`sqlite3\` to query vault objects per the source page instructions`;
}

interface OwnerAnecdote {
  type: string;
  content: string;
  topic?: string;
  conflicts_with?: string;
}

export function buildCheckpointPrompt(
  task: TestCase,
  wikiUrl: string,
  checkpoint: CheckpointSpec,
  checkpointIndex: number,
  priorPages: string[],
  ownerEntries?: unknown[],
): string {
  const parts: string[] = [];

  // Context
  parts.push(`You are working on a ${task.pageType} page for whoami.wiki — a personal encyclopedia documenting a person's life through primary sources.`);
  parts.push('');
  parts.push(`Wiki URL: ${wikiUrl}`);
  parts.push('');

  // Step header
  parts.push(`## Step ${checkpointIndex + 1}: ${checkpoint.id}`);
  parts.push('');
  parts.push(checkpoint.description);
  parts.push('');

  // New sources for this checkpoint
  if (checkpoint.sources && checkpoint.sources.length > 0) {
    parts.push('### New sources for this step');
    for (const s of checkpoint.sources) {
      parts.push(`- ${s.path}`);
    }
    parts.push('');
    parts.push('These source directories are pre-staged in the vault by the runner — citation hashes already resolve. For each new source, write a markdown source page via `wai write source-<name> --summary "init source page" --stdin`. Read existing source pages with `wai search source` and `wai read source-<name>`.');
    parts.push('');
  }

  // Existing pages from prior checkpoints
  if (priorPages.length > 0) {
    parts.push('### Existing wiki pages');
    parts.push('The following pages already exist in the wiki from previous steps. Read them with `wai read <slug>` (slugs are lowercase-hyphenated) to understand what has been done so far:');
    for (const title of priorPages) {
      parts.push(`- ${title}`);
    }
    parts.push('');
  }

  // Expected output from grade targets
  const gradePatterns = checkpoint.grade.map((g) => `${g.pattern} (${g.role})`);
  if (gradePatterns.length > 0) {
    parts.push('### Expected output');
    parts.push('After this step, the following pages should exist or be updated:');
    for (const p of gradePatterns) {
      parts.push(`- ${p}`);
    }
    parts.push('');
  }

  // Planning guidance at checkpoint 1
  if (checkpointIndex === 0) {
    parts.push('### Editorial planning');
    parts.push('Plan your editorial approach before diving into the data. Use whatever planning tools are available to organize the work — outline the key questions to answer, the sections you expect to write, and the research strategy for finding biographical facts in the source data.');
    parts.push('');
  }

  // Owner-provided context
  if (ownerEntries && ownerEntries.length > 0) {
    parts.push('### Owner-provided context');
    parts.push('The wiki owner has shared personal memories and corrections.');
    parts.push('Cite these using the leaf directive `::cite-testimony{speaker="..." date=YYYY-MM-DD}` (single line).');
    parts.push('Where they conflict with digital source data, note the discrepancy on the talk page (`<slug>.talk`).');
    parts.push('');
    for (const entry of ownerEntries as OwnerAnecdote[]) {
      const label = entry.type ? `[${entry.type}]` : '';
      const topic = entry.topic ? ` (${entry.topic})` : '';
      const conflict = entry.conflicts_with ? ` Conflicts with: ${entry.conflicts_with}` : '';
      parts.push(`- ${label}${topic} ${entry.content}${conflict}`);
    }
    parts.push('');
  }

  // Media embedding guidance
  const mediaStages = ['survey', 'draft', 'new-source', 'episodes', 'persons', 'owner-input', 'verify'];
  if (mediaStages.includes(checkpoint.id)) {
    parts.push('### Media embedding');
    parts.push('There is no `wai upload` command — assets are stored on disk. To embed media in a page:');
    parts.push('1. Write the asset file directly to `~/whoami/assets/<path>` (create subdirectories as needed).');
    parts.push('2. Reference it from markdown with standard image syntax: `![caption](/assets/<path>)`.');
    parts.push('');
    parts.push('**Prefer individual files over contact sheets.** Save each meaningful photo separately and embed it in the specific section it relates to — e.g. a concert photo in the Music section, a travel photo in the trip subsection. Contact sheets are useful as a supplementary overview on source pages, but the main content pages should use individual images placed in context.');
    parts.push('');
    parts.push('For audio/video, write the file under `~/whoami/assets/...` and reference it via `![caption](/assets/name.mp3)` near the relevant text.');
    parts.push('');
    parts.push('To find what assets already exist, list the `~/whoami/assets/` directory directly, or look at existing source pages to see what has been referenced.');
    parts.push('');
  }

  // Timezone guidance
  parts.push('### Timezone handling');
  parts.push('Source data often uses mixed timezone representations. Before citing any timestamp:');
  parts.push('- **Uber/Lyft CSVs**: Check the timezone column (e.g. `America/New_York`). The `_local` columns may still be in UTC despite the name.');
  parts.push('- **iMessage/SMS exports**: Timestamps display in the recording device\'s timezone, which may differ from the location at the time.');
  parts.push('- **EXIF photo metadata**: Check `Offset Time` or `Time Zone Offset` fields for the UTC offset (e.g. `-06:00` for CST).');
  parts.push('- **Location history JSON**: Check for explicit UTC offsets in timestamp fields (e.g. `2022-03-26T14:00:00-06:00`).');
  parts.push('- **General rule**: Convert all timestamps to the local timezone of the event location before writing them in the article. Note the source timezone in citations when ambiguous.');
  parts.push('');

  // Tools reference
  parts.push('### Tools');
  parts.push('- `wai search source` — list source-prefixed pages');
  parts.push('- `wai read <slug>` — read a wiki page (slugs are lowercase-hyphenated)');
  parts.push('- `wai create <slug> --summary "<msg>" --stdin` (or `--file <path>`) — create a new page');
  parts.push('- `wai write <slug> --summary "<msg>" --stdin` (or `--file <path>`) — overwrite an existing page');
  parts.push('- `wai edit <slug>` — open the page in $EDITOR for in-place edits');
  parts.push('- `wai delete <slug> --summary "<msg>"` — delete a page');
  parts.push('- `wai write <slug>.talk --summary "<msg>" --stdin` — author/update a talk page (talk pages are `<slug>.talk` markdown files)');
  parts.push('- `wai search <query>` — full-text search');
  parts.push('- `wai sync-gedcom <file>` — import a GEDCOM file');
  parts.push('- Assets: write files directly under `~/whoami/assets/<path>` and reference via `![caption](/assets/<path>)`');
  parts.push('- Use `jq` and `sqlite3` to query vault objects per the source page instructions');
  parts.push('- Use `convert` / `montage` (ImageMagick) for image processing (contact sheets, thumbnails)');
  parts.push('- Use `ffmpeg` / `ffprobe` for audio/video processing (extraction, thumbnails, duration)');
  parts.push('');
  parts.push('### Available API keys (in environment)');
  parts.push('- `OPENAI_API_KEY` — OpenAI Whisper API for audio transcription (`https://api.openai.com/v1/audio/transcriptions`)');
  parts.push('- `GOOGLE_PLACES_API_KEY` — Google Places / Geocoding API for reverse-geocoding coordinates to place names');
  parts.push('');
  parts.push('You are free to write scripts, install packages, and build tools as needed to process the data.');

  return parts.join('\n');
}
