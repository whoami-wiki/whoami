import { parseInfoboxArgs } from './infobox-person.ts';

const INFOBOX_COMPANY_RE = /\{\{Infobox company\s*((?:\|[^{}]*?)+)\}\}/gs;

export function transformInfoboxCompany(text: string): string {
  return text.replace(INFOBOX_COMPANY_RE, (_match, args: string) => {
    return `:::infobox-company\n${parseInfoboxArgs(args)}\n:::`;
  });
}
