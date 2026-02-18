"use client";

import { ReactNode, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

export function CopyCodeBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = preRef.current?.textContent ?? "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group flex flex-row items-start w-full bg-neutral-900 rounded-lg pr-3">
      <pre
        ref={preRef}
        className="text-sm font-mono p-4 overflow-x-auto  text-neutral-100 [&_code]:border-none [&_code]:p-0 [&_code]:bg-transparent [&_code]:text-inherit w-full bg-transparent"
      >
        {children}
      </pre>

      <button
        onClick={handleCopy}
        className="size-fit mt-4 rounded-md text-neutral-400 hover:text-neutral-100 cursor-pointer"
        aria-label="Copy to clipboard"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}
