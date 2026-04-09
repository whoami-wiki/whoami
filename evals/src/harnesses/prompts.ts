import type { TestCase, CheckpointSpec } from '../types.js';

export function buildSourcePrompt(task: TestCase, wikiUrl: string): string {
  const sources = task.sources
    .map((s) => `- ${s.path}`)
    .join('\n');

  return `You are developing document analysis pages for ProjectWiki.

Task: Ingest and catalog the following contract document volumes.

Document directories to ingest:
${sources}

Wiki URL: ${wikiUrl}

Instructions:
1. Ingest each document directory using \`wai ingest volume <dir> --type <type> --name "<name>"\`
2. Read the generated index entries using \`wai read\`
3. The ingest command creates minimal index entries.
   Enrich each entry with detailed documentation:
   - Open documents in the vault to extract metadata and content
   - Add an overview table (discipline, sheet count, revision date, drawing range)
   - Document key drawings, specification sections, and cross-references
   - Add data quality notes and identify any missing or illegible sheets
   - Follow the editorial guide's page structure for the document type
4. Update each page using \`wai write\``;
}

export function buildContentPrompt(task: TestCase, wikiUrl: string): string {
  return `You are writing a ${task.pageType} page for ProjectWiki — a construction project encyclopedia built from contract documents (drawings, specifications, RFIs, submittals).

Task: ${task.description}

Wiki URL: ${wikiUrl}

## Research strategy

Your goal is to write a rich, encyclopedic article about a construction project element — not a document index or data dump. The page should read like a technical encyclopedia entry grounded in contract documents.

### Phase 1: Understand the document landscape
1. Review available document volumes and their contents
2. Identify which drawings, specifications, and construction documents are relevant
3. Note cross-references between documents — drawings referencing specs, RFIs modifying drawings, etc.

### Phase 2: Deep-read documents for design and construction facts
This is the most important phase. You need to extract actual content from the documents, not just catalog them.

- **Analyze drawings systematically**: Follow the observations-before-interpretation protocol. Record title block data, physical observations, dimensions, materials, and cross-references before interpreting.
- **Extract specification requirements**: Identify Part 1/2/3 structure, key materials, testing criteria, submittal requirements, and quality standards.
- **Cross-reference document types**: Compare what drawings show against what specs require. Identify any conflicts, ambiguities, or gaps.
- **Process construction documents**: Trace RFI questions to responses, check which drawings and specs are affected, and verify that modifications are consistent.
- **Identify verbatim contract language**: Find specification language that has contractual significance (scope definitions, performance criteria, warranty terms) for \`{{Verbatim}}\` blocks.

### Phase 3: Write the page
- **Infobox first**: Fill in as many fields as the documents support (tag numbers, dimensions, elevations, capacities, spec references, etc.)
- **Lead paragraph**: Identify the process area or equipment, its function, and key design parameters — in documentary voice, not document-listing voice.
- **Sections**: Organize by discipline (Structural, Mechanical, Electrical, I&C, Civil) or by topic, not by document source. Aim for 4+ sections with subsections.
- **Density**: Target 600+ words of prose. Include specific dimensions, elevations, material callouts, and cross-references to other pages.
- **Citations**: Every factual claim needs a citation (\`{{Cite drawing}}\`, \`{{Cite spec}}\`, \`{{Cite rfi}}\`, etc.) with hash, date, and note fields. Use \`{{Cite vault}}\` in the Bibliography.
- **Talk page**: Post verification status, active gaps (unresolved questions), and coordination issues as separate threads with \`{{Open}}\` tags. Include a \`{{Verification}}\` template.

### Common mistakes to avoid
- Writing a "document index" instead of an encyclopedic article
- Only listing document titles and numbers without extracting content
- Skipping the observations phase on drawings and jumping straight to interpretation
- Leaving infobox fields empty when the data is available in the documents
- Omitting cross-references between drawings, specs, and construction documents

## Tools
- \`wai read "<title>"\` — read wiki pages
- \`wai create "<title>"\` / \`wai write "<title>" <file>\` — create/update pages
- \`wai talk create "<title>" -s "<subject>" -c "<content>"\` — post to talk page
- Use \`pdftotext\` and \`pdftk\` to extract text and split PDF documents`;
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
  parts.push(`You are working on a ${task.pageType} page for ProjectWiki — a construction project encyclopedia built from contract documents (drawings, specifications, RFIs, submittals).`);
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
    parts.push('### New documents to ingest');
    for (const s of checkpoint.sources) {
      parts.push(`- ${s.path}`);
    }
    parts.push('');
    parts.push('Ingest each new document directory using `wai ingest volume <dir> --type <type> --name "<name>"`, then review the generated pages with `wai read`.');
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
    parts.push('### Analysis planning');
    parts.push('Plan your analysis approach before diving into the documents. Use whatever planning tools are available to organize the work — outline the key areas to document, the drawing sheets to analyze, the specification sections to extract, and the cross-referencing strategy.');
    parts.push('');
  }

  // Owner-provided context (project team input for construction)
  if (ownerEntries && ownerEntries.length > 0) {
    parts.push('### Project team input');
    parts.push('The project team has shared additional context and corrections.');
    parts.push('Where team input conflicts with contract documents, note the discrepancy on the Talk page.');
    parts.push('');
    for (const entry of ownerEntries as OwnerAnecdote[]) {
      const label = entry.type ? `[${entry.type}]` : '';
      const topic = entry.topic ? ` (${entry.topic})` : '';
      const conflict = entry.conflicts_with ? ` Warning: Conflicts with: ${entry.conflicts_with}` : '';
      parts.push(`- ${label}${topic} ${entry.content}${conflict}`);
    }
    parts.push('');
  }

  // Document analysis guidance
  const analysisStages = ['ingest', 'analyze', 'cross-ref', 'construction', 'verify', 'review'];
  if (analysisStages.includes(checkpoint.id)) {
    parts.push('### Document analysis protocol');
    parts.push('When analyzing drawings, follow the observations-before-interpretation protocol:');
    parts.push('1. **Title block** — extract drawing number, title, revision, date, discipline');
    parts.push('2. **Physical observations** — record what you see without interpretation');
    parts.push('3. **Dimensions and elevations** — tabulate key measurements');
    parts.push('4. **Cross-references** — list other drawings referenced');
    parts.push('5. **Engineering interpretation** — analyze significance only after observations');
    parts.push('');
    parts.push('When analyzing specifications, preserve the Part 1/2/3 structure and use `{{Verbatim}}` blocks for contractually significant language.');
    parts.push('');
  }

  // Tools reference
  parts.push('### Tools');
  parts.push('- `wai read "<title>"` — read wiki pages');
  parts.push('- `wai ingest volume <dir> --type <type> --name "<name>"` — ingest a document directory');
  parts.push('- `wai create "<title>"` / `wai write "<title>" <file>` — create/update pages');
  parts.push('- `wai upload <file>` — upload a file to the wiki');
  parts.push('- `wai talk create "<title>" -s "<subject>" -c "<content>"` — post to talk page');
  parts.push('- Use `pdftotext` and `pdftk` to extract text and split PDF documents');
  parts.push('');
  parts.push('You are free to write scripts, install packages, and build tools as needed to process the documents.');

  return parts.join('\n');
}
