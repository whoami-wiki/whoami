"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ClaudeCodeMini } from "@/components/claude-code-mini";

function MenuBar() {
  return (
    <div className="absolute top-0 left-0 right-0 h-4 sm:h-5 bg-black/20 backdrop-blur-md flex items-center px-2 sm:px-3 gap-2 sm:gap-3 z-30">
      <div className="h-1.5 bg-white/70 rounded-full w-3" />
      <div className="h-1 bg-white/50 rounded-full w-6" />
      <div className="h-1 bg-white/40 rounded-full w-4" />
      <div className="h-1 bg-white/40 rounded-full w-5" />
      <div className="h-1 bg-white/40 rounded-full w-3" />
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <div className="h-1 bg-white/40 rounded-full w-3" />
        <div className="h-1 bg-white/40 rounded-full w-4" />
        <div className="h-1 bg-white/50 rounded-full w-8" />
      </div>
    </div>
  );
}

function Dock() {
  const icons = [
    "bg-blue-500 rounded-[22%]",
    "bg-orange-400 rounded-[22%]",
    "bg-green-500 rounded-[22%]",
    "bg-sky-500 rounded-[22%]",
    "bg-purple-500 rounded-[22%]",
    "bg-red-400 rounded-[22%]",
    "bg-yellow-400 rounded-[22%]",
    "bg-indigo-500 rounded-[22%]",
  ];
  return (
    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-end gap-0.5 sm:gap-1 px-0.5 sm:px-1 py-0.5 sm:py-1 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 z-30">
      {icons.map((cls, i) => (
        <div key={i} className={`w-2.5 h-2.5 sm:w-4 sm:h-4 ${cls}`} />
      ))}
    </div>
  );
}

function AppWindow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`absolute rounded-lg sm:rounded-xl overflow-hidden bg-white border border-neutral-300 flex flex-col ${className ?? ""}`}
    >
      <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 bg-neutral-100 border-b border-neutral-200 shrink-0">
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#ff5f57]" />
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#febc2e]" />
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#28c840]" />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Content components                                                 */
/* ------------------------------------------------------------------ */

function InstagramContent() {
  const gridColors = [
    "bg-pink-100",
    "bg-purple-50",
    "bg-indigo-100",
    "bg-blue-50",
    "bg-pink-50",
    "bg-purple-100",
    "bg-rose-50",
    "bg-indigo-50",
    "bg-pink-100",
  ];
  return (
    <div className="p-2 sm:p-3 flex flex-col gap-2">
      {/* Profile row */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 shrink-0" />
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-1.5 bg-neutral-300 rounded-full w-3/5" />
          <div className="h-1 bg-neutral-200 rounded-full w-2/5" />
        </div>
      </div>
      {/* Story highlights */}
      <div className="flex gap-2">
        {["bg-pink-100", "bg-purple-100", "bg-indigo-100", "bg-blue-100"].map((color, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full ${color}`} />
            <div className="h-0.5 bg-neutral-200 rounded-full w-4" />
          </div>
        ))}
      </div>
      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
        {gridColors.map((color, i) => (
          <div key={i} className={`aspect-square rounded-sm ${color}`} />
        ))}
      </div>
    </div>
  );
}

function WhatsAppContent() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-2 sm:px-3 py-1.5 bg-green-700/10 border-b border-neutral-200 flex items-center gap-2 shrink-0">
        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-neutral-300 shrink-0" />
        <div className="h-1.5 bg-neutral-300 rounded-full w-16" />
      </div>
      {/* Messages */}
      <div className="flex-1 p-2 sm:p-3 flex flex-col gap-1.5 justify-end bg-amber-50/30">
        <div className="self-start bg-white rounded-lg w-16 h-3" />
        <div className="self-end bg-green-100 rounded-lg w-12 h-3" />
        <div className="self-start bg-white rounded-lg w-20 h-4" />
        <div className="self-end bg-green-100 rounded-lg w-10 h-3" />
        <div className="self-start bg-white rounded-lg w-14 h-3" />
        <div className="self-end bg-green-100 rounded-lg w-16 h-4" />
      </div>
      {/* Input */}
      <div className="px-2 py-1.5 border-t border-neutral-200 shrink-0">
        <div className="h-4 bg-neutral-100 rounded-full" />
      </div>
    </div>
  );
}

function PhotosContent() {
  const gridColors = [
    "bg-amber-100",
    "bg-orange-50",
    "bg-rose-100",
    "bg-yellow-50",
    "bg-amber-50",
    "bg-orange-100",
    "bg-rose-50",
    "bg-yellow-100",
    "bg-amber-100",
    "bg-orange-50",
    "bg-rose-50",
    "bg-amber-50",
    "bg-orange-100",
    "bg-rose-100",
    "bg-yellow-50",
    "bg-amber-100",
    "bg-rose-50",
    "bg-orange-50",
    "bg-yellow-100",
    "bg-amber-50",
    "bg-rose-100",
    "bg-orange-100",
    "bg-amber-100",
    "bg-yellow-50",
  ];
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="hidden sm:flex w-[28%] shrink-0 bg-neutral-100/80 border-r border-neutral-200 flex-col py-2 px-2 gap-1">
        <div className="h-1.5 bg-neutral-300 rounded-full w-4/5" />
        <div className="h-1.5 bg-blue-400/60 rounded-full w-3/5" />
        <div className="h-1.5 bg-neutral-300 rounded-full w-2/3" />
        <div className="h-px bg-neutral-200 my-1" />
        <div className="h-1 bg-neutral-400 rounded-full w-1/2" />
        <div className="h-1.5 bg-neutral-300 rounded-full w-4/5" />
        <div className="h-1.5 bg-neutral-300 rounded-full w-3/5" />
        <div className="h-1.5 bg-neutral-300 rounded-full w-2/3" />
      </div>
      {/* Grid */}
      <div className="flex-1 p-1 sm:p-1.5">
        <div className="grid grid-cols-4 gap-0.5 sm:gap-1">
          {gridColors.map((color, i) => (
            <div key={i} className={`aspect-square rounded-sm ${color}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MapsContent() {
  const dots = [
    { x: 25, y: 20 },
    { x: 50, y: 30 },
    { x: 35, y: 50 },
    { x: 60, y: 40 },
    { x: 30, y: 65 },
    { x: 65, y: 60 },
    { x: 75, y: 25 },
    { x: 45, y: 75 },
  ];
  return (
    <div className="relative h-full bg-emerald-100/80">
      {/* Roads */}
      <div className="absolute top-[30%] left-0 right-0 h-[1px] bg-neutral-300/50" />
      <div className="absolute top-[55%] left-0 right-0 h-[1px] bg-neutral-300/50" />
      <div className="absolute top-[78%] left-0 right-0 h-[1px] bg-neutral-300/50" />
      <div className="absolute left-[30%] top-0 bottom-0 w-[1px] bg-neutral-300/50" />
      <div className="absolute left-[55%] top-0 bottom-0 w-[1px] bg-neutral-300/50" />
      <div className="absolute left-[78%] top-0 bottom-0 w-[1px] bg-neutral-300/50" />
      {/* Location dots */}
      {dots.map((d, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-500/50"
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
        />
      ))}
      {/* Pin */}
      <div
        className="absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-red-500 border-2 border-white"
        style={{ left: "46%", top: "42%" }}
      />
      {/* Search bar overlay */}
      <div className="absolute top-1 left-1 right-1 sm:top-1.5 sm:left-1.5 sm:right-1.5">
        <div className="h-4 sm:h-5 bg-white/90 backdrop-blur-sm rounded border border-neutral-200/50 flex items-center px-1.5">
          <div className="h-1 bg-neutral-300 rounded-full w-1/3" />
        </div>
      </div>
    </div>
  );
}

function SlackContent() {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-[30%] sm:w-[28%] shrink-0 bg-purple-900 p-2 sm:p-2.5 flex flex-col gap-1.5">
        <div className="h-1.5 bg-white/40 rounded-full w-3/4" />
        <div className="h-px bg-white/10 my-0.5" />
        <div className="h-1 bg-white/20 rounded-full w-4/5" />
        <div className="h-1 bg-white/50 rounded-full w-3/5" />
        <div className="h-1 bg-white/20 rounded-full w-2/3" />
        <div className="h-1 bg-white/20 rounded-full w-4/5" />
        <div className="h-1 bg-white/20 rounded-full w-1/2" />
        <div className="h-px bg-white/10 my-0.5" />
        <div className="h-1 bg-white/20 rounded-full w-3/5" />
        <div className="h-1 bg-white/20 rounded-full w-2/3" />
      </div>
      {/* Messages */}
      <div className="flex-1 flex flex-col">
        {/* Channel header */}
        <div className="px-2 sm:px-3 py-1.5 border-b border-neutral-100 shrink-0 flex items-center gap-1.5">
          <div className="h-1.5 bg-neutral-400 rounded-full w-16" />
        </div>
        <div className="flex-1 p-2 sm:p-3 flex flex-col gap-2.5">
          <div className="flex gap-1.5">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-blue-200 shrink-0" />
            <div className="flex flex-col gap-0.5 flex-1">
              <div className="h-1.5 bg-neutral-400 rounded-full w-1/3" />
              <div className="h-1 bg-neutral-200 rounded-full w-full" />
              <div className="h-1 bg-neutral-200 rounded-full w-3/4" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-green-200 shrink-0" />
            <div className="flex flex-col gap-0.5 flex-1">
              <div className="h-1.5 bg-neutral-400 rounded-full w-2/5" />
              <div className="h-1 bg-neutral-200 rounded-full w-full" />
              <div className="h-1 bg-neutral-200 rounded-full w-1/2" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-orange-200 shrink-0" />
            <div className="flex flex-col gap-0.5 flex-1">
              <div className="h-1.5 bg-neutral-400 rounded-full w-1/4" />
              <div className="h-1 bg-neutral-200 rounded-full w-4/5" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-purple-200 shrink-0" />
            <div className="flex flex-col gap-0.5 flex-1">
              <div className="h-1.5 bg-neutral-400 rounded-full w-1/3" />
              <div className="h-1 bg-neutral-200 rounded-full w-full" />
              <div className="h-1 bg-neutral-200 rounded-full w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagesContent() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-2 sm:px-3 py-1.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-center shrink-0">
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-400 shrink-0" />
          <div className="h-1 bg-neutral-300 rounded-full w-10" />
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 p-2 sm:p-3 flex flex-col gap-1.5 justify-end">
        <div className="self-start bg-neutral-200 rounded-2xl w-14 h-3" />
        <div className="self-end bg-blue-500 rounded-2xl w-10 h-3" />
        <div className="self-start bg-neutral-200 rounded-2xl w-18 h-4" />
        <div className="self-end bg-blue-500 rounded-2xl w-12 h-3" />
        <div className="self-start bg-neutral-200 rounded-2xl w-10 h-3" />
      </div>
    </div>
  );
}

function TransactionsContent() {
  const rows = [
    { name: "w-2/5", amount: "w-8", cat: "bg-green-200" },
    { name: "w-1/3", amount: "w-6", cat: "bg-orange-200" },
    { name: "w-1/2", amount: "w-8", cat: "bg-blue-200" },
    { name: "w-1/4", amount: "w-6", cat: "bg-green-200" },
    { name: "w-2/5", amount: "w-10", cat: "bg-purple-200" },
    { name: "w-1/3", amount: "w-6", cat: "bg-orange-200" },
    { name: "w-1/2", amount: "w-8", cat: "bg-blue-200" },
  ];
  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 border-b border-neutral-200 shrink-0">
        <div className="h-1 bg-neutral-400 rounded-full w-8" />
        <div className="h-1 bg-neutral-400 rounded-full w-10 ml-auto" />
        <div className="h-1 bg-neutral-400 rounded-full w-6" />
      </div>
      {/* Rows */}
      <div className="flex-1 flex flex-col">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1 border-b border-neutral-100"
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${row.cat}`} />
            <div className={`h-1 bg-neutral-300 rounded-full ${row.name}`} />
            <div className={`h-1 bg-neutral-400 rounded-full ${row.amount} ml-auto`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function GitHubContent() {
  return (
    <div className="flex flex-col h-full">
      {/* GitHub header */}
      <div className="px-2 sm:px-3 py-1.5 bg-neutral-800 flex items-center gap-2 shrink-0">
        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white/20" />
        <div className="h-1.5 bg-white/30 rounded-full w-16" />
        <div className="ml-auto h-1 bg-white/20 rounded-full w-8" />
      </div>
      {/* Repo header */}
      <div className="px-2 sm:px-3 py-1.5 border-b border-neutral-200 flex items-center gap-1.5 shrink-0">
        <div className="h-1.5 bg-neutral-400 rounded-full w-12" />
        <div className="h-1.5 bg-neutral-300 rounded-full w-1" />
        <div className="h-1.5 bg-blue-400 rounded-full w-16" />
      </div>
      {/* File list */}
      <div className="flex-1 flex flex-col">
        {[
          { icon: "bg-blue-300", nameW: "w-1/4", msgW: "w-2/5" },
          { icon: "bg-blue-300", nameW: "w-1/3", msgW: "w-1/3" },
          { icon: "bg-neutral-300", nameW: "w-2/5", msgW: "w-1/2" },
          { icon: "bg-neutral-300", nameW: "w-1/4", msgW: "w-2/5" },
          { icon: "bg-neutral-300", nameW: "w-1/3", msgW: "w-1/3" },
          { icon: "bg-green-300", nameW: "w-3/5", msgW: "w-1/4" },
          { icon: "bg-neutral-300", nameW: "w-1/4", msgW: "w-2/5" },
        ].map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1 border-b border-neutral-100"
          >
            <div
              className={`w-1.5 h-1.5 rounded-sm shrink-0 ${row.icon}`}
            />
            <div
              className={`h-1 bg-neutral-400 rounded-full ${row.nameW}`}
            />
            <div
              className={`h-1 bg-neutral-200 rounded-full ${row.msgW} ml-auto`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const scenes = {
  person: (
    <>
      <AppWindow className="left-[4%] top-[16%] w-[36%] h-[52%] z-10">
        <InstagramContent />
      </AppWindow>
      <AppWindow className="left-[24%] top-[12%] w-[42%] h-[56%] z-20">
        <PhotosContent />
      </AppWindow>
      <AppWindow className="left-[52%] top-[10%] w-[26%] h-[62%] z-30">
        <WhatsAppContent />
      </AppWindow>
      <AppWindow className="left-[68%] top-[16%] w-[24%] h-[56%] z-40">
        <MessagesContent />
      </AppWindow>
      <div className="absolute left-[6%] top-[52%] w-[30%] z-50">
        <ClaudeCodeMini />
      </div>
    </>
  ),
  trip: (
    <>
      <AppWindow className="left-[4%] top-[12%] w-[46%] h-[60%] z-10">
        <PhotosContent />
      </AppWindow>
      <AppWindow className="left-[34%] top-[16%] w-[38%] h-[56%] z-20">
        <MapsContent />
      </AppWindow>
      <AppWindow className="left-[62%] top-[10%] w-[30%] h-[58%] z-30">
        <TransactionsContent />
      </AppWindow>
      <div className="absolute left-[6%] top-[52%] w-[30%] z-40">
        <ClaudeCodeMini />
      </div>
    </>
  ),
  project: (
    <>
      <AppWindow className="left-[6%] top-[12%] w-[44%] h-[62%] z-10">
        <SlackContent />
      </AppWindow>
      <AppWindow className="left-[42%] top-[10%] w-[42%] h-[58%] z-20">
        <GitHubContent />
      </AppWindow>
      <div className="absolute left-[10%] top-[50%] w-[32%] z-30">
        <ClaudeCodeMini />
      </div>
    </>
  ),
} as const;

const labels = ["Person", "Trip", "Project"] as const;
type Fixture = "person" | "trip" | "project";

export function FixtureOverview({ fixture }: { fixture?: Fixture }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const advance = useCallback(() => {
    setActive((i) => (i + 1) % 3);
  }, []);

  useEffect(() => {
    if (fixture) return;
    timerRef.current = setInterval(advance, 5000);
    return () => clearInterval(timerRef.current);
  }, [advance, fixture]);

  const goTo = useCallback(
    (i: number) => {
      setActive(i);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(advance, 5000);
    },
    [advance],
  );

  if (fixture) {
    return (
      <div className="not-prose">
        <div
          className="relative w-full rounded-xl aspect-[16/10] bg-cover bg-center overflow-hidden"
          style={{ backgroundImage: "url('/evals-wallpaper.jpg')" }}
        >
          <MenuBar />
          <div className="absolute inset-0">{scenes[fixture]}</div>
          <Dock />
        </div>
      </div>
    );
  }

  const order: Fixture[] = ["person", "trip", "project"];

  return (
    <div className="not-prose flex flex-col items-center gap-3">
      <div
        className="relative w-full rounded-xl aspect-[16/10] bg-cover bg-center overflow-hidden"
        style={{ backgroundImage: "url('/evals-wallpaper.jpg')" }}
      >
        <MenuBar />

        {order.map((key, i) => (
          <div
            key={key}
            className={`absolute inset-0 transition-opacity duration-700 ${active === i ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            {scenes[key]}
          </div>
        ))}

        <Dock />
      </div>

      {/* Scene indicator */}
      <div className="flex items-center gap-2.5">
        <span className="text-sm text-muted font-medium">
          {labels[active]}
        </span>
        <div className="flex gap-1.5">
          {labels.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i === active ? "bg-neutral-800 dark:bg-white" : "bg-neutral-300 dark:bg-neutral-600 hover:bg-neutral-400 dark:hover:bg-neutral-500"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
