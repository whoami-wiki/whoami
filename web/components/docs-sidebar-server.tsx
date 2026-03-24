import cn from "classnames";
import Link from "next/link";
import type { SidebarSection } from "@/lib/docs-sidebar-config";
import { SidebarHeadingTracker } from "./sidebar-heading-tracker";

export function DocsSidebarServer({
  sections,
  activeSlug,
}: {
  sections: SidebarSection[];
  activeSlug: string;
}) {
  return (
    <nav className="w-56 shrink-0 font-sans text-sm max-h-[calc(100dvh-5rem)] overflow-y-auto">
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <div className="text-primary text-sm mb-1">{section.title}</div>

            {section.items.map((item) => {
              const href = `/docs/${item.slug}`;
              const isActive = item.slug === activeSlug;

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
                    <SidebarHeadingTracker
                      headings={item.headings}
                      href={href}
                    />
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
