import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import yaml from 'js-yaml';

/**
 * The infobox body is a YAML block emitted by the wikitext converter
 * (Plan B). Children come through as a parsed React tree, but for the
 * structured key/value display we re-parse the underlying text.
 */
interface Props {
  fields?: Record<string, string>;
  children?: ReactNode;
}

export function InfoboxCompany({ fields, children }: Props) {
  const parsed = fields ?? extractFieldsFromChildren(children);
  return (
    <Card className="float-right ml-4 max-w-xs my-2 text-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{parsed.name ?? 'Company'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {Object.entries(parsed)
          .filter(([k]) => k !== 'name')
          .map(([k, v]) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}:</span> {v}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function extractFieldsFromChildren(children: ReactNode): Record<string, string> {
  const text = childrenToText(children).trim();
  try {
    const parsed = yaml.load(text);
    if (parsed && typeof parsed === 'object') {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
      );
    }
  } catch { /* ignore */ }
  return {};
}

function childrenToText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childrenToText).join('\n');
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: ReactNode }>).props;
    return childrenToText(props.children ?? null);
  }
  return '';
}
