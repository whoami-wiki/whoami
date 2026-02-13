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

const ROLL_PHOTOS = [
  "img_roll_raj_1",
  "img_roll_raj_2",
  "img_roll_raj_3",
  "img_roll_raj_4",
  "img_roll_raj_5",
  "img_roll_raj_6",
  "img_roll_raj_7",
  "img_roll_raj_8",
  "img_roll_raj_9",
];

function PhotosContent() {
  const sections = [
    { label: "Library" },
    { label: "Recents" },
    { label: "Favorites" },
  ];
  const albums = [
    { label: "Rajasthan 2008", count: 847, selected: true },
    { label: "Diwali 2009", count: 124 },
    { label: "BITS Orientation", count: 203 },
    { label: "Mumbai Trip 2018", count: 340 },
    { label: "Goa Dec 2019", count: 847 },
    { label: "Lockdown Pune", count: 56 },
    { label: "Flat Hunt 2021", count: 58 },
    { label: "Nandi Hills", count: 412 },
  ];
  return (
    <div className="flex h-full overflow-hidden font-sans text-xs">
      {/* Sidebar */}
      <div className="w-[28%] shrink-0 bg-neutral-200/60 dark:bg-neutral-800/60 border-r border-primary flex flex-col overflow-hidden py-1">
        {sections.map((s, i) => (
          <div
            key={i}
            className="px-2 py-0.5 truncate text-neutral-700 dark:text-neutral-300"
          >
            {s.label}
          </div>
        ))}
        <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
          Albums
        </div>
        {albums.map((a, i) => (
          <div
            key={i}
            className={`px-2 py-0.5 truncate ${a.selected ? "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "text-neutral-700 dark:text-neutral-300"}`}
          >
            {a.label}
          </div>
        ))}
      </div>
      {/* Photo grid */}
      <div className="flex-1 min-w-0 p-0">
        <div className="grid grid-cols-3 grid-rows-3 gap-0.5 h-full">
          {ROLL_PHOTOS.map((id) => (
            <img
              key={id}
              src={`/images/${id}.png`}
              alt=""
              className="w-full h-full object-cover"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FinderContent() {
  const sidebar = [
    { name: "iCloud Drive", icon: "text-blue-400" },
    { name: "Google Drive", icon: "text-yellow-500" },
    { name: "jrmy", icon: "text-blue-500" },
    { name: "AirDrop", icon: "text-blue-400" },
    { name: "Network", icon: "text-neutral-400" },
  ];
  const files = [
    {
      icon: "bg-blue-400",
      name: "Archive",
      date: "Feb 7, 2026",
      kind: "Folder",
    },
    { icon: "bg-blue-400", name: "Desktop", date: "Today", kind: "Folder" },
    {
      icon: "bg-blue-500",
      name: "Downloads",
      date: "Yesterday",
      kind: "Folder",
      selected: true,
    },
    {
      icon: "bg-blue-400",
      name: "Documents",
      date: "Feb 3, 2026",
      kind: "Folder",
    },
    {
      icon: "bg-blue-400",
      name: "Movies",
      date: "Jan 28, 2026",
      kind: "Folder",
    },
    { icon: "bg-blue-400", name: "Music", date: "Feb 3, 2026", kind: "Folder" },
    {
      icon: "bg-blue-400",
      name: "Pictures",
      date: "Feb 8, 2026",
      kind: "Folder",
    },
    {
      icon: "bg-blue-400",
      name: "Repositories",
      date: "Feb 2, 2026",
      kind: "Folder",
    },
  ];
  return (
    <div className="flex h-full overflow-hidden font-sans text-xs">
      <div className="w-[30%] shrink-0 bg-neutral-200/60 dark:bg-neutral-800/60 border-r border-primary flex flex-col overflow-hidden py-1">
        {sidebar.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 px-2 py-0.5 ${s.name === "jrmy" ? "bg-blue-500/10 dark:bg-blue-500/20" : ""}`}
          >
            <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate">
              {s.name}
            </span>
          </div>
        ))}
      </div>
      {/* File list */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center px-2 py-0.5 border-b border-muted text-[9px] text-neutral-400">
          <span className="flex-[3]">Name</span>
          <span className="flex-[2]">Date Modified</span>
          <span className="flex-[2]">Kind</span>
        </div>
        {files.map((f, i) => (
          <div
            key={i}
            className={`flex items-center px-2 py-0.5 ${f.selected ? "bg-blue-500 text-white" : "text-neutral-700 dark:text-neutral-300"}`}
          >
            <span className="flex-[3] truncate flex items-center gap-1">
              <div
                className={`w-2.5 h-2.5 ${f.selected ? "bg-white/80" : f.icon} rounded-[2px] shrink-0`}
              />
              {f.name}
            </span>
            <span className="flex-[2] truncate">{f.date}</span>
            <span className="flex-[2] truncate">{f.kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesContent() {
  const conversations = [
    {
      initials: "CG",
      color: "bg-blue-500",
      name: "College Gang",
      preview: "Vik: server's down again",
      time: "2:14 PM",
    },
    {
      initials: "A",
      color: "bg-green-500",
      name: "Aai",
      preview: "beta, khana khaya?",
      time: "11:00 AM",
    },
    {
      initials: "PS",
      color: "bg-purple-500",
      name: "Priya S",
      preview: "hills friday?",
      time: "Tue",
    },
    {
      initials: "GT",
      color: "bg-orange-500",
      name: "Goa Trip 2019",
      preview: "Rohit: we doing this again or",
      time: "Mon",
    },
    {
      initials: "S",
      color: "bg-rose-500",
      name: "Sid",
      preview: "You: check the nether hub",
      time: "Sun",
    },
  ];
  const chatBubbles = [
    { sent: false, text: "server's down again", author: "Vik" },
    { sent: false, text: "the actual server or life", author: "Sid" },
    { sent: true, text: "both" },
    { sent: false, text: "lol", author: "Meera" },
    { sent: false, text: "hills friday?", author: "Priya" },
  ];
  return (
    <div className="flex h-full overflow-hidden font-sans text-xs">
      <div className="w-[40%] shrink-0 border-r border-muted flex flex-col overflow-hidden">
        {conversations.map((c, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-2 py-2 ${i === 0 ? "bg-blue-500/10 dark:bg-blue-500/20" : ""} border-b border-neutral-200 dark:border-neutral-800`}
          >
            <div
              className={`w-7 h-7 ${c.color} rounded-full shrink-0 flex items-center justify-center`}
            >
              <span className="text-xs text-white">{c.initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-neutral-800 dark:text-neutral-200 truncate block">
                {c.name}
              </span>
              <span className="text-xs text-neutral-400 truncate block">
                {c.preview}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 py-1.5 border-b border-muted shrink-0">
          <span className="text-xs text-neutral-700 dark:text-neutral-300">
            College Gang
          </span>
        </div>
        <div className="flex-1 flex flex-col gap-1.5 p-2 overflow-hidden">
          {chatBubbles.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.sent ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`px-2 py-1 rounded-lg max-w-[80%] ${m.sent ? "bg-blue-500 text-white" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200"}`}
              >
                {!m.sent && (
                  <div className="text-xs text-blue-500">{m.author}</div>
                )}
                <span className="text-xs">{m.text}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="shrink-0 px-2 py-1.5 border-t border-muted">
          <div className="flex items-center gap-1.5 rounded-full bg-neutral-200/60 dark:bg-neutral-700/60 px-2.5 py-1">
            <span className="text-xs text-neutral-400">Send message...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumbersContent() {
  const biomarkers = [
    {
      name: "Hemoglobin",
      value: "14.2",
      unit: "g/dL",
      range: "13.0–17.0",
      normal: true,
    },
    {
      name: "RBC Count",
      value: "5.1",
      unit: "M/μL",
      range: "4.5–5.5",
      normal: true,
    },
    {
      name: "WBC Count",
      value: "7,200",
      unit: "/μL",
      range: "4,000–11,000",
      normal: true,
    },
    {
      name: "Platelet Count",
      value: "245,000",
      unit: "/μL",
      range: "150,000–400,000",
      normal: true,
    },
    { name: "MCV", value: "88", unit: "fL", range: "80–100", normal: true },
    {
      name: "Vitamin D",
      value: "18.4",
      unit: "ng/mL",
      range: "30.0–100.0",
      normal: false,
    },
    {
      name: "Vitamin B12",
      value: "198",
      unit: "pg/mL",
      range: "200–900",
      normal: false,
    },
    {
      name: "TSH",
      value: "3.8",
      unit: "mIU/L",
      range: "0.4–4.0",
      normal: true,
    },
    {
      name: "Free T4",
      value: "1.2",
      unit: "ng/dL",
      range: "0.8–1.8",
      normal: true,
    },
    { name: "HbA1c", value: "5.6", unit: "%", range: "4.0–5.6", normal: true },
    {
      name: "Fasting Glucose",
      value: "92",
      unit: "mg/dL",
      range: "70–100",
      normal: true,
    },
    {
      name: "Total Cholesterol",
      value: "210",
      unit: "mg/dL",
      range: "< 200",
      normal: false,
    },
    { name: "HDL", value: "52", unit: "mg/dL", range: "> 40", normal: true },
    { name: "LDL", value: "128", unit: "mg/dL", range: "< 100", normal: false },
    {
      name: "Triglycerides",
      value: "148",
      unit: "mg/dL",
      range: "< 150",
      normal: true,
    },
    { name: "Iron", value: "72", unit: "μg/dL", range: "60–170", normal: true },
    {
      name: "Ferritin",
      value: "45",
      unit: "ng/mL",
      range: "30–400",
      normal: true,
    },
    {
      name: "Creatinine",
      value: "0.9",
      unit: "mg/dL",
      range: "0.7–1.3",
      normal: true,
    },
    {
      name: "Uric Acid",
      value: "6.8",
      unit: "mg/dL",
      range: "3.5–7.2",
      normal: true,
    },
    {
      name: "ALT (SGPT)",
      value: "32",
      unit: "U/L",
      range: "7–56",
      normal: true,
    },
  ];
  const pages = [1, 2, 3, 4, 5];
  return (
    <div className="flex h-full overflow-hidden font-sans text-xs">
      {/* Page thumbnails sidebar */}
      <div className="w-[18%] shrink-0 bg-neutral-200/60 dark:bg-neutral-800/60 border-r border-primary flex flex-col items-center gap-1.5 py-2 overflow-hidden">
        {pages.map((p) => (
          <div key={p} className="flex flex-col items-center gap-0.5">
            <div
              className={`w-8 h-10 rounded-[2px] border ${p === 1 ? "border-blue-500 shadow-sm shadow-blue-500/30" : "border-neutral-300 dark:border-neutral-600"} bg-white dark:bg-neutral-800 flex items-center justify-center`}
            >
              <div className="w-5 h-6 flex flex-col gap-[1px]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[1px] bg-neutral-300 dark:bg-neutral-600 rounded-full"
                  />
                ))}
              </div>
            </div>
            <span className="text-[8px] text-neutral-400">{p}</span>
          </div>
        ))}
      </div>
      {/* Report content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-neutral-900 p-2">
        <div className="text-xs text-neutral-800 dark:text-neutral-200 mb-1">
          Complete Blood Count &amp; Metabolic Panel
        </div>
        <div className="text-xs text-neutral-400 mb-2">
          Jan 15, 2026 &middot; Thyrocare Labs
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex text-xs text-neutral-400 border-b border-muted pb-0.5 mb-0.5">
            <span className="flex-[3]">Test</span>
            <span className="flex-[2]">Result</span>
            <span className="flex-[3]">Ref. Range</span>
          </div>
          {biomarkers.map((b, i) => (
            <div
              key={i}
              className="flex items-center text-xs py-[2px] border-b border-neutral-100 dark:border-neutral-800"
            >
              <span className="flex-[3] text-neutral-700 dark:text-neutral-300 truncate">
                {b.name}
              </span>
              <span
                className={`flex-[2] ${b.normal ? "text-neutral-700 dark:text-neutral-300" : "text-red-500"}`}
              >
                {b.value} <span className="text-neutral-400">{b.unit}</span>
              </span>
              <span className="flex-[3] text-neutral-400">{b.range}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VoiceMemosContent() {
  const memos = [
    {
      title: "Nandi Hills gear idea",
      date: "Today",
      duration: "0:47",
      selected: true,
    },
    { title: "Flat hunt pros/cons", date: "Jan 15", duration: "4:12" },
    { title: "Late night — Goa", date: "Dec 19", duration: "22:03" },
    { title: "Call the dentist", date: "Dec 3", duration: "0:08" },
    { title: "Hot Wheels pricing", date: "Nov 28", duration: "0:23" },
  ];
  return (
    <div className="flex h-full overflow-hidden font-sans text-xs">
      {/* Sidebar — recording list */}
      <div className="w-[40%] shrink-0 bg-neutral-200/60 dark:bg-neutral-800/60 border-r border-primary flex flex-col overflow-hidden">
        {memos.map((m, i) => (
          <div
            key={i}
            className={`px-2 py-1.5 border-b border-neutral-300/50 dark:border-neutral-700/50 ${m.selected ? "bg-blue-500/10 dark:bg-blue-500/20" : ""}`}
          >
            <div className="text-xs text-neutral-800 dark:text-neutral-200 truncate">
              {m.title}
            </div>
            <div className="text-xs text-neutral-400">
              {m.date} &middot; {m.duration}
            </div>
          </div>
        ))}
      </div>
      {/* Detail — waveform */}
      <div className="flex-1 flex flex-col min-w-0 p-2">
        <div className="text-xs text-neutral-800 dark:text-neutral-200">
          Nandi Hills gear idea
        </div>
        <div className="text-xs text-neutral-400 mb-2">0:47</div>
        <div className="flex-1 flex items-center gap-[2px]">
          {Array.from({ length: 80 }).map((_, j) => (
            <div
              key={j}
              className="flex-1 max-w-[3px] bg-blue-500/60 rounded-full"
              style={{
                height: `${Math.round(20 + Math.sin(j * 0.7) * 15 + Math.cos(j * 1.3) * 10)}%`,
              }}
            />
          ))}
        </div>
        <div className="flex justify-center mt-2">
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MapsContent() {
  const days = [
    {
      label: "Thu, Jan 15",
      dim: false,
      entries: [
        { place: "Home", time: "8:00 AM", icon: "bg-blue-500" },
        { place: "Indiranagar Metro", time: "9:12 AM", icon: "bg-neutral-400" },
        { place: "WeWork Prestige", time: "9:45 AM", icon: "bg-green-500" },
        {
          place: "Truffles, Koramangala",
          time: "1:15 PM",
          icon: "bg-orange-400",
        },
        { place: "WeWork Prestige", time: "2:00 PM", icon: "bg-green-500" },
        { place: "Cubbon Park", time: "6:30 PM", icon: "bg-emerald-500" },
        { place: "Home", time: "8:15 PM", icon: "bg-blue-500" },
        { place: "Home", time: "10:42 PM", icon: "bg-blue-500" },
      ],
    },
    {
      label: "Wed, Jan 14",
      dim: true,
      entries: [
        { place: "Nandi Hills Rd", time: "4:38 AM", icon: "bg-orange-400" },
        { place: "Nandi Hills Summit", time: "6:44 AM", icon: "bg-orange-400" },
        { place: "Dosa stall, summit", time: "7:02 AM", icon: "bg-yellow-500" },
        { place: "Home", time: "9:10 AM", icon: "bg-blue-500" },
        {
          place: "Indiranagar Metro",
          time: "10:30 AM",
          icon: "bg-neutral-400",
        },
        { place: "WeWork Prestige", time: "11:05 AM", icon: "bg-green-500" },
      ],
    },
  ];
  const dots = [
    { x: 45, y: 35 },
    { x: 52, y: 40 },
    { x: 48, y: 50 },
    { x: 55, y: 45 },
    { x: 40, y: 55 },
    { x: 60, y: 35 },
    { x: 35, y: 42 },
    { x: 50, y: 60 },
    { x: 58, y: 52 },
    { x: 42, y: 30 },
    { x: 65, y: 48 },
    { x: 38, y: 62 },
  ];
  return (
    <div className="flex h-full overflow-hidden font-sans text-xs">
      {/* Timeline sidebar */}
      <div className="w-[38%] shrink-0 border-r border-primary flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
        {days.map((day, di) => (
          <div key={di}>
            <div
              className={`px-2 py-1 border-b border-muted text-xs text-muted${di > 0 ? " border-t" : ""}`}
            >
              {day.label}
            </div>
            <div className="relative">
              {/* Continuous vertical line behind dots */}
              <div className="absolute left-[11px] top-[10px] bottom-0 w-[1px] bg-neutral-300 dark:bg-neutral-600" />
              {day.entries.map((t, i) => (
                <div key={i} className="relative flex gap-1.5 px-2 py-1">
                  <div className="flex items-center justify-center w-2 shrink-0">
                    <div
                      className={`w-[9px] h-[9px] shrink-0 rounded-full ${day.dim ? "opacity-40" : ""} ${t.icon} relative z-10`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-xs truncate ${day.dim ? "text-muted" : "text-neutral-800 dark:text-neutral-200"}`}
                    >
                      {t.place}
                    </div>
                    <div
                      className={`text-[9px] ${day.dim ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-400"}`}
                    >
                      {t.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Map area */}
      <div className="flex-1 relative bg-emerald-100 dark:bg-emerald-950/40">
        {/* Roads */}
        <div className="absolute inset-0">
          <div className="absolute top-[30%] left-0 right-0 h-[1px] bg-neutral-300/60 dark:bg-neutral-600/40" />
          <div className="absolute top-[50%] left-0 right-0 h-[1px] bg-neutral-300/60 dark:bg-neutral-600/40" />
          <div className="absolute top-[70%] left-0 right-0 h-[1px] bg-neutral-300/60 dark:bg-neutral-600/40" />
          <div className="absolute left-[30%] top-0 bottom-0 w-[1px] bg-neutral-300/60 dark:bg-neutral-600/40" />
          <div className="absolute left-[55%] top-0 bottom-0 w-[1px] bg-neutral-300/60 dark:bg-neutral-600/40" />
          <div className="absolute left-[75%] top-0 bottom-0 w-[1px] bg-neutral-300/60 dark:bg-neutral-600/40" />
        </div>
        {/* Location dots */}
        {dots.map((d, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-blue-500/70 dark:bg-blue-400/70"
            style={{ left: `${d.x}%`, top: `${d.y}%` }}
          />
        ))}
        {/* Current pin */}
        <div
          className="absolute w-3 h-3 rounded-full bg-red-500 border-2 border-white dark:border-neutral-800 shadow-sm"
          style={{ left: "48%", top: "48%" }}
        />
        {/* Zoom controls */}
        <div className="absolute bottom-2 right-2 flex flex-col rounded-md overflow-hidden shadow-sm border border-neutral-300 dark:border-neutral-600">
          <div className="w-6 h-6 bg-white dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 text-sm border-b border-neutral-300 dark:border-neutral-600">
            +
          </div>
          <div className="w-6 h-6 bg-white dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 text-sm">
            &minus;
          </div>
        </div>
      </div>
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
      className="absolute rounded-xl bg-neutral-100 dark:bg-neutral-900 shadow-xl overflow-hidden flex flex-col border border-primary"
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
        className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-200/80 dark:bg-neutral-800/80 border-b border-primary shrink-0 cursor-grab active:cursor-grabbing select-none"
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
