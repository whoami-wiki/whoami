const COLUMNS_LIST_RE = /\{\{Columns-list\|(\d+)\|([\s\S]*?)\}\}/g;

export function transformColumnsList(text: string): string {
  return text.replace(COLUMNS_LIST_RE, (_match, cols: string, body: string) => {
    return `:::columns-list{cols="${cols}"}\n${body.trim()}\n:::`;
  });
}
