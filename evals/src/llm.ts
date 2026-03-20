import { execFileSync } from 'node:child_process';

export interface ClaimExtraction {
  claims: { text: string; type: 'date' | 'location' | 'name' | 'fact'; source?: string }[];
}

export interface RubricEvaluation {
  deductions: { category: string; description: string; penalty: number }[];
  notes: string[];
}

export interface CrossRefExtraction {
  crossRefs: { fact: string; sourceTypes: string[] }[];
}

function askClaude(prompt: string): string {
  return execFileSync('claude', ['-p', '-', '--output-format', 'text'], {
    input: prompt,
    encoding: 'utf-8',
  });
}

function parseJson<T>(raw: string): T {
  // Strip markdown code fences if present
  let text = raw.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();

  // Extract the first JSON object if there's extra text around it
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  return JSON.parse(text) as T;
}

export async function extractClaims(
  wikitext: string,
  sourceData: string,
): Promise<ClaimExtraction> {
  const prompt = `Extract all factual claims from this wikitext page. For each claim, identify its type (date, location, name, or fact) and check whether it is supported by the source data provided.

Return a JSON object with this exact structure:
{
  "claims": [
    { "text": "claim text", "type": "date|location|name|fact", "source": "supported|unsupported|fabricated" }
  ]
}

A claim is "supported" if the source data contains evidence for it.
A claim is "unsupported" if the source data doesn't mention it but it could be true.
A claim is "fabricated" if the source data contradicts it.

WIKITEXT:
${wikitext}

SOURCE DATA:
${sourceData}

Return only the JSON object, no other text.`;

  const text = askClaude(prompt);
  return parseJson<ClaimExtraction>(text);
}

export interface ClaimOnlyExtraction {
  claims: { text: string; type: 'date' | 'location' | 'name' | 'fact' }[];
}

export async function extractClaimsOnly(
  wikitext: string,
): Promise<ClaimOnlyExtraction> {
  const prompt = `Extract all concrete, verifiable factual claims from this wikitext page. Focus on specific dates, names, quantities, locations, and events — not opinions or vague statements.

Return a JSON object with this exact structure:
{
  "claims": [
    { "text": "claim text", "type": "date|location|name|fact" }
  ]
}

WIKITEXT:
${wikitext}

Return only the JSON object, no other text.`;

  const text = askClaude(prompt);
  return parseJson<ClaimOnlyExtraction>(text);
}

export async function evaluateWithRubric(
  wikitext: string,
  rubric: string,
): Promise<RubricEvaluation> {
  const prompt = `Evaluate this wikitext page against the following rubric. Identify specific deductions.

Return a JSON object with this exact structure:
{
  "deductions": [
    { "category": "category name from rubric", "description": "what's wrong", "penalty": 0.1 }
  ],
  "notes": ["any general observations"]
}

Follow the deduction amounts specified in the rubric below.

RUBRIC:
${rubric}

WIKITEXT:
${wikitext}

Return only the JSON object, no other text.`;

  const text = askClaude(prompt);
  return parseJson<RubricEvaluation>(text);
}

export interface ClaimValidation {
  results: { claim: string; verdict: 'supported' | 'unsupported' | 'fabricated'; reason?: string }[];
}

export async function validateClaimBatch(
  pairs: { claim: string; evidence: string }[],
): Promise<ClaimValidation> {
  const pairList = pairs
    .map((p, i) => `${i + 1}. Claim: ${p.claim}\n   Evidence: ${p.evidence}`)
    .join('\n\n');

  const prompt = `You are a fact-checker. For each (claim, evidence) pair below, determine whether the evidence supports the claim.

Return a JSON object with this exact structure:
{
  "results": [
    { "claim": "claim text", "verdict": "supported|unsupported|fabricated", "reason": "brief explanation" }
  ]
}

Verdicts:
- "supported" — the evidence directly supports or is consistent with the claim
- "unsupported" — the evidence doesn't mention or address the claim, OR the discrepancy is plausibly a timezone conversion error (e.g. times differ by exactly 1-6 hours matching common UTC offsets like UTC-5, UTC-6, UTC+1)
- "fabricated" — the evidence directly contradicts the claim in a way that cannot be explained by timezone conversion (wrong names, wrong locations, wrong dates by more than 1 day, completely invented events)

Important: Source data often mixes timezone representations (UTC, local time, device timezone). If a claimed time differs from the evidence by an offset consistent with a timezone conversion error, classify it as "unsupported" rather than "fabricated".

CLAIM-EVIDENCE PAIRS:
${pairList}

Return only the JSON object, no other text.`;

  const text = askClaude(prompt);
  return parseJson<ClaimValidation>(text);
}

export async function extractCrossRefs(
  wikitext: string,
  sourceTypes: string[],
): Promise<CrossRefExtraction> {
  const prompt = `Analyze this wikitext page and identify facts that combine information from multiple data source types.

The available source types are: ${sourceTypes.join(', ')}

A cross-referenced fact is one where the page makes a claim that requires information from two or more distinct source types. For example, identifying a restaurant from a bank transaction cross-referenced with a GPS coordinate and a photo timestamp.

Return a JSON object with this exact structure:
{
  "crossRefs": [
    { "fact": "description of cross-referenced fact", "sourceTypes": ["type1", "type2"] }
  ]
}

WIKITEXT:
${wikitext}

Return only the JSON object, no other text.`;

  const text = askClaude(prompt);
  return parseJson<CrossRefExtraction>(text);
}
