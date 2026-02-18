"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { CloseIcon } from "@/components/icons";
import { DocsSidebar } from "@/components/docs-sidebar";
import type { SidebarSection } from "@/lib/docs-sidebar-config";

export function DocsMobileNav({ sections }: { sections: SidebarSection[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const activeItem = sections
    .flatMap((s) => s.items)
    .find((item) => pathname === `/docs/${item.slug}`);

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
      <button
        onClick={() => setOpen(true)}
        className="md:hidden sticky top-0 z-30 flex flex-row items-center gap-2 w-full bg-background border-b border-muted px-6 py-3 cursor-pointer"
      >
        <svg
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-4 text-muted"
        >
          <path d="M21 8a1 1 0 0 0-1-1H4a1 1 0 0 0 0 2h16a1 1 0 0 0 1-1Zm0 8a1 1 0 0 0-1-1H10a1 1 0 1 0 0 2h10a1 1 0 0 0 1-1Z" />
        </svg>
        <span className="font-sans text-sm text-muted">
          {activeItem?.title ?? "Menu"}
        </span>
      </button>

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
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300,
                mass: 0.8,
              }}
              className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r border-primary flex flex-col p-6 gap-6 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-row items-center justify-between">
                <span className="font-sans text-sm font-medium text-primary">
                  Documentation
                </span>
                <button
                  onClick={close}
                  className="text-muted cursor-pointer"
                  aria-label="Close menu"
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>

              <DocsSidebar sections={sections} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
