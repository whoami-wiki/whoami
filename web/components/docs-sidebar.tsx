"use client";

import cn from "classnames";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SidebarSection } from "@/lib/docs-sidebar-config";

export function DocsSidebar({ sections }: { sections: SidebarSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="w-56 shrink-0 font-sans text-sm">
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <div className="font-medium text-primary text-sm mb-1">
              {section.title}
            </div>
            {section.items.map((item) => {
              const href = `/docs/${item.slug}`;
              const isActive = pathname === href;

              return (
                <div key={item.slug} className="flex flex-col">
                  <Link
                    href={href}
                    className={cn(
                      "py-1 text-sm",
                      isActive
                        ? "text-neutral-900 dark:text-neutral-100 font-medium"
                        : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300",
                    )}
                  >
                    {item.title}
                  </Link>
                  {isActive && item.headings.length > 0 && (
                    <div className="flex flex-col gap-1 ml-3 border-l border-neutral-200 dark:border-neutral-700 pl-3">
                      {item.headings.map((heading) => (
                        <Link
                          key={heading.id}
                          href={`${href}#${heading.id}`}
                          className="py-0.5 text-sm text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
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
