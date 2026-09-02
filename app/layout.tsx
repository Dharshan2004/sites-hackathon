import type { Metadata, Viewport } from 'next';
import { PUBLIC_SITE_ORIGIN } from '@/lib/site-url';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  title: 'One Minute Museum | Turn a photo into an exhibition',
  description: 'Upload a photograph and curate it into a tiny interactive museum, complete with a shareable Story card.',
  applicationName: 'One Minute Museum',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'One Minute Museum',
    description: 'Turn a photograph into a tiny interactive exhibition in one minute.',
    url: PUBLIC_SITE_ORIGIN,
    siteName: 'One Minute Museum',
    type: 'website',
    images: [{ url: '/og.png', width: 1728, height: 910, alt: 'A warm miniature cutaway museum' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'One Minute Museum',
    description: 'Turn a photograph into a tiny interactive exhibition in one minute.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#171713',
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
