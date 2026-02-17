"use client";

import cn from "classnames";
import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { MenuIcon, CloseIcon } from "@/components/icons";
import { motion, AnimatePresence } from "motion/react";
import { DISCORD_INVITE_LINK, GITHUB_REPO_LINK } from "@/utils/constants";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" },
  { label: "Changelog", href: "/changelog" },
];

const externalItems = [
  { label: "Discord", href: DISCORD_INVITE_LINK },
  { label: "GitHub", href: GITHUB_REPO_LINK },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "size-4.5 rounded-full cursor-pointer active:scale-95 focus:outline-3",
        {
          "bg-amber-500 focus:outline-amber-500/50":
            mounted && resolvedTheme === "light",
          "bg-purple-300 focus:outline-purple-300/50":
            mounted && resolvedTheme === "dark",
        },
      )}
      aria-label="Toggle theme"
    />
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <>
      <nav className="navbar font-sans px-6 py-6 flex flex-row items-center justify-between max-w-360 mx-auto w-full">
        <div className="flex flex-row gap-4 text-sm">
          {navItems.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                {
                  "text-muted":
                    href === "/"
                      ? pathname !== href
                      : !pathname.startsWith(href),
                },
                href !== "/" && "hidden md:inline",
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex flex-row items-center gap-4 text-sm">
          {externalItems.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              target="_blank"
              className="text-muted"
            >
              {label}
            </Link>
          ))}
          <ThemeToggle />
        </div>

        <button
          onClick={() => setOpen(true)}
          className="md:hidden cursor-pointer"
          aria-label="Open menu"
        >
          <MenuIcon className="size-5" />
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden" onClick={close}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300,
                mass: 0.8,
              }}
              className="absolute right-0 top-0 bottom-0 w-56 bg-background border-l border-primary flex flex-col p-6 gap-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end">
                <button
                  onClick={close}
                  className="text-muted cursor-pointer"
                  aria-label="Close menu"
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4 font-sans text-sm">
                {navItems.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn({
                      "text-muted":
                        href === "/"
                          ? pathname !== href
                          : !pathname.startsWith(href),
                    })}
                    onClick={close}
                  >
                    {label}
                  </Link>
                ))}
                {externalItems.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    target="_blank"
                    className="text-muted"
                    onClick={close}
                  >
                    {label}
                  </Link>
                ))}
              </div>

              <div className="mt-auto">
                <ThemeToggle />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
