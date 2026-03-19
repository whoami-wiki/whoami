import type { GraderResult } from '../types.js';
import { extractClaims, extractClaimsOnly, validateClaimBatch } from '../llm.js';
import { resolveCitations } from './citation-resolver.js';

export interface CitationManifest {
  page: string;
  claims: {
    claim: string;
    type: string;
    citation: string;
    evidence: string | null;
  }[];
}

export interface AccuracyContext {
  vault?: { vaultPath: string };
  sourceData?: string;
  manifest?: CitationManifest;
}

export async function gradeAccuracy(
  wikitext: string,
  context: AccuracyContext,
): Promise<GraderResult> {
  // Manifest-based verification (agent-produced claim/evidence pairs)
  if (context.manifest) {
    return gradeAccuracyViaManifest(wikitext, context.manifest);
  }

  // Citation-based verification when vault is available
  if (context.vault) {
    return gradeAccuracyViaCitations(wikitext, context.vault.vaultPath);
  }

  // Fallback: blob-based verification
  return gradeAccuracyViaBlob(wikitext, context.sourceData ?? '');
}

function sanitizeManifestEvidence(manifest: CitationManifest): CitationManifest {
  return {
    ...manifest,
    claims: manifest.claims.map((c) => {
      let evidence = c.evidence;

      // Non-string evidence → try JSON.stringify to recover
      if (evidence != null && typeof evidence !== 'string') {
        try {
          evidence = JSON.stringify(evidence);
        } catch {
          evidence = null;
        }
      }

      if (typeof evidence === 'string') {
        // Literal [object Object] or similar → null
        if (/\[object\s+\w+\]/.test(evidence)) {
          evidence = null;
        // Empty or whitespace-only → null
        } else if (evidence.trim().length === 0) {
          evidence = null;
        }
      }

      return { ...c, evidence };
    }),
  };
}

/**
 * Strip wikitext markup for fuzzy text matching.
 * Removes refs, bold/italic, wikilinks, templates, HTML tags, and collapses whitespace.
 */
function stripWikitextForMatching(text: string): string {
  return text
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, ' ')
    .replace(/<ref[^/]*\/>/g, ' ')
    .replace(/'{2,5}/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function gradeAccuracyViaManifest(
  wikitext: string,
  manifest: CitationManifest,
): Promise<GraderResult> {
  const sanitized = sanitizeManifestEvidence(manifest);

  // Filter claims to only those relevant to the page being graded.
  // Manifests may include claims from Talk pages or other pages — those should
  // not penalize the episode/person page accuracy score.
  // Claims with evidence always pass through (they get validated normally).
  // Claims without evidence are checked against the stripped page text.
  const strippedPage = stripWikitextForMatching(wikitext);
  const claims = sanitized.claims.filter((c) => {
    if (c.evidence != null) return true;
    const snippet = c.claim.slice(0, 50);
    return strippedPage.includes(snippet);
  });

  if (claims.length === 0) {
    return {
      grader: 'accuracy',
      score: 0,
      details: [{ check: 'Manifest contains no claims', passed: false, penalty: 1 }],
    };
  }

  // Separate claims with and without evidence
  const withEvidence = claims.filter((c) => c.evidence != null);
  const withoutEvidence = claims.filter((c) => c.evidence == null);

  const details: { check: string; passed: boolean; penalty: number; note?: string }[] = [];
  let correct = 0;
  let total = 0;

  // Separate testimony claims from evidence-backed claims (testimony is attributed, not machine-verifiable)
  const testimonyWithEvidence = withEvidence.filter((c) => c.citation && /Cite testimony/i.test(c.citation));
  const verifiableWithEvidence = withEvidence.filter((c) => !(c.citation && /Cite testimony/i.test(c.citation)));

  for (const claim of testimonyWithEvidence) {
    correct += 1;
    total += 1;
    details.push({
      check: claim.claim,
      passed: true,
      penalty: 0,
      note: 'attributed: owner testimony (not machine-verifiable)',
    });
  }

  // Validate claims with evidence in batches
  const BATCH_SIZE = 15;
  for (let i = 0; i < verifiableWithEvidence.length; i += BATCH_SIZE) {
    const batch = verifiableWithEvidence.slice(i, i + BATCH_SIZE);
    const pairs = batch.map((c) => ({ claim: c.claim, evidence: c.evidence! }));

    try {
      const validation = await validateClaimBatch(pairs);
      for (const result of validation.results) {
        const isFabricated = result.verdict === 'fabricated';
        const isSupported = result.verdict === 'supported';

        if (isFabricated) {
          total += 2;
        } else {
          total += 1;
        }

        if (isSupported) {
          correct += 1;
        }

        details.push({
          check: result.claim,
          passed: isSupported,
          penalty: isFabricated ? 2 / claims.length : isSupported ? 0 : 1 / claims.length,
          note: `${result.verdict}${result.reason ? `: ${result.reason}` : ''}`,
        });
      }
    } catch (err) {
      // If a batch fails, mark all claims in the batch as unsupported
      for (const pair of pairs) {
        total += 1;
        details.push({
          check: pair.claim,
          passed: false,
          penalty: 1 / claims.length,
          note: `validation error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  // Claims without evidence: testimony-cited claims are 'attributed', others are 'unsupported'
  for (const claim of withoutEvidence) {
    const isTestimony = claim.citation && /Cite testimony/i.test(claim.citation);
    if (isTestimony) {
      // Properly cited owner testimony — not machine-verifiable but correctly attributed
      correct += 1;
      total += 1;
      details.push({
        check: claim.claim,
        passed: true,
        penalty: 0,
        note: 'attributed: owner testimony (not machine-verifiable)',
      });
    } else {
      total += 1;
      details.push({
        check: claim.claim,
        passed: false,
        penalty: 1 / claims.length,
        note: 'unsupported: no evidence provided in manifest',
      });
    }
  }

  const score = total > 0 ? Math.max(0, correct / total) : 1.0;

  return {
    grader: 'accuracy',
    score: Math.round(score * 1000) / 1000,
    details,
  };
}

async function gradeAccuracyViaCitations(
  wikitext: string,
  vaultPath: string,
): Promise<GraderResult> {
  const resolved = resolveCitations(wikitext, vaultPath);

  if (resolved.length === 0) {
    return {
      grader: 'accuracy',
      score: 0,
      details: [{ check: 'No citations found to verify', passed: false, penalty: 1 }],
    };
  }

  const resolvedWithData = resolved.filter((r) => r.resolved && r.sourceExcerpt);
  const unresolved = resolved.filter((r) => !r.resolved);

  if (resolvedWithData.length === 0) {
    return {
      grader: 'accuracy',
      score: 0,
      details: [
        ...unresolved.map((r) => ({
          check: `Unresolved citation: ${r.raw.slice(0, 80)}`,
          passed: false,
          penalty: 1 / resolved.length,
          note: r.error,
        })),
      ],
    };
  }

  // Step 1: Extract claims from wikitext (no source data)
  let extractedClaims: { text: string; type: string }[];
  try {
    const extraction = await extractClaimsOnly(wikitext);
    extractedClaims = extraction.claims;
  } catch (err) {
    return {
      grader: 'accuracy',
      score: 0,
      details: [{
        check: 'Claim extraction failed',
        passed: false,
        penalty: 1,
        note: err instanceof Error ? err.message : String(err),
      }],
    };
  }

  if (extractedClaims.length === 0) {
    const resolutionScore = resolvedWithData.length / resolved.length;
    return {
      grader: 'accuracy',
      score: Math.round(resolutionScore * 1000) / 1000,
      details: [
        { check: 'No factual claims extracted', passed: true, penalty: 0 },
        ...unresolved.map((r) => ({
          check: `Unresolved citation: ${r.raw.slice(0, 80)}`,
          passed: false,
          penalty: 0,
          note: r.error,
        })),
      ],
    };
  }

  // Step 2: Combine all resolved source excerpts into one evidence string
  const seen = new Set<string>();
  const excerpts: string[] = [];
  for (const r of resolvedWithData) {
    if (!seen.has(r.sourceExcerpt)) {
      seen.add(r.sourceExcerpt);
      excerpts.push(r.sourceExcerpt);
    }
  }
  const combinedEvidence = excerpts.join('\n\n---\n\n');

  // Step 3: Validate claims against combined evidence (same path as manifest)
  const details: { check: string; passed: boolean; penalty: number; note?: string }[] = [];
  let correct = 0;
  let total = 0;

  const BATCH_SIZE = 15;
  for (let i = 0; i < extractedClaims.length; i += BATCH_SIZE) {
    const batch = extractedClaims.slice(i, i + BATCH_SIZE);
    const pairs = batch.map((c) => ({ claim: c.text, evidence: combinedEvidence }));

    try {
      const validation = await validateClaimBatch(pairs);
      for (const result of validation.results) {
        const isFabricated = result.verdict === 'fabricated';
        const isSupported = result.verdict === 'supported';

        if (isFabricated) {
          total += 2;
        } else {
          total += 1;
        }

        if (isSupported) {
          correct += 1;
        }

        details.push({
          check: result.claim,
          passed: isSupported,
          penalty: isFabricated ? 2 / extractedClaims.length : isSupported ? 0 : 1 / extractedClaims.length,
          note: `${result.verdict}${result.reason ? `: ${result.reason}` : ''}`,
        });
      }
    } catch (err) {
      for (const pair of pairs) {
        total += 1;
        details.push({
          check: pair.claim,
          passed: false,
          penalty: 1 / extractedClaims.length,
          note: `validation error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  // Add unresolved citation penalties
  for (const r of unresolved) {
    details.push({
      check: `Unresolved citation: ${r.raw.slice(0, 80)}`,
      passed: false,
      penalty: 1 / resolved.length,
      note: r.error,
    });
    total += 1;
  }

  const score = total > 0 ? Math.max(0, correct / total) : 1.0;

  return {
    grader: 'accuracy',
    score: Math.round(score * 1000) / 1000,
    details,
  };
}

async function gradeAccuracyViaBlob(
  wikitext: string,
  sourceData: string,
): Promise<GraderResult> {
  const extraction = await extractClaims(wikitext, sourceData);
  const claims = extraction.claims;

  if (claims.length === 0) {
    return {
      grader: 'accuracy',
      score: 1.0,
      details: [{ check: 'No factual claims found', passed: true, penalty: 0 }],
    };
  }

  let correct = 0;
  let total = 0;

  const details = claims.map((claim) => {
    const isSupported = claim.source === 'supported';
    const isFabricated = claim.source === 'fabricated';

    // Fabricated claims count as double penalties
    if (isFabricated) {
      total += 2;
    } else {
      total += 1;
    }

    if (isSupported) {
      correct += 1;
    }

    return {
      check: `${claim.type}: ${claim.text}`,
      passed: isSupported,
      penalty: isFabricated ? 2 / claims.length : isSupported ? 0 : 1 / claims.length,
      note: claim.source,
    };
  });

  const score = total > 0 ? Math.max(0, correct / total) : 1.0;

  return {
    grader: 'accuracy',
    score: Math.round(score * 1000) / 1000,
    details,
  };
}
