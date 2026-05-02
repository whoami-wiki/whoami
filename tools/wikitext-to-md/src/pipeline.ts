import type { RawPage, PageMeta, PageType, Warning } from './types.ts';
import { renderFrontmatter } from './frontmatter.ts';
import { extractCategories } from './extractors/categories.ts';
import { extractRedirect } from './extractors/redirect.ts';
import { extractCiteVaultRef } from './extractors/cite-vault-ref.ts';
import { transformInfoboxPerson } from './transforms/infobox-person.ts';
import { transformInfoboxCompany } from './transforms/infobox-company.ts';
import { transformCiteVault } from './transforms/cite-vault.ts';
import { transformCiteMessage } from './transforms/cite-message.ts';
import { transformAdmonitions } from './transforms/admonitions.ts';
import { transformGap } from './transforms/gap.ts';
import { transformBlockquote } from './transforms/blockquote.ts';
import { transformDialogue } from './transforms/dialogue.ts';
import { transformColumnsList } from './transforms/columns-list.ts';
import { transformRefs } from './transforms/refs.ts';
import { transformTables } from './transforms/tables.ts';
import { transformBoldItalic } from './transforms/bold-italic.ts';
import { transformHeadings } from './transforms/headings.ts';
import { pruneEmptyHeadings } from './transforms/prune-empty-headings.ts';

export type ConvertResult =
  | {
      kind: 'page';
      title: string;
      namespace: number;        // 0 = main, 1 = talk
      md: string;
      warnings: Warning[];
    }
  | {
      kind: 'redirect';
      fromTitle: string;
      target: string;
    };

export function convertPage(raw: RawPage, snapshotHash: string, owner: string): ConvertResult {
  // 1. Redirect short-circuit
  const redirect = extractRedirect(raw.text);
  if (redirect) {
    return { kind: 'redirect', fromTitle: raw.title, target: redirect.target };
  }

  const warnings: Warning[] = [];

  // 2. Extract categories from body (mutates body)
  const cats = extractCategories(raw.text);
  let body = cats.body;

  // 3. Extract cite-vault gedcom ref (does NOT mutate body)
  const citeRef = extractCiteVaultRef(body, snapshotHash);
  if (citeRef.warning) {
    warnings.push({ ...citeRef.warning, page: raw.title });
  }

  // 4. Run body transforms in fixed order. Block-level templates first
  //    (so their bodies are extracted before inline transforms touch them),
  //    then inline emphasis, then headings/refs/tables.
  body = transformInfoboxPerson(body);
  body = transformInfoboxCompany(body);
  body = transformCiteVault(body);
  body = transformCiteMessage(body);
  body = transformAdmonitions(body);
  body = transformGap(body);
  body = transformBlockquote(body);
  body = transformDialogue(body);
  body = transformColumnsList(body);
  body = transformBoldItalic(body);
  body = transformHeadings(body);
  body = transformRefs(body);
  body = transformTables(body);
  body = pruneEmptyHeadings(body);

  // 5. Build frontmatter
  const meta: PageMeta = {
    title: humanTitle(raw.title),
    owner,
    editors: [],
    type: inferType(raw),
    aliases: [],
    categories: cats.categories,
    ...(citeRef.ref ? { gedcom: citeRef.ref } : {}),
    created: yyyymmddToIso(raw.createdAt),
  };

  const md = renderFrontmatter(meta) + '\n' + body.trimEnd() + '\n';
  return { kind: 'page', title: raw.title, namespace: raw.namespace, md, warnings };
}

function humanTitle(title: string): string {
  return title.replace(/_/g, ' ');
}

function inferType(_raw: RawPage): PageType {
  // First pass: everything in NS 0 is a person; family pages and synthesis
  // pages get reclassified by a small whitelist of known titles. Refine
  // when a known set emerges from the real data; for now default 'person'.
  return 'person';
}

function yyyymmddToIso(ts: string): string {
  // '20260429140700' → '2026-04-29'
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}
