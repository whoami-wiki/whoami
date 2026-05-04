'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';

interface SearchHit {
  slug: string;
  title: string;
  type: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [resultsFor, setResultsFor] = useState<{ q: string; hits: SearchHit[] }>({ q: '', hits: [] });
  const trimmed = q.trim();
  const displayResults = resultsFor.q === trimmed ? resultsFor.hits : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!trimmed) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=10`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { results: SearchHit[] };
        setResultsFor({ q: trimmed, hits: data.results ?? [] });
      } catch {
        // ignore abort/network
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [trimmed]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQ('');
      setResultsFor({ q: '', hits: [] });
    }
  }

  function go(slug: string) {
    handleOpenChange(false);
    router.push(`/${slug}`);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
        aria-label="Open search"
      >
        <Search data-icon="inline-start" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search people, companies, places…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            {!trimmed ? (
              <CommandEmpty>Start typing to search.</CommandEmpty>
            ) : displayResults.length === 0 ? (
              <CommandEmpty>No matches.</CommandEmpty>
            ) : null}
            {displayResults.length > 0 ? (
              <CommandGroup heading="Results">
                {displayResults.map(r => (
                  <CommandItem
                    key={r.slug}
                    value={`${r.title} ${r.slug}`}
                    onSelect={() => go(r.slug)}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{r.title}</span>
                      <span className="text-xs capitalize text-muted-foreground">{r.type}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
