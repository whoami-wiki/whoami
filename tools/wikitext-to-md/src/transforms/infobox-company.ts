import { transformInfoboxPerson } from './infobox-person.ts';

const INFOBOX_COMPANY_RE = /\{\{Infobox company\s*((?:\|[^{}]*?)+)\}\}/gs;

// Reuse the person parser by aliasing the directive name.
export function transformInfoboxCompany(text: string): string {
  return text.replace(INFOBOX_COMPANY_RE, (whole) => {
    const replaced = whole.replace(/Infobox company/, 'Infobox person');
    return transformInfoboxPerson(replaced).replace(/^:::infobox-person/m, ':::infobox-company');
  });
}
