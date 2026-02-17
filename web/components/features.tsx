import { ReactNode } from "react";

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93" />
        <path d="M8.24 4.47A4 4 0 0 1 15.76 4.47" />
        <path d="M12 10v4" />
        <path d="M8 22h8" />
        <path d="M7 18h10" />
        <path d="M12 18v4" />
        <path d="M12 14l-3 4h6l-3-4z" />
      </svg>
    ),
    title: "AI-Powered",
    description:
      "Agents browse your data, cross-reference sources, and draft encyclopedia pages automatically.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
    title: "Wikipedia Format",
    description:
      "Uses proven MediaWiki conventions — infoboxes, linked pages, categories, and revision history.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 8l-4 4 4 4" />
        <path d="M17 8l4 4-4 4" />
        <path d="M14 4l-4 16" />
      </svg>
    ),
    title: "Open Source",
    description:
      "Fully open source. Run it on your machine, use any model, and own your data.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    title: "Any Data Source",
    description:
      "Photos, messages, transactions, location history, social media archives, and more.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    title: "Cross-Referenced",
    description:
      "Connects details across data sources — matching photos to locations, transactions to venues.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "Local & Private",
    description:
      "Everything runs on your machine. Your data never leaves your computer.",
  },
];

export function Features() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose">
      {features.map((feature) => (
        <div
          key={feature.title}
          className="flex flex-col gap-2 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700"
        >
          <div className="text-neutral-500 dark:text-neutral-400">
            {feature.icon}
          </div>
          <div className="font-sans text-sm font-medium text-primary">
            {feature.title}
          </div>
          <div className="font-sans text-sm text-neutral-500 dark:text-neutral-400 leading-snug">
            {feature.description}
          </div>
        </div>
      ))}
    </div>
  );
}
