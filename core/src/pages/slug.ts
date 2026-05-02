const SLUG_RE = /^[a-z0-9][a-z0-9-]*(\.talk)?$/;

export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

export function assertValidSlug(s: string): string {
  if (!isValidSlug(s)) {
    throw new Error(`invalid slug: ${JSON.stringify(s)}`);
  }
  return s;
}
