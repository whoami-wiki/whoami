"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useInView } from "motion/react";

type LineType = "thinking" | "command" | "output";

interface Line {
  type: LineType;
  text: string;
}

const lines: Line[] = [
  // ── Phase 1: Snapshot sources ─────────────────────────────────
  {
    type: "thinking",
    text: "847 photos from Goa, December 2019. GPS on 94% of files.",
  },
  {
    type: "thinking",
    text: "Let me snapshot these and cross-reference with messages and location history.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ wai snapshot ~/Photos/Goa --title "Goa Trip (2019)"',
  },
  { type: "output", text: "" },
  { type: "output", text: "Snapshotting ~/Photos/Goa..." },
  { type: "output", text: "" },
  { type: "output", text: "  Files: 847" },
  { type: "output", text: "  New objects: 812 (2.1 GB)" },
  { type: "output", text: "  Deduplicated: 35 (140 MB saved)" },
  { type: "output", text: "  Snapshot ID: a3f2b8c9" },
  { type: "output", text: "" },
  { type: "output", text: "Created: Source:Goa Trip (2019)" },
  { type: "output", text: "" },

  // ── Phase 2: EXIF archaeology ─────────────────────────────────
  {
    type: "thinking",
    text: "Let me extract GPS clusters and timestamps from the EXIF data to map the day-by-day itinerary.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: "$ exiftool -DateTimeOriginal -GPSLatitude -GPSLongitude -json ~/Photos/Goa/*.HEIC | jq 'group_by(.DateTimeOriginal[:10]) | map({date: .[0].DateTimeOriginal[:10], count: length})'",
  },
  { type: "output", text: "" },
  { type: "output", text: '  {"date": "2019-12-21", "count": 42}' },
  { type: "output", text: '  {"date": "2019-12-22", "count": 187}' },
  { type: "output", text: '  {"date": "2019-12-23", "count": 156}' },
  { type: "output", text: '  {"date": "2019-12-24", "count": 201}' },
  { type: "output", text: '  {"date": "2019-12-25", "count": 89}' },
  { type: "output", text: '  {"date": "2019-12-26", "count": 134}' },
  { type: "output", text: '  {"date": "2019-12-27", "count": 38}' },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "Dec 22 and 24 are the heaviest — pool day and the Anjuna Beach trip. Dec 27 is departure, only 38 photos.",
  },
  {
    type: "thinking",
    text: "GPS coordinates cluster at 15.59°N, 73.77°E (Assagao). Let me check which photos are from the Canon vs phones.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ exiftool -Model -json ~/Photos/Goa/*.HEIC | jq \'group_by(.Model) | map({model: .[0].Model, count: length}) | sort_by(-.count)\'',
  },
  { type: "output", text: "" },
  { type: "output", text: '  {"model": "iPhone 11", "count": 612}' },
  { type: "output", text: '  {"model": "iPhone XR", "count": 149}' },
  { type: "output", text: '  {"model": "Canon PowerShot A2300", "count": 86}' },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "Three cameras: Jay's iPhone 11, likely Priya's or Sid's XR, and the family Canon. The Canon shots fill GPS gaps where the phones weren't used.",
  },
  { type: "output", text: "" },

  // ── Phase 3: Messages ─────────────────────────────────────────
  {
    type: "command",
    text: '$ wai read "Source:Messages" --thread "College Gang"',
  },
  { type: "output", text: "" },
  { type: "output", text: "Thread: College Gang (94,000+ messages)" },
  {
    type: "output",
    text: '  2019-10-14 Vik: "Booked. Figure out flights."',
  },
  { type: "output", text: "  2019-10-14 Rohit: [shared Google Sheet link]" },
  { type: "output", text: '  2019-10-15 Priya: "Who\'s driving?"' },
  {
    type: "output",
    text: '  2019-10-15 Meera: "Vik you didn\'t even ask us"',
  },
  { type: "output", text: "  ..." },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "Vik booked the villa without asking — confirmed in the chat. Rohit created a 14-tab Google Sheet that the group ignored by hour three.",
  },
  { type: "output", text: "" },

  // ── Phase 4: Transaction forensics ────────────────────────────
  {
    type: "command",
    text: "$ wai snapshot ~/exports/splitwise-dec-2019.csv --title \"Goa Expenses\"",
  },
  { type: "output", text: "" },
  { type: "output", text: "  Files: 1" },
  { type: "output", text: "  Snapshot ID: e494a6b7" },
  { type: "output", text: "" },
  { type: "output", text: "Created: Source:Goa Expenses" },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ cat ~/exports/splitwise-dec-2019.csv | csvq "SELECT description, amount, paid_by FROM expenses WHERE date BETWEEN \'2019-12-21\' AND \'2019-12-27\' ORDER BY date"',
  },
  { type: "output", text: "" },
  { type: "output", text: "  Villa booking (Assagao)     ₹42,000  Vik" },
  { type: "output", text: "  Gunpowder restaurant         ₹4,200  Priya" },
  { type: "output", text: "  Mapusa market dosa cart         ₹180  Jay" },
  { type: "output", text: "  Anjuna beach parking            ₹200  Sid" },
  { type: "output", text: "  Basilica of Bom Jesus taxi      ₹650  Rohit" },
  { type: "output", text: "  ..." },
  { type: "output", text: "  (23 transactions total)" },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: 'Priya paid for most dinners — she was the designated driver and collected cash. The Mapusa dosa cart is the famous "Dosa Incident" from the group chat.',
  },
  { type: "output", text: "" },

  // ── Phase 5: Shazam / music data ──────────────────────────────
  {
    type: "command",
    text: "$ wai snapshot ~/exports/shazam-history/ --title \"Shazam Dec 2019\"",
  },
  { type: "output", text: "" },
  { type: "output", text: "  Files: 12" },
  { type: "output", text: "  Snapshot ID: 7a249850" },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ jq \'[.[] | select(.date | startswith("2019-12"))] | sort_by(.date) | .[] | "\\(.date) \\(.track) — \\(.artist)"\' ~/exports/shazam-history/*.json',
  },
  { type: "output", text: "" },
  { type: "output", text: "  2019-12-22 21:14  Tujhe Dekha Toh — Kumar Sanu" },
  {
    type: "output",
    text: '  2019-12-23 23:30  "Blinding Lights" — The Weeknd',
  },
  {
    type: "output",
    text: '  2019-12-24 20:45  "Bekhayali" — Sachet Tandon',
  },
  {
    type: "output",
    text: '  2019-12-25 19:12  "Tera Ban Jaunga" — Akhil Sachdeva',
  },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "Night three at the beach bar: Blinding Lights had just released. The Bollywood tracks are from the villa — Sid always controlled the speaker.",
  },
  { type: "output", text: "" },

  // ── Phase 6: Location history ─────────────────────────────────
  {
    type: "command",
    text: '$ jq \'[.[] | select(.startTime | startswith("2019-12-2")) | {date: .startTime[:10], place: .name, lat: .lat, lon: .lon}] | group_by(.date) | map({date: .[0].date, places: map(.place)})\' ~/exports/location-history.json',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: "  2019-12-21: Dabolim Airport, Assagao villa",
  },
  {
    type: "output",
    text: "  2019-12-22: Villa, Calangute Beach, Gunpowder restaurant",
  },
  {
    type: "output",
    text: "  2019-12-23: Villa, Anjuna Beach, Curlies bar",
  },
  {
    type: "output",
    text: "  2019-12-24: Mapusa market, Villa, Basilica of Bom Jesus",
  },
  {
    type: "output",
    text: "  2019-12-25: Villa, Panjim, Gunpowder restaurant",
  },
  {
    type: "output",
    text: "  2019-12-26: Vagator, Chapora Fort, Villa",
  },
  {
    type: "output",
    text: "  2019-12-27: Assagao villa, Dabolim Airport",
  },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "The location history fills in venue names the photos couldn't resolve. Gunpowder appears twice — it became the default dinner spot after night three.",
  },
  {
    type: "thinking",
    text: "Cross-referencing the Mapusa visit on Dec 24 with the dosa cart transaction and 12 photos from that morning — this is the Dosa Incident.",
  },
  { type: "output", text: "" },

  // ── Phase 7: Read existing wiki pages for cross-links ─────────
  {
    type: "command",
    text: '$ wai read "Sid" | head -20',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: "  Best friend since BITS orientation week (2017). Roommate in",
  },
  {
    type: "output",
    text: "  C-204, then Indiranagar. Co-conspirator in The Croma Heist",
  },
  {
    type: "output",
    text: "  (age 15), co-founder of Astral Projection (band)...",
  },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "Sid's page already mentions the Goa trip briefly. I need to add a backlink and make sure the villa steps photo reference matches.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ wai read "Canon PowerShot A2300" | grep -i "goa"',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: '  ...borrowed by Jay for the Mumbai Dance Competition trip, and last fired in anger at The Goa Trip...',
  },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: 'The Canon page calls Goa its "last significant use." 86 Canon shots confirm this — the camera never appeared in EXIF after December 2019.',
  },
  { type: "output", text: "" },

  // ── Phase 8: Upload key photos ────────────────────────────────
  {
    type: "command",
    text: "$ for f in IMG_4401.HEIC IMG_4455.HEIC IMG_4512.HEIC IMG_4600.HEIC IMG_4723.HEIC; do wai upload ~/Photos/Goa/$f; done",
  },
  { type: "output", text: "" },
  { type: "output", text: "  Uploaded: IMG_4401.HEIC (villa exterior)" },
  { type: "output", text: "  Uploaded: IMG_4455.HEIC (pool, night two)" },
  { type: "output", text: "  Uploaded: IMG_4512.HEIC (dosa cart, Mapusa)" },
  { type: "output", text: "  Uploaded: IMG_4600.HEIC (Anjuna sunset)" },
  {
    type: "output",
    text: "  Uploaded: IMG_4723.HEIC (group shot, villa steps)",
  },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "The group shot on the villa steps was taken by Priya on a self-timer after 11 attempts. EXIF burst metadata confirms this — 11 consecutive shots within 90 seconds.",
  },
  { type: "output", text: "" },

  // ── Phase 9: Write the episode page ───────────────────────────
  {
    type: "command",
    text: '$ wai write "The Goa Trip" /tmp/goa-episode.wiki',
  },
  { type: "output", text: "" },
  { type: "output", text: "  Created: The Goa Trip" },
  { type: "output", text: "  Word count: 2,100" },
  { type: "output", text: "  Sections: 7" },
  { type: "output", text: "  Citations: 19" },
  {
    type: "output",
    text: "  Linked: Sid, Priya, Rohit, Vik, Meera, Canon PowerShot A2300",
  },
  { type: "output", text: "  Images: 5 embedded" },
  { type: "output", text: "" },

  // ── Phase 10: Post to talk page ───────────────────────────────
  {
    type: "command",
    text: '$ wai talk create "The Goa Trip" -s "Source gaps" -c "$(cat /tmp/goa-gaps.wiki)"',
  },
  { type: "output", text: "" },
  { type: "output", text: "  Posted to Talk:The Goa Trip" },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "Two uncited claims remain: the exact sunset time Sid tracked, and whether the pool light ever got fixed. I'll flag these on the talk page for the next source pass.",
  },
  { type: "output", text: "" },

  // ── Phase 11: Create person stubs ─────────────────────────────
  {
    type: "thinking",
    text: "Rohit and Meera don't have wiki pages yet. I have enough from the chat export and transaction data to create stubs.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ wai write "Rohit" /tmp/rohit-stub.wiki && wai write "Meera" /tmp/meera-stub.wiki',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: "  Created: Rohit (stub — 340 words, 4 citations)",
  },
  {
    type: "output",
    text: "  Created: Meera (stub — 280 words, 3 citations)",
  },
  { type: "output", text: "" },

  // ── Phase 12: Citation audit ──────────────────────────────────
  {
    type: "command",
    text: '$ wai read "The Goa Trip" | grep -c "\\{\\{Cite"',
  },
  { type: "output", text: "  19" },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ wai read "The Goa Trip" | grep "\\{\\{Cite" | sed \'s/.*type=//;s/|.*//' + "' | sort | uniq -c | sort -rn",
  },
  { type: "output", text: "" },
  { type: "output", text: "  8 photo" },
  { type: "output", text: "  5 message" },
  { type: "output", text: "  3 transaction" },
  { type: "output", text: "  2 location" },
  { type: "output", text: "  1 music" },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "19 citations across five source types. Every factual claim traces back to a snapshot. The Dosa Incident alone has three independent sources: photo, transaction, and chat message.",
  },
  {
    type: "thinking",
    text: "Next I should look at the Priya page — she drove the entire trip and her perspective is underrepresented. Let me check what the messages reveal about the driving logistics.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ wai read "Source:Messages" --thread "College Gang" | grep -i "driv\\|car\\|rental\\|petrol"',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: '  2019-10-18 Priya: "I\'ll rent from Zoomcar. Nobody else is insured"',
  },
  {
    type: "output",
    text: '  2019-12-22 Vik: "priya can you drop us at calangute"',
  },
  {
    type: "output",
    text: '  2019-12-24 Rohit: "petrol is on me this time"',
  },
  {
    type: "output",
    text: '  2019-12-26 Priya: "I have driven every single day. someone else learn."',
  },
  { type: "output", text: "  ..." },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "Priya drove all seven days. Her frustration on Dec 26 is the only tense moment in the chat. The Zoomcar rental confirms she was the sole insured driver.",
  },
  {
    type: "thinking",
    text: "Let me update her page with the Goa driving details and add a backlink.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ wai read "Priya" | head -5',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: "  UX designer, cycling partner, the reliable one. Priya is the",
  },
  {
    type: "output",
    text: "  person who drove the entire Goa trip, who texts \"hills",
  },
  {
    type: "output",
    text: '  friday?" every Wednesday...',
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ wai write "Priya" /tmp/priya-updated.wiki',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: "  Updated: Priya (added Goa driving section, +3 citations)",
  },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "Now let me check if there are any photos from the group that haven't been attributed. The burst metadata from the villa steps suggests Priya set up the self-timer.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ exiftool -BurstUUID -DateTimeOriginal ~/Photos/Goa/IMG_472*.HEIC | grep -A1 "Burst"',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: "  IMG_4720.HEIC: BurstUUID: 3A8F2C91-...",
  },
  {
    type: "output",
    text: "  IMG_4721.HEIC: BurstUUID: 3A8F2C91-...",
  },
  {
    type: "output",
    text: "  IMG_4722.HEIC: BurstUUID: 3A8F2C91-...",
  },
  {
    type: "output",
    text: "  IMG_4723.HEIC: BurstUUID: 3A8F2C91-...",
  },
  {
    type: "output",
    text: "  ...  (11 photos, same BurstUUID)",
  },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "11 burst photos, same UUID — confirms the self-timer story from the chat. IMG_4723 is the keeper. Priya's iPhone 11 is the source device, which means she set it up.",
  },
  {
    type: "thinking",
    text: "The College Gang page should reference this as one of the best group photos. Let me check what it currently says.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ wai read "College Gang" | grep -i "photo\\|goa\\|trip"',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: "  ...one completed trip (The Goa Trip), and six more that never",
  },
  {
    type: "output",
    text: "  made it past the planning stage...",
  },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "The College Gang page already links to The Goa Trip but doesn't mention the villa steps photo. Let me add it as an image with the self-timer detail as a caption.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ wai write "College Gang" /tmp/college-gang-updated.wiki',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: "  Updated: College Gang (added villa steps photo, +1 citation)",
  },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "Let me check the Hot Wheels Collection page — Jay found a Jeep Wrangler at the Mapusa flea market during this trip. The transaction data should have the purchase.",
  },
  { type: "output", text: "" },

  {
    type: "command",
    text: '$ grep -i "mapusa\\|flea\\|hot.wheels\\|toy" ~/exports/splitwise-dec-2019.csv',
  },
  { type: "output", text: "" },
  {
    type: "output",
    text: "  2019-12-24,Mapusa flea market,₹350,Jay,personal",
  },
  { type: "output", text: "" },

  {
    type: "thinking",
    text: "₹350 at the flea market on Dec 24 — same day as the Dosa Incident. The Hot Wheels spreadsheet entry says \"technically a Goa Trip souvenir.\" I can cite the Splitwise record as provenance.",
  },
  { type: "output", text: "" },
];

function getDelay(line: Line): number {
  if (line.text === "") return 500;
  switch (line.type) {
    case "thinking":
      return 180;
    case "command":
      return 100;
    case "output":
      return 120;
  }
}

export function AgentLoop() {
  const ref = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;

    let i = 0;
    const tick = () => {
      i++;
      // Loop: when we reach the end, wrap back to start
      const idx = i % lines.length;
      setCount((prev) => prev + 1);
      const base = getDelay(lines[idx]);
      const jitter = base * (0.6 + Math.random() * 0.8);
      setTimeout(tick, jitter);
    };
    const id = setTimeout(tick, 500);
    return () => clearTimeout(id);
  }, [inView]);

  // Build the visible lines: all lines seen so far (wrapping through the array)
  const visibleLines: Line[] = [];
  for (let i = 0; i < count; i++) {
    visibleLines.push(lines[i % lines.length]);
  }

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [count, scrollToBottom]);

  return (
    <div
      ref={ref}
      className="relative z-10 max-w-4xl rounded-xl bg-neutral-900 dark:bg-neutral-950 overflow-hidden flex flex-col w-full border border-primary"
    >
      <div className="flex items-center gap-2 p-3 bg-neutral-800 dark:bg-neutral-900 shrink-0">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>

      <div
        ref={scrollRef}
        className="overflow-y-auto p-4 font-mono text-sm leading-relaxed tracking-tight h-96 scrollbar-none"
      >
        {visibleLines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap ${lineClass(line.type)}`}
          >
            {line.text || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  );
}

function lineClass(type: LineType): string {
  switch (type) {
    case "thinking":
      return "text-neutral-500 dark:text-neutral-400";
    case "command":
      return "text-emerald-400";
    case "output":
      return "text-neutral-100";
  }
}
