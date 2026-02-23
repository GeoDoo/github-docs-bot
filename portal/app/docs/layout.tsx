import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { getSource } from '@/lib/source';

export default async function Layout({ children }: { children: ReactNode }) {
  const { utils, config } = await getSource();

  return (
    <DocsLayout
      tree={utils.pageTree}
      nav={{
        title: (
          <span className="font-bold text-stripe-purple">
            {config.site.title}
          </span>
        ),
        url: '/',
      }}
      sidebar={{
        defaultOpenLevel: 1,
      }}
    >
      {children}
    </DocsLayout>
  );
}
