const CATEGORY_RE = /\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/g;

export function extractCategories(text: string): { body: string; categories: string[] } {
  const categories: string[] = [];
  const body = text.replace(CATEGORY_RE, (_match, name) => {
    categories.push(String(name).trim());
    return '';
  });
  // Collapse consecutive blank lines left behind by removed categories
  return { body: body.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', categories };
}
