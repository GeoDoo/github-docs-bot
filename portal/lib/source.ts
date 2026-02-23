import { loader, type Source, type PageData, type MetaData } from 'fumadocs-core/source';
import { fetchAllRepoDocs, type RepoDoc } from './github';
import {
  getPortalConfig,
  findRepoCategory,
  type PortalConfig,
  type Category,
} from './config';

export interface DocsPageData extends PageData {
  title: string;
  description: string;
  repo: string;
  owner: string;
  fullName: string;
  category?: string;
  structuredBody: { raw: string };
}

interface Section {
  name: string;
  content: string;
}

function parseRepoMarkdown(doc: RepoDoc): Section[] {
  const lines = doc.markdown.split('\n');
  const sections: Section[] = [];
  let currentTitle = doc.title;
  let currentLines: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      if (currentLines.length > 0) {
        sections.push({ name: currentTitle, content: currentLines.join('\n') });
      }
      currentTitle = h2Match[1].trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({ name: currentTitle, content: currentLines.join('\n') });
  }

  if (sections.length === 0) {
    sections.push({ name: doc.title, content: doc.markdown });
  }

  return sections;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type VirtualFiles = Source<{ pageData: DocsPageData; metaData: MetaData }>['files'];

function addRepoFiles(
  files: VirtualFiles,
  doc: RepoDoc,
  pathPrefix: string,
  categoryName?: string,
): void {
  const repoSlug = slugify(doc.fullName);
  const base = pathPrefix ? `${pathPrefix}/${repoSlug}` : repoSlug;

  files.push({
    type: 'meta' as const,
    path: `${base}/meta.json`,
    data: {
      title: doc.title,
      description: doc.description,
    },
  });

  const sections = parseRepoMarkdown(doc);

  files.push({
    type: 'page' as const,
    path: `${base}/index.mdx`,
    data: {
      title: doc.title,
      description: doc.description,
      repo: doc.repo,
      owner: doc.owner,
      fullName: doc.fullName,
      category: categoryName,
      structuredBody: { raw: sections[0].content },
    },
  });

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const sectionSlug = slugify(section.name);
    files.push({
      type: 'page' as const,
      path: `${base}/${sectionSlug}.mdx`,
      data: {
        title: section.name,
        description: `${section.name} — ${doc.title}`,
        repo: doc.repo,
        owner: doc.owner,
        fullName: doc.fullName,
        category: categoryName,
        structuredBody: { raw: section.content },
      },
    });
  }
}

export interface CategorizedDocs {
  categories: { name: string; docs: RepoDoc[] }[];
  uncategorized: RepoDoc[];
}

function categorizeDocs(
  docs: RepoDoc[],
  config: PortalConfig,
): CategorizedDocs {
  if (config.repos.categories.length === 0) {
    return { categories: [], uncategorized: docs };
  }

  const categorizedFullNames = new Set<string>();
  const categories: { name: string; docs: RepoDoc[] }[] = [];

  for (const cat of config.repos.categories) {
    const catDocs: RepoDoc[] = [];
    for (const entry of cat.repos) {
      const doc = docs.find(
        (d) => d.fullName.toLowerCase() === entry.repo.toLowerCase(),
      );
      if (doc) {
        catDocs.push(doc);
        categorizedFullNames.add(doc.fullName.toLowerCase());
      }
    }
    if (catDocs.length > 0) {
      categories.push({ name: cat.name, docs: catDocs });
    }
  }

  const uncategorized = docs.filter(
    (d) => !categorizedFullNames.has(d.fullName.toLowerCase()),
  );

  return { categories, uncategorized };
}

function buildSource(
  docs: RepoDoc[],
  config: PortalConfig,
): Source<{ pageData: DocsPageData; metaData: MetaData }> {
  const files: VirtualFiles = [];
  const { categories, uncategorized } = categorizeDocs(docs, config);

  const hasCategories = categories.length > 0;

  for (const cat of categories) {
    const catSlug = slugify(cat.name);

    files.push({
      type: 'meta' as const,
      path: `${catSlug}/meta.json`,
      data: {
        title: cat.name,
        root: true,
      },
    });

    for (const doc of cat.docs) {
      addRepoFiles(files, doc, catSlug, cat.name);
    }
  }

  if (uncategorized.length > 0 && hasCategories) {
    files.push({
      type: 'meta' as const,
      path: 'other/meta.json',
      data: {
        title: 'Other',
        root: true,
      },
    });

    for (const doc of uncategorized) {
      addRepoFiles(files, doc, 'other');
    }
  } else {
    for (const doc of uncategorized) {
      addRepoFiles(files, doc, '');
    }
  }

  return { files };
}

let cachedUtils: ReturnType<typeof loader> | null = null;
let cachedDocs: RepoDoc[] | null = null;
let cachedCategorized: CategorizedDocs | null = null;
let cacheTimestamp = 0;

export async function getSource() {
  const config = getPortalConfig();
  const now = Date.now();
  const ttl = config.revalidateSeconds * 1000;

  if (cachedUtils && cachedDocs && cachedCategorized && now - cacheTimestamp < ttl) {
    return { utils: cachedUtils, docs: cachedDocs, categorized: cachedCategorized, config };
  }

  const docs = await fetchAllRepoDocs(config);
  const categorized = categorizeDocs(docs, config);
  const source = buildSource(docs, config);

  const utils = loader(source, {
    baseUrl: '/docs',
  });

  cachedDocs = docs;
  cachedUtils = utils;
  cachedCategorized = categorized;
  cacheTimestamp = now;

  return { utils, docs, categorized, config };
}

export function invalidateCache() {
  cachedUtils = null;
  cachedDocs = null;
  cachedCategorized = null;
  cacheTimestamp = 0;
}

export type { Section };
