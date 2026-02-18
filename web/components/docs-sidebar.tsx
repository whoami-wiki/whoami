"use client";

import cn from "classnames";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { SidebarSection } from "@/lib/docs-sidebar-config";

function useActiveHeading(headingIds: string[]) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headingIds.length === 0) return;

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

    for (const id of headingIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headingIds]);

  return activeId;
}

export function DocsSidebar({ sections }: { sections: SidebarSection[] }) {
  const pathname = usePathname();

  const activeItem = sections
    .flatMap((s) => s.items)
    .find((item) => pathname === `/docs/${item.slug}`);
  const headingIds = activeItem?.headings.map((h) => h.id) ?? [];
  const activeHeadingId = useActiveHeading(headingIds);

  return (
    <nav className="w-56 shrink-0 font-sans text-sm">
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <div className="text-primary text-sm mb-1">{section.title}</div>

            {section.items.map((item) => {
              const href = `/docs/${item.slug}`;
              const isActive = pathname === href;

              return (
                <div key={item.slug} className="flex flex-col gap-2">
                  <Link
                    href={href}
                    className={cn(
                      "py-1 text-sm pl-3",
                      isActive
                        ? "text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300",
                    )}
                  >
                    {item.title}
                  </Link>

                  {isActive && item.headings.length > 0 && (
                    <div className="flex flex-col gap-1 ml-3 border-l border-neutral-200 dark:border-neutral-700 pl-3 mb-2">
                      {item.headings.map((heading) => (
                        <Link
                          key={heading.id}
                          href={`${href}#${heading.id}`}
                          onClick={(e) => {
                            const el = document.getElementById(heading.id);
                            if (el) {
                              e.preventDefault();
                              el.scrollIntoView({ behavior: "smooth" });
                              window.history.replaceState(
                                null,
                                "",
                                `${href}#${heading.id}`,
                              );
                            }
                          }}
                          className={cn(
                            "py-0.5 text-sm transition-colors",
                            activeHeadingId === heading.id
                              ? "text-neutral-900 dark:text-neutral-100"
                              : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
                          )}
                        >
                          {heading.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
