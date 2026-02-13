"use client";

import cn from "classnames";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";

const columns = [
  {
    heading: "Product",
    links: [
      { label: "Home", href: "/" },
      { label: "Install", href: "/install" },
      { label: "Docs", href: "/docs" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "Resources",
    links: [{ label: "GitHub", href: "https://github.com/whoami-wiki/whoami" }],
  },
  {
    heading: "Legal",
    links: [
      {
        label: "MIT License",
        href: "https://github.com/whoami-wiki/whoami/blob/main/LICENSE.md",
      },
    ],
  },
];

export function Footer() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <footer className="font-sans text-sm border-t border-neutral-200 dark:border-neutral-700 px-6 pt-6 pb-6">
      <div className="flex flex-col gap-10 max-w-[1440px] mx-auto w-full">
        <div className="grid grid-cols-3 gap-8">
          {columns.map((col) => (
            <div key={col.heading} className="flex flex-col gap-3">
              <div className="text-muted">
                {col.heading}
              </div>
              {col.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-neutral-200 dark:border-neutral-700 text-muted">
          <span>Made in San Francisco, California</span>
          <button
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className={cn("size-4.5 shrink-0 rounded-full cursor-pointer", {
              "bg-indigo-400": mounted && resolvedTheme === "light",
              "bg-amber-500": mounted && resolvedTheme === "dark",
            })}
            aria-label="Toggle theme"
          />
        </div>
      </div>
    </footer>
  );
}
