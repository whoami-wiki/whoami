"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import cn from "classnames";
import type { DocHeading } from "@/lib/docs";

export function SidebarHeadingTracker({
  headings,
  href,
}: {
  headings: DocHeading[];
  href: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  return (
    <div className="flex flex-col gap-1 ml-3 border-l border-neutral-200 dark:border-neutral-700 pl-3 mb-2">
      {headings.map((heading) => (
        <Link
          key={heading.id}
          href={`${href}#${heading.id}`}
          onClick={(e) => {
            const el = document.getElementById(heading.id);
            if (el) {
              e.preventDefault();
              el.scrollIntoView({ behavior: "smooth" });
              window.history.replaceState(null, "", `${href}#${heading.id}`);
            }
          }}
          className={cn(
            "py-0.5 text-sm transition-colors",
            activeId === heading.id
              ? "text-neutral-900 dark:text-neutral-100"
              : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
          )}
        >
          {heading.title}
        </Link>
      ))}
    </div>
  );
}
