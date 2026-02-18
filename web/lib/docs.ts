import fs from "fs";
import path from "path";
import matter from "gray-matter";

const DOCS_DIR = path.join(process.cwd(), "content/docs");

function extractHeadings(content: string): DocHeading[] {
  const matches = content.matchAll(/^## (.+)$/gm);
  return Array.from(matches, (m) => {
    const title = m[1].trim();
    const id = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    return { title, id };
  });
}

export interface DocHeading {
  title: string;
  id: string;
}

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  content: string;
  headings: DocHeading[];
}

export function getDoc(slug: string): DocPage | undefined {
  const filePath = path.join(DOCS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return undefined;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    content,
    headings: extractHeadings(content),
  };
}

export function getAllDocs(): DocPage[] {
  if (!fs.existsSync(DOCS_DIR)) return [];

  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".mdx"));

  return files.map((filename) => {
    const slug = filename.replace(/\.mdx$/, "");
    const raw = fs.readFileSync(path.join(DOCS_DIR, filename), "utf-8");
    const { data, content } = matter(raw);

    return {
      slug,
      title: data.title ?? slug,
      description: data.description ?? "",
      content,
      headings: extractHeadings(content),
    };
  });
}
