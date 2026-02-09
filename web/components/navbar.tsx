"use client";

import cn from "classnames";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Install", href: "/install" },
  { label: "Story", href: "/story" },
  { label: "Changelog", href: "/changelog" },
];

export function Navbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  return (
    <nav className="navbar font-sans p-2 flex flex-row items-center justify-between">
      <div className="flex flex-row gap-4 text-sm">
        {navItems.map(({ label, href }) => (
          <div
            key={href}
            className={cn({ "text-neutral-500": pathname !== href })}
          >
            {label}
          </div>
        ))}
      </div>

      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className={cn("size-4.5 shrink-0 rounded-full cursor-pointer", {
          "bg-indigo-400": mounted && resolvedTheme === "light",
          "bg-amber-500": mounted && resolvedTheme === "dark",
        })}
        aria-label="Toggle theme"
      />
    </nav>
  );
}
