"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

interface Props {
  lines: string[];
  animate?: "lines" | "stream";
}

export function Terminal({ lines, animate }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  // Split into command (leading $ lines + trailing blank) and response
  let commandEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("$")) {
      commandEnd = i + 1;
    } else if (commandEnd > 0 && lines[i] === "") {
      commandEnd = i + 1;
    } else {
      break;
    }
  }
  const commandLines = lines.slice(0, commandEnd);
  const responseLines = lines.slice(commandEnd);

  // Lines mode: reveal response lines one at a time
  const [visibleCount, setVisibleCount] = useState(
    animate === "lines" ? 0 : responseLines.length
  );

  // Stream mode: reveal words one at a time
  const responseText = responseLines.join("\n");

  // Precompute word boundary offsets: each entry is the char index where a word ends
  const wordOffsets = (() => {
    const offsets: number[] = [];
    const re = /\S+\s*/g;
    let match;
    while ((match = re.exec(responseText)) !== null) {
      offsets.push(match.index + match[0].length);
    }
    // Ensure we end at the full length
    if (offsets.length === 0 || offsets[offsets.length - 1] < responseText.length) {
      offsets.push(responseText.length);
    }
    return offsets;
  })();

  const [wordCount, setWordCount] = useState(
    animate === "stream" ? 0 : wordOffsets.length
  );

  useEffect(() => {
    if (!inView || !animate) return;

    if (animate === "lines") {
      let count = 0;
      const tick = () => {
        count++;
        setVisibleCount(count);
        if (count < responseLines.length) {
          // Blank lines pause longer (like output arriving in chunks)
          const base = responseLines[count] === "" ? 200 : 80;
          const jitter = base * (0.5 + Math.random());
          setTimeout(tick, jitter);
        }
      };
      const jitter = 80 * (0.5 + Math.random());
      const id = setTimeout(tick, jitter);
      return () => clearTimeout(id);
    }

    if (animate === "stream") {
      let count = 0;
      const tick = () => {
        count++;
        setWordCount(count);
        if (count < wordOffsets.length) {
          // Check if the word ended at punctuation or newline
          const endIdx = wordOffsets[count - 1];
          const lastChar = responseText[endIdx - 1];
          const endsWithNewline =
            lastChar === "\n" ||
            (endIdx < responseText.length && responseText[endIdx] === "\n");
          const base = endsWithNewline
            ? 120
            : ".,:;!?".includes(lastChar ?? "")
              ? 80
              : 40;
          const jitter = base * (0.6 + Math.random() * 0.8);
          setTimeout(tick, jitter);
        }
      };
      const id = setTimeout(tick, 40 * (0.6 + Math.random() * 0.8));
      return () => clearTimeout(id);
    }
  }, [inView, animate, responseLines.length, wordOffsets.length, responseText]);

  // For stream mode, compute partial text per line
  const charCount =
    wordCount >= wordOffsets.length
      ? responseText.length
      : wordCount > 0
        ? wordOffsets[wordCount - 1]
        : 0;

  const streamLines =
    animate === "stream"
      ? responseText.slice(0, charCount).split("\n")
      : null;


  return (
    <div
      ref={ref}
      className="relative z-10 max-w-4xl h-4/5 rounded-xl bg-neutral-900 dark:bg-neutral-950 overflow-hidden flex flex-col w-full border border-primary"
    >
      <div className="flex items-center gap-2 p-3 bg-neutral-800 dark:bg-neutral-900 shrink-0">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed text-neutral-100 tracking-tight">
        {commandLines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {line || "\u00A0"}
          </div>
        ))}
        {responseLines.map((line, i) => {
          if (animate === "lines") {
            return (
              <div
                key={`r-${i}`}
                className="whitespace-pre-wrap"
                style={{ visibility: i < visibleCount ? "visible" : "hidden" }}
              >
                {line || "\u00A0"}
              </div>
            );
          }

          if (streamLines) {
            const reached = i < streamLines.length;
            const revealedPart = reached ? streamLines[i] : "";
            const hiddenPart = line.slice(revealedPart.length);

            return (
              <div
                key={`r-${i}`}
                className="whitespace-pre-wrap"
                style={{ visibility: reached ? "visible" : "hidden" }}
              >
                {revealedPart}
                {hiddenPart && (
                  <span className="text-transparent">{hiddenPart}</span>
                )}
                {!revealedPart && !hiddenPart && "\u00A0"}
              </div>
            );
          }

          return (
            <div key={`r-${i}`} className="whitespace-pre-wrap">
              {line || "\u00A0"}
            </div>
          );
        })}
      </div>
    </div>
  );
}
