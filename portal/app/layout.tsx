import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import type { ReactNode } from 'react';
import { getPortalConfig } from '@/lib/config';
import './global.css';

export async function generateMetadata(): Promise<Metadata> {
  const config = getPortalConfig();
  return {
    title: {
      template: `%s | ${config.site.title}`,
      default: config.site.title,
    },
    description: config.site.description,
  };
}

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
