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
      { title: "Installation", slug: "installation" },
      { title: "Writing Your First Page", slug: "writing-your-first-page" },
      { title: "Troubleshooting", slug: "troubleshooting" },
    ],
  },
  {
    title: "Learn More",
    items: [
      { title: "Concepts", slug: "concepts" },
      { title: "Page Types", slug: "page-types" },
      { title: "Editorial Standards", slug: "editorial-standards" },
      { title: "Data Sources", slug: "data-sources" },
      { title: "Citation System", slug: "citation-system" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "CLI", slug: "cli" },
      { title: "Evals", slug: "evals" },
    ],
  },
];
