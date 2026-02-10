"use client";

import { useRef, useCallback, type PointerEvent } from "react";

export type AppType =
  | "photos"
  | "finder"
  | "messages"
  | "numbers"
  | "voicememos"
  | "maps";

interface Props {
  app: AppType;
  title: string;
  top: string;
  left: string;
  width: string;
  height: string;
  zIndex: number;
  onFocus?: () => void;
  onDrag?: (dx: number, dy: number) => void;
  offsetX?: number;
  offsetY?: number;
}

function TrafficLights() {
  return (
    <div className="flex gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
      <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
      <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
    </div>
  );
}

function PhotosContent() {
  const colors = [
    "bg-amber-300",
    "bg-sky-300",
    "bg-rose-300",
    "bg-emerald-300",
    "bg-violet-300",
    "bg-orange-300",
  ];
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-1 p-2 h-full">
      {colors.map((c, i) => (
        <div key={i} className={`${c} rounded-sm`} />
      ))}
    </div>
  );
}

function FinderContent() {
  const files = [
    { icon: "bg-yellow-500", name: "WhatsApp_Chat.zip" },
    { icon: "bg-blue-400", name: "takeout-20230801.zip" },
    { icon: "bg-green-500", name: "resume_v14.pdf" },
    { icon: "bg-rose-400", name: "IMG_4231.png" },
    { icon: "bg-purple-400", name: "screenshots/" },
    { icon: "bg-neutral-400", name: "career_timeline.docx" },
  ];
  return (
    <div className="flex flex-col gap-0.5 p-1.5 h-full overflow-hidden">
      {files.map((f, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm hover:bg-blue-100 dark:hover:bg-neutral-700"
        >
          <div className={`w-3 h-3 ${f.icon} rounded-[2px] shrink-0`} />
          <span className="text-[10px] font-sans text-neutral-700 dark:text-neutral-300 truncate">
            {f.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function MessagesContent() {
  const messages = [
    { sent: false, text: "are we still going?" },
    { sent: true, text: "yes! booked the villa" },
    { sent: false, text: "send the link" },
    { sent: true, text: "check the group" },
    { sent: false, text: "which group lol" },
  ];
  return (
    <div className="flex flex-col gap-1.5 p-2 h-full overflow-hidden">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex ${m.sent ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`px-2 py-1 flex rounded-xl max-w-[75%] ${
              m.sent
                ? "bg-blue-500 text-neutral-100"
                : "bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
            }`}
          >
            <span className="text-[10px] font-sans">{m.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function NumbersContent() {
  const rows = [
    ["12 Jan", "Swiggy", "₹482"],
    ["14 Jan", "Amazon", "₹1,299"],
    ["18 Jan", "Uber", "₹234"],
    ["22 Jan", "BigBasket", "₹1,847"],
    ["25 Jan", "Netflix", "₹649"],
  ];
  return (
    <div className="flex flex-col h-full overflow-hidden text-[9px] font-sans">
      <div className="flex bg-neutral-200 dark:bg-neutral-700 font-bold text-neutral-700 dark:text-neutral-300">
        <span className="flex-[2] px-1.5 py-0.5">Date</span>
        <span className="flex-[3] px-1.5 py-0.5">Description</span>
        <span className="flex-[2] px-1.5 py-0.5 text-right">Amount</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex border-b border-neutral-100 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
        >
          <span className="flex-[2] px-1.5 py-0.5">{r[0]}</span>
          <span className="flex-[3] px-1.5 py-0.5">{r[1]}</span>
          <span className="flex-[2] px-1.5 py-0.5 text-right">{r[2]}</span>
        </div>
      ))}
    </div>
  );
}

function VoiceMemosContent() {
  const memos = [
    { title: "Walking idea #12", duration: "0:47" },
    { title: "Startup pitch v3", duration: "4:12" },
    { title: "Late night — Goa", duration: "22:03" },
    { title: "Call the dentist", duration: "0:08" },
  ];
  return (
    <div className="flex flex-col gap-1 p-1.5 h-full overflow-hidden">
      {memos.map((m, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 px-1.5 py-1 rounded-sm"
        >
          <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-sans text-neutral-700 dark:text-neutral-300 truncate">
              {m.title}
            </div>
            <div className="flex items-center gap-0.5 mt-0.5">
              {Array.from({ length: 16 }).map((_, j) => (
                <div
                  key={j}
                  className="w-[2px] bg-red-400/60 rounded-full"
                  style={{
                    height: `${Math.round(4 + Math.sin(j * 1.2 + i) * 3)}px`,
                  }}
                />
              ))}
              <span className="text-[8px] font-sans text-neutral-400 ml-1">
                {m.duration}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MapsContent() {
  // Scattered dots simulating location pins
  const dots = [
    { x: 35, y: 40 },
    { x: 42, y: 35 },
    { x: 38, y: 48 },
    { x: 50, y: 42 },
    { x: 45, y: 55 },
    { x: 55, y: 38 },
    { x: 30, y: 52 },
    { x: 48, y: 30 },
    { x: 60, y: 50 },
    { x: 40, y: 60 },
    { x: 25, y: 45 },
    { x: 52, y: 58 },
  ];
  return (
    <div className="relative h-full bg-emerald-200 dark:bg-emerald-900/40">
      {dots.map((d, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-red-500/80"
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
        />
      ))}
    </div>
  );
}

const contentRenderers: Record<AppType, () => React.JSX.Element> = {
  photos: PhotosContent,
  finder: FinderContent,
  messages: MessagesContent,
  numbers: NumbersContent,
  voicememos: VoiceMemosContent,
  maps: MapsContent,
};

export function AppWindow({
  app,
  title,
  top,
  left,
  width,
  height,
  zIndex,
  onFocus,
  onDrag,
  offsetX = 0,
  offsetY = 0,
}: Props) {
  const Content = contentRenderers[app];
  const dragOrigin = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      onFocus?.();
      dragOrigin.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offsetX,
        oy: offsetY,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [onFocus, offsetX, offsetY],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragOrigin.current) return;
      const dx = e.clientX - dragOrigin.current.x;
      const dy = e.clientY - dragOrigin.current.y;
      onDrag?.(dragOrigin.current.ox + dx, dragOrigin.current.oy + dy);
    },
    [onDrag],
  );

  const onPointerUp = useCallback(() => {
    dragOrigin.current = null;
  }, []);

  return (
    <div
      className="absolute rounded-lg bg-neutral-100 dark:bg-neutral-900 shadow-xl overflow-hidden flex flex-col border border-neutral-300 dark:border-neutral-700"
      style={{
        top,
        left,
        width,
        height,
        zIndex,
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
      onPointerDown={onFocus}
    >
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-200/80 dark:bg-neutral-800/80 border-b border-neutral-300 dark:border-neutral-700 shrink-0 cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <TrafficLights />
        <span className="text-[11px] font-sans text-neutral-600 dark:text-neutral-400 truncate">
          {title}
        </span>
      </div>
      {/* Content */}
      <div className="flex-1 min-h-0">
        <Content />
      </div>
    </div>
  );
}
