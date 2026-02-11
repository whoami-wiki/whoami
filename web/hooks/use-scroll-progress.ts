"use client";

import { useEffect, useState, type RefObject } from "react";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ticking = false;

    function update() {
      const rect = el!.getBoundingClientRect();
      const sectionHeight = el!.offsetHeight;
      const viewportHeight = window.innerHeight;
      const p = clamp(-rect.top / (sectionHeight - viewportHeight), 0, 1);
      setProgress(p);
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => window.removeEventListener("scroll", onScroll);
  }, [ref]);

  return progress;
}
