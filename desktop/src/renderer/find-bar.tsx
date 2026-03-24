import { useState, useEffect, useRef, useCallback } from "react";

export function FindBar({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ activeMatchOrdinal: number; matches: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    window.navbar.onFindResult(setResult);
  }, []);

  useEffect(() => {
    if (query) {
      window.navbar.findInPage(query);
    } else {
      window.navbar.stopFindInPage();
      setResult(null);
    }
  }, [query]);

  const next = useCallback(() => {
    if (query) window.navbar.findInPage(query, { findNext: true, forward: true });
  }, [query]);

  const prev = useCallback(() => {
    if (query) window.navbar.findInPage(query, { findNext: true, forward: false });
  }, [query]);

  const close = useCallback(() => {
    window.navbar.stopFindInPage();
    onClose();
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter" && e.shiftKey) {
      prev();
    } else if (e.key === "Enter") {
      next();
    }
  };

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in page"
        className="no-drag flex-1 min-w-0 text-[13px] px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
      />
      {result && query && (
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
          {result.matches > 0
            ? `${result.activeMatchOrdinal}/${result.matches}`
            : "0/0"}
        </span>
      )}
      <button onClick={prev} title="Previous (Shift+Enter)" className="no-drag p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-pointer">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10l4-4 4 4"/></svg>
      </button>
      <button onClick={next} title="Next (Enter)" className="no-drag p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-pointer">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6l4 4 4-4"/></svg>
      </button>
      <button onClick={close} title="Close (Esc)" className="no-drag p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-pointer">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
      </button>
    </div>
  );
}
