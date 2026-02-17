"use client";

import cn from "classnames";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sidebarConfig } from "@/lib/docs-sidebar-config";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-56 shrink-0 font-sans text-sm">
      <div className="flex flex-col gap-6">
        {sidebarConfig.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <div className="font-medium text-primary text-sm mb-1">
              {section.title}
            </div>
            {section.items.map((item) => {
              const href = `/docs/${item.slug}`;
              const isActive = pathname === href;

              return (
                <Link
                  key={item.slug}
                  href={href}
                  className={cn(
                    "py-1 text-sm",
                    isActive
                      ? "text-neutral-900 dark:text-neutral-100 font-medium"
                      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
