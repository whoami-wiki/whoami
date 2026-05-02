const GAP_BODY_RE = /\{\{Gap\|([^}]+)\}\}/g;
const GAP_EMPTY_RE = /\{\{Gap\}\}/g;

export function transformGap(text: string): string {
  return text
    .replace(GAP_BODY_RE, (_m, body: string) => `:::gap\n${body.trim()}\n:::`)
    .replace(GAP_EMPTY_RE, ':::gap:::');
}
