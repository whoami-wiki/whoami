import type { TestCase, CheckpointSpec } from '../types.js';

export function buildSourcePrompt(task: TestCase, wikiUrl: string): string {
  const sources = task.sources
    .map((s) => `- ${s.path}`)
    .join('\n');

  return `You are developing source documentation pages for whoami.wiki.

Task: Snapshot and document the following data sources.

Source directories to ingest:
${sources}

Wiki URL: ${wikiUrl}

Instructions:
1. Snapshot each source directory using \`wai snapshot <dir>\`
2. Read the generated source pages using \`wai source list\` and \`wai read\`
3. The snapshot command creates minimal pages with only a file-type table.
   Enrich each source page with detailed documentation:
   - Open databases and files in the vault to extract statistics
   - Add an overview table (account holder, platform, date range, total records)
   - Document key files, content breakdowns, top conversations
   - Add data quality notes and querying instructions (SQL recipes, key tables)
   - Follow the editorial guide's source page structure
4. Update each source page using \`wai write\``;
}

export function buildContentPrompt(task: TestCase, wikiUrl: string): string {
  return `You are writing a ${task.pageType} page for whoami.wiki — a personal encyclopedia documenting a person's life through primary sources (chat logs, social media exports, databases).

Task: ${task.description}

Wiki URL: ${wikiUrl}

## Research strategy

Your goal is to write a rich, encyclopedic article about a person — not a data analysis report. The page should read like a Wikipedia biography grounded in primary sources.

### Phase 1: Understand the data landscape
1. Run \`wai source list\` and \`wai read\` on each source page
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
- **Infobox first**: Fill in as many fields as the data supports (name, birth_date, birth_place, home_town, education, occupation, relatives, etc.)
- **Lead paragraph**: Identify the person, their relationship to the wiki owner, and the arc of their connection — in documentary voice, not data-report voice.
- **Sections**: Organize by topic (Background, Education, Work/Interests, Connection with [wiki owner], etc.), not by data source. Aim for 5+ sections with subsections.
- **Density**: Target 800+ words of prose. Include blockquotes, direct quotes, and specific details (dates, places, names).
- **Citations**: Every factual claim needs a \`{{Cite message}}\` with snapshot, date, and thread fields. Use \`{{Cite vault}}\` in the Bibliography.
- **Talk page**: Post open editorial gaps (unverified claims, missing data) as separate threads with \`{{Open}}\` tags.

### Common mistakes to avoid
- Writing a "thread analysis" or "message profile" instead of a biography
- Only extracting aggregate stats (message counts, date ranges) without reading what was actually said
- Sampling only from the edges of a conversation (first/last messages) instead of the biographical middle
- Leaving infobox fields empty when the data is available in messages
- Omitting blockquotes and dialogue — these are expected in person pages

## Tools
- \`wai source list\` / \`wai read "<title>"\` — read wiki pages
- \`wai create "<title>"\` / \`wai write "<title>" <file>\` — create/update pages
- \`wai talk create "<title>" -s "<subject>" -c "<content>"\` — post to talk page
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
    parts.push('### New sources to ingest');
    for (const s of checkpoint.sources) {
      parts.push(`- ${s.path}`);
    }
    parts.push('');
    parts.push('Snapshot each new source directory using `wai snapshot <dir>`, then read the generated source pages with `wai source list` and `wai read`.');
    parts.push('');
  }

  // Existing pages from prior checkpoints
  if (priorPages.length > 0) {
    parts.push('### Existing wiki pages');
    parts.push('The following pages already exist in the wiki from previous steps. Read them with `wai read "<title>"` to understand what has been done so far:');
    for (const title of priorPages) {
      parts.push(`- "${title}"`);
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
    parts.push('Cite these using `{{Cite testimony|speaker=...|date=...}}`.');
    parts.push('Where they conflict with digital source data, note the discrepancy on the Talk page.');
    parts.push('');
    for (const entry of ownerEntries as OwnerAnecdote[]) {
      const label = entry.type ? `[${entry.type}]` : '';
      const topic = entry.topic ? ` (${entry.topic})` : '';
      const conflict = entry.conflicts_with ? ` ⚠️ Conflicts with: ${entry.conflicts_with}` : '';
      parts.push(`- ${label}${topic} ${entry.content}${conflict}`);
    }
    parts.push('');
  }

  // Media embedding guidance
  const mediaStages = ['survey', 'draft', 'new-source', 'episodes', 'persons', 'owner-input', 'verify'];
  if (mediaStages.includes(checkpoint.id)) {
    parts.push('### Media embedding');
    parts.push('When you upload a file with `wai upload`, it becomes available at `[[File:filename.ext]]`. Embed uploaded files in the wikitext where they enrich the reader\'s understanding — don\'t embed everything, only files that add meaningful context to a section.');
    parts.push('');
    parts.push('**Prefer individual files over contact sheets.** Upload each meaningful photo separately and embed it in the specific section it relates to — e.g. a concert photo in the Music section, a travel photo in the trip subsection. Use `[[File:name.jpg|thumb|caption]]` inline or `| image = name.jpg` in the infobox. Contact sheets are useful as a supplementary overview on source pages, but the main content pages should use individual images placed in context.');
    parts.push('');
    parts.push('For audio: use `[[File:name.ogg]]` or `[[File:name.mp3]]` inline near the relevant text.');
    parts.push('');

    parts.push('Previously uploaded files are available as `[[File:...]]`. Check what files exist with `wai read "Special:ListFiles"` or look at source pages, and embed any that are relevant to the sections you are writing. Prefer placing individual photos in context rather than linking to contact sheets.');
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
  parts.push('- `wai source list` / `wai read "<title>"` — read wiki pages');
  parts.push('- `wai snapshot <dir>` — snapshot a source directory into the vault');
  parts.push('- `wai create "<title>"` / `wai write "<title>" <file>` — create/update pages');
  parts.push('- `wai upload <file>` — upload a media file (image, audio, video) to the wiki');
  parts.push('- `wai talk create "<title>" -s "<subject>" -c "<content>"` — post to talk page');
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
