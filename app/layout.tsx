import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'One Minute Museum | Turn a photo into an exhibition',
  description: 'Upload a photograph and curate it into a tiny interactive museum, complete with a shareable Story card.',
  openGraph: {
    title: 'One Minute Museum',
    description: 'Turn a photograph into a tiny interactive exhibition in one minute.',
    images: [{ url: '/og.png', width: 1728, height: 910, alt: 'A warm miniature cutaway museum' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'One Minute Museum',
    description: 'Turn a photograph into a tiny interactive exhibition in one minute.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
