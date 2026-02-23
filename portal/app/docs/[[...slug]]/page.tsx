import { notFound } from 'next/navigation';
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from 'fumadocs-ui/page';
import { getSource, type DocsPageData } from '@/lib/source';
import { renderMarkdown, extractToc } from '@/lib/markdown';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const { utils } = await getSource();

  const page = utils.getPage(slug);
  if (!page) notFound();

  const data = page.data as DocsPageData;
  const html = await renderMarkdown(data.structuredBody.raw);
  const toc = extractToc(data.structuredBody.raw);

  return (
    <DocsPage
      toc={toc.map((entry) => ({
        title: entry.title,
        url: entry.url,
        depth: entry.depth,
      }))}
    >
      <DocsTitle>{data.title}</DocsTitle>
      {data.description && (
        <DocsDescription>{data.description}</DocsDescription>
      )}
      {data.fullName && (
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-stripe-purple/10 px-2.5 py-0.5 text-xs font-medium text-stripe-purple ring-1 ring-inset ring-stripe-purple/20">
            PUBLIC API
          </span>
          <a
            href={`https://github.com/${data.fullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-fd-muted-foreground hover:text-stripe-purple transition-colors"
          >
            {data.fullName}
          </a>
        </div>
      )}
      <DocsBody>
        <div
          className="prose-stripe"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  const { utils } = await getSource();
  return utils.generateParams();
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const { utils } = await getSource();
  const page = utils.getPage(slug);

  if (!page) return {};

  const data = page.data as DocsPageData;
  return {
    title: data.title,
    description: data.description,
  };
}
