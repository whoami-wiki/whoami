const TABLE_RE = /\{\|([\s\S]*?)\n\|\}/g;

export function transformTables(text: string): string {
  return text.replace(TABLE_RE, (_match, body: string) => {
    if (hasMergedCells(body)) {
      return tableToHtml(body);
    }
    return tableToMarkdown(body);
  });
}

function hasMergedCells(body: string): boolean {
  return /\b(rowspan|colspan)\s*=/.test(body);
}

function tableToMarkdown(body: string): string {
  // Strip class="wikitable" and similar attributes from the first line
  const lines = body.split('\n').slice(1);   // drop the initial 'class="..."' line
  const rows: string[][] = [];
  let header: string[] | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('!')) {
      header = splitCells(line.slice(1), '!!');
      continue;
    }
    if (line === '|-') {
      rows.push([]);
      continue;
    }
    if (line.startsWith('|')) {
      const cells = splitCells(line.slice(1), '||');
      if (rows.length === 0) rows.push([]);
      rows[rows.length - 1]!.push(...cells);
      continue;
    }
  }

  const allRows = header ? [header, ...rows.filter(r => r.length)] : rows.filter(r => r.length);
  return formatMarkdownTable(allRows);
}

function splitCells(line: string, sep: string): string[] {
  return line.split(sep).map(s => s.trim());
}

function formatMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return '';
  const widths = rows[0]!.map((_, i) =>
    Math.max(...rows.map(r => (r[i] ?? '').length))
  );
  const fmt = (cells: string[]) =>
    '| ' + cells.map((c, i) => (c ?? '').padEnd(widths[i]!)).join(' | ') + ' |';
  const sep = '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';
  return [fmt(rows[0]!), sep, ...rows.slice(1).map(fmt)].join('\n');
}

function tableToHtml(body: string): string {
  // For complex tables, emit a faithful HTML translation. We don't need
  // perfection — the renderer's sanitizer will pass through td/th/tr/table.
  const lines = body.split('\n').slice(1);
  let html = '<table>\n';
  let inRow = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('!')) {
      if (!inRow) { html += '  <tr>\n'; inRow = true; }
      const cells = line.slice(1).split('!!').map(s => s.trim());
      for (const c of cells) html += `    <th>${c}</th>\n`;
      continue;
    }
    if (line === '|-') {
      if (inRow) { html += '  </tr>\n'; inRow = false; }
      continue;
    }
    if (line.startsWith('|')) {
      if (!inRow) { html += '  <tr>\n'; inRow = true; }
      const cells = line.slice(1).split('||').map(s => s.trim());
      for (const c of cells) {
        // Detect attributes: `rowspan=2 | content`
        const attrMatch = /^([a-z]+\s*=\s*[^|]+(?:\s+[a-z]+\s*=\s*[^|]+)*)\s*\|\s*(.*)$/.exec(c);
        if (attrMatch) {
          const attrs = attrMatch[1]!.replace(/=([^"\s]+)/g, '="$1"');
          html += `    <td ${attrs}>${attrMatch[2]}</td>\n`;
        } else {
          html += `    <td>${c}</td>\n`;
        }
      }
      continue;
    }
  }
  if (inRow) html += '  </tr>\n';
  html += '</table>';
  return html;
}
