export interface SidebarItem {
  title: string;
  slug: string;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export const sidebarConfig: SidebarSection[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", slug: "introduction" },
      { title: "Installation", slug: "installation" },
      { title: "Quick Start", slug: "quick-start" },
    ],
  },
  {
    title: "Data Sources",
    items: [
      { title: "Overview", slug: "data-sources" },
      { title: "Photos & Videos", slug: "photos-and-videos" },
      { title: "Messages & Chats", slug: "messages-and-chats" },
    ],
  },
  {
    title: "Agents",
    items: [
      { title: "How Agents Work", slug: "how-agents-work" },
      { title: "Writing Pages", slug: "writing-pages" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { title: "MediaWiki Setup", slug: "mediawiki-setup" },
      { title: "Models", slug: "models" },
    ],
  },
];
