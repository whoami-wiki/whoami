import axios, { type AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import FormData from 'form-data';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { AuthError, NotFoundError, ConflictError, WaiError } from './errors.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface PageResult {
  title: string;
  revid: number;
  timestamp?: string;
  content: string;
}

export interface EditResult {
  title: string;
  oldRevid: number;
  newRevid: number;
  timestamp: string;
  noChange?: boolean;
}

export interface SearchResult {
  title: string;
  snippet: string;
  wordcount: number;
  size: number;
}

export interface Section {
  index: string;
  level: string;
  number: string;
  line: string;
}

export interface LinkResult {
  incoming: string[];
  outgoing: string[];
}

export interface ChangeEntry {
  title: string;
  timestamp: string;
  user: string;
  comment: string;
  type: string;
  oldlen: number;
  newlen: number;
}

export interface PlaceResult {
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  types: string[];
  open?: boolean;
  weekdayHours?: string[];
}

export interface UploadResult {
  filename: string;
  result: string;
}

// ── Client ─────────────────────────────────────────────────────────────

export class WikiClient {
  private client: AxiosInstance;
  private csrfToken?: string;
  private jar: CookieJar;

  constructor(private server: string) {
    this.jar = new CookieJar();
    const instance = axios.create({
      baseURL: server.replace(/\/$/, ''),
      withCredentials: true,
      timeout: 30_000,
    });
    this.client = wrapper(instance as any) as unknown as AxiosInstance;
    (this.client.defaults as any).jar = this.jar;
  }

  private get api() {
    return '/api.php';
  }

  // ── Auth ─────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<void> {
    // Step 1: get login token
    const tokenRes = await this.client.get(this.api, {
      params: { action: 'query', meta: 'tokens', type: 'login', format: 'json' },
    });
    const loginToken = tokenRes.data?.query?.tokens?.logintoken;
    if (!loginToken) throw new AuthError('Failed to get login token');

    // Step 2: login
    const loginRes = await this.client.post(
      this.api,
      new URLSearchParams({
        action: 'login',
        lgname: username,
        lgpassword: password,
        lgtoken: loginToken,
        format: 'json',
      }),
    );
    const result = loginRes.data?.login?.result;
    if (result !== 'Success') {
      throw new AuthError(`Login failed: ${loginRes.data?.login?.reason || result}`);
    }
  }

  private async getCSRFToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    const res = await this.client.get(this.api, {
      params: { action: 'query', meta: 'tokens', format: 'json' },
    });
    this.csrfToken = res.data?.query?.tokens?.csrftoken;
    if (!this.csrfToken) throw new AuthError('Failed to get CSRF token. Are you logged in?');
    return this.csrfToken;
  }

  // ── Pages ────────────────────────────────────────────────────────────

  async readPage(title: string, opts?: { section?: number }): Promise<PageResult> {
    const params: Record<string, string | number> = {
      action: 'parse',
      page: title,
      prop: 'wikitext|revid',
      format: 'json',
    };
    if (opts?.section !== undefined) params.section = opts.section;

    const res = await this.client.get(this.api, { params });
    if (res.data?.error) {
      const code = res.data.error.code;
      if (code === 'missingtitle') throw new NotFoundError(`Page not found: ${title}`);
      throw new WaiError(res.data.error.info, 1);
    }
    const parse = res.data.parse;
    return {
      title: parse.title,
      revid: parse.revid,
      content: parse.wikitext?.['*'] ?? '',
    };
  }

  async writePage(title: string, content: string, summary?: string): Promise<EditResult> {
    const token = await this.getCSRFToken();

    // Get current revid for conflict detection
    let oldRevid = 0;
    try {
      const current = await this.readPage(title);
      oldRevid = current.revid;
    } catch {
      // Page may not exist yet, that's fine
    }

    const params: Record<string, string> = {
      action: 'edit',
      title,
      text: content,
      token,
      format: 'json',
    };
    if (summary) params.summary = summary;

    const res = await this.client.post(this.api, new URLSearchParams(params));
    this.handleEditError(res.data);
    const edit = res.data.edit;
    const noChange = edit.nochange !== undefined;
    return {
      title: edit.title,
      oldRevid,
      newRevid: noChange ? oldRevid : (edit.newrevid ?? oldRevid),
      timestamp: edit.newtimestamp ?? '',
      noChange,
    };
  }

  async importPage(title: string, content: string, summary?: string): Promise<EditResult> {
    const token = await this.getCSRFToken();
    const params: Record<string, string> = {
      action: 'edit',
      title,
      text: content,
      bot: 'true',
      token,
      format: 'json',
    };
    if (summary) params.summary = summary;

    const res = await this.client.post(this.api, new URLSearchParams(params));
    this.handleEditError(res.data);
    const edit = res.data.edit;
    return {
      title: edit.title,
      oldRevid: 0,
      newRevid: edit.newrevid ?? edit.oldrevid,
      timestamp: edit.newtimestamp ?? '',
    };
  }

  async editPage(
    title: string,
    oldText: string,
    newText: string,
    opts?: { replaceAll?: boolean; summary?: string },
  ): Promise<EditResult> {
    const page = await this.readPage(title);
    let content = page.content;

    if (opts?.replaceAll) {
      if (!content.includes(oldText)) {
        throw new NotFoundError(`Text not found in "${title}"`);
      }
      content = content.replaceAll(oldText, newText);
    } else {
      const firstIdx = content.indexOf(oldText);
      if (firstIdx === -1) {
        throw new NotFoundError(`Text not found in "${title}"`);
      }
      const lastIdx = content.lastIndexOf(oldText);
      if (firstIdx !== lastIdx) {
        throw new ConflictError(
          `Multiple occurrences of text found in "${title}". Use --replace-all to replace all.`,
        );
      }
      content = content.slice(0, firstIdx) + newText + content.slice(firstIdx + oldText.length);
    }

    const token = await this.getCSRFToken();
    const params: Record<string, string> = {
      action: 'edit',
      title,
      text: content,
      token,
      format: 'json',
    };
    if (opts?.summary) params.summary = opts.summary;

    const res = await this.client.post(this.api, new URLSearchParams(params));
    this.handleEditError(res.data);
    const edit = res.data.edit;
    return {
      title: edit.title,
      oldRevid: page.revid,
      newRevid: edit.newrevid ?? edit.oldrevid,
      timestamp: edit.newtimestamp ?? '',
    };
  }

  async createPage(title: string, content: string, summary?: string): Promise<EditResult> {
    const token = await this.getCSRFToken();
    const params: Record<string, string> = {
      action: 'edit',
      title,
      text: content,
      createonly: 'true',
      token,
      format: 'json',
    };
    if (summary) params.summary = summary;

    const res = await this.client.post(this.api, new URLSearchParams(params));
    if (res.data?.error?.code === 'articleexists') {
      throw new ConflictError(`Page already exists: ${title}`);
    }
    this.handleEditError(res.data);
    const edit = res.data.edit;
    return {
      title: edit.title,
      oldRevid: 0,
      newRevid: edit.newrevid ?? 0,
      timestamp: edit.newtimestamp ?? '',
    };
  }

  async searchPages(query: string, limit = 10): Promise<SearchResult[]> {
    const res = await this.client.get(this.api, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: limit,
        srprop: 'snippet|wordcount|size',
        format: 'json',
      },
    });
    const results = res.data?.query?.search ?? [];
    return results.map((r: any) => ({
      title: r.title,
      snippet: stripHtml(r.snippet),
      wordcount: r.wordcount,
      size: r.size,
    }));
  }

  // ── Sections ─────────────────────────────────────────────────────────

  async listSections(title: string): Promise<Section[]> {
    const res = await this.client.get(this.api, {
      params: { action: 'parse', page: title, prop: 'sections', format: 'json' },
    });
    if (res.data?.error) {
      if (res.data.error.code === 'missingtitle') throw new NotFoundError(`Page not found: ${title}`);
      throw new WaiError(res.data.error.info, 1);
    }
    return (res.data.parse.sections ?? []).map((s: any) => ({
      index: s.index,
      level: s.level,
      number: s.number,
      line: s.line,
    }));
  }

  async readSection(title: string, section: string | number): Promise<PageResult> {
    const idx = await this.resolveSectionIndex(title, section);
    return this.readPage(title, { section: idx });
  }

  async updateSection(
    title: string,
    section: string | number,
    content: string,
    summary?: string,
  ): Promise<EditResult> {
    const idx = await this.resolveSectionIndex(title, section);
    const token = await this.getCSRFToken();

    // Get current revid
    let oldRevid = 0;
    try {
      const current = await this.readPage(title);
      oldRevid = current.revid;
    } catch {
      // ignore
    }

    const params: Record<string, string | number> = {
      action: 'edit',
      title,
      section: idx,
      text: content,
      token,
      format: 'json',
    };
    if (summary) params.summary = summary;

    const res = await this.client.post(
      this.api,
      new URLSearchParams(params as Record<string, string>),
    );
    this.handleEditError(res.data);
    const edit = res.data.edit;
    return {
      title: edit.title,
      oldRevid,
      newRevid: edit.newrevid ?? edit.oldrevid,
      timestamp: edit.newtimestamp ?? '',
    };
  }

  private async resolveSectionIndex(title: string, section: string | number): Promise<number> {
    if (typeof section === 'number') return section;
    const n = parseInt(section, 10);
    if (!isNaN(n)) return n;
    // Resolve by name
    const sections = await this.listSections(title);
    const match = sections.find((s) => s.line === section);
    if (!match) throw new NotFoundError(`Section "${section}" not found in "${title}"`);
    return parseInt(match.index, 10);
  }

  // ── Talk Pages ───────────────────────────────────────────────────────

  async readTalkPage(page: string, thread?: string): Promise<PageResult> {
    const talkTitle = page.startsWith('Talk:') ? page : `Talk:${page}`;

    if (thread) {
      // Find the section matching the thread name
      const sections = await this.listSections(talkTitle);
      const match = sections.find((s) => s.line === thread);
      if (!match) throw new NotFoundError(`Thread "${thread}" not found on ${talkTitle}`);
      return this.readPage(talkTitle, { section: parseInt(match.index, 10) });
    }

    return this.readPage(talkTitle);
  }

  async createTalkThread(
    page: string,
    subject: string,
    content: string,
    summary?: string,
  ): Promise<void> {
    const talkTitle = page.startsWith('Talk:') ? page : `Talk:${page}`;
    const token = await this.getCSRFToken();

    const params: Record<string, string> = {
      action: 'edit',
      title: talkTitle,
      section: 'new',
      sectiontitle: subject,
      text: content,
      token,
      format: 'json',
    };
    if (summary) params.summary = summary;

    const res = await this.client.post(this.api, new URLSearchParams(params));
    this.handleEditError(res.data);
  }

  // ── Upload ───────────────────────────────────────────────────────────

  async uploadFile(
    filePath: string,
    opts?: { filename?: string; description?: string; comment?: string },
  ): Promise<UploadResult> {
    const token = await this.getCSRFToken();
    const wikiFilename = opts?.filename || `File:${basename(filePath)}`;

    const form = new FormData();
    form.append('action', 'upload');
    form.append('filename', wikiFilename.replace(/^File:/, ''));
    form.append('token', token);
    form.append('format', 'json');
    form.append('file', createReadStream(filePath));
    if (opts?.description) form.append('text', opts.description);
    if (opts?.comment) form.append('comment', opts.comment);
    form.append('ignorewarnings', '1');

    const res = await this.client.post(this.api, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (res.data?.error) throw new WaiError(res.data.error.info, 1);
    const upload = res.data.upload;
    if (upload?.result !== 'Success' && upload?.result !== 'Warning') {
      throw new WaiError(`Upload failed: ${upload?.result || 'unknown error'}`, 1);
    }
    return {
      filename: upload.filename,
      result: upload.result,
    };
  }

  // ── Discovery ────────────────────────────────────────────────────────

  async getLinks(title: string, direction: 'in' | 'out' | 'both' = 'both'): Promise<LinkResult> {
    const result: LinkResult = { incoming: [], outgoing: [] };

    if (direction === 'out' || direction === 'both') {
      const res = await this.client.get(this.api, {
        params: {
          action: 'query',
          titles: title,
          prop: 'links',
          pllimit: 'max',
          format: 'json',
        },
      });
      const pages = res.data?.query?.pages ?? {};
      for (const page of Object.values(pages) as any[]) {
        result.outgoing = (page.links ?? []).map((l: any) => l.title);
      }
    }

    if (direction === 'in' || direction === 'both') {
      const res = await this.client.get(this.api, {
        params: {
          action: 'query',
          list: 'backlinks',
          bltitle: title,
          bllimit: 'max',
          format: 'json',
        },
      });
      result.incoming = (res.data?.query?.backlinks ?? []).map((l: any) => l.title);
    }

    return result;
  }

  async listCategories(category?: string): Promise<string[]> {
    if (category) {
      const catTitle = category.startsWith('Category:') ? category : `Category:${category}`;
      const res = await this.client.get(this.api, {
        params: {
          action: 'query',
          list: 'categorymembers',
          cmtitle: catTitle,
          cmlimit: 'max',
          format: 'json',
        },
      });
      return (res.data?.query?.categorymembers ?? []).map((m: any) => m.title);
    }

    const res = await this.client.get(this.api, {
      params: {
        action: 'query',
        list: 'allcategories',
        aclimit: 'max',
        format: 'json',
      },
    });
    return (res.data?.query?.allcategories ?? []).map((c: any) => c['*']);
  }

  async recentChanges(limit = 10): Promise<ChangeEntry[]> {
    const res = await this.client.get(this.api, {
      params: {
        action: 'query',
        list: 'recentchanges',
        rclimit: limit,
        rcprop: 'title|timestamp|user|comment|sizes',
        format: 'json',
      },
    });
    return (res.data?.query?.recentchanges ?? []).map((r: any) => ({
      title: r.title,
      timestamp: r.timestamp,
      user: r.user,
      comment: r.comment ?? '',
      type: r.type,
      oldlen: r.oldlen ?? 0,
      newlen: r.newlen ?? 0,
    }));
  }

  // ── Export ─────────────────────────────────────────────────────────

  async getNamespaces(): Promise<{ id: number; name: string }[]> {
    const res = await this.client.get(this.api, {
      params: { action: 'query', meta: 'siteinfo', siprop: 'namespaces', format: 'json' },
    });
    const ns = res.data?.query?.namespaces ?? {};
    return Object.values(ns)
      .filter((n: any) => n.id >= 0)
      .map((n: any) => ({ id: n.id, name: n['*'] ?? '' }));
  }

  async listAllPages(ns: number): Promise<string[]> {
    const titles: string[] = [];
    let apcontinue: string | undefined;
    do {
      const params: Record<string, string | number> = {
        action: 'query',
        list: 'allpages',
        apnamespace: ns,
        aplimit: 'max',
        format: 'json',
      };
      if (apcontinue) params.apcontinue = apcontinue;
      const res = await this.client.get(this.api, { params });
      const pages = res.data?.query?.allpages ?? [];
      titles.push(...pages.map((p: any) => p.title));
      apcontinue = res.data?.continue?.apcontinue;
    } while (apcontinue);
    return titles;
  }

  async exportPages(titles: string[]): Promise<string> {
    const res = await this.client.get(this.api, {
      params: {
        action: 'query',
        titles: titles.join('|'),
        export: 1,
        exportnowrap: 1,
      },
      responseType: 'text',
      transformResponse: [(data: any) => data],
    });
    return res.data;
  }

  // ── Places ───────────────────────────────────────────────────────────

  async lookupPlace(
    query: string,
    apiKey: string,
    maxResults = 5,
  ): Promise<PlaceResult[]> {
    const res = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      { textQuery: query, maxResultCount: Math.min(maxResults, 20) },
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.currentOpeningHours',
          'Content-Type': 'application/json',
        },
      },
    );
    return (res.data?.places ?? []).map((p: any) => ({
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? '',
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      types: p.types ?? [],
      open: p.currentOpeningHours?.openNow,
      weekdayHours: p.currentOpeningHours?.weekdayDescriptions,
    }));
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private handleEditError(data: any): void {
    if (data?.error) {
      const code = data.error.code;
      if (code === 'protectedpage' || code === 'noedit') {
        throw new AuthError(data.error.info);
      }
      throw new WaiError(data.error.info, 1);
    }
    if (data?.edit?.result !== 'Success') {
      throw new WaiError(`Edit failed: ${data?.edit?.result || 'unknown'}`, 1);
    }
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
