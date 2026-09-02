import type { Metadata } from 'next';
import { MuseumExhibition } from '@/components/museum-exhibition';
import { exampleMuseum } from '@/lib/museum';
import { PUBLIC_SITE_ORIGIN } from '@/lib/site-url';

const pageUrl = `${PUBLIC_SITE_ORIGIN}/museum/example-art-deco-bicycle`;
const imageUrl = `${PUBLIC_SITE_ORIGIN}/examples/art-deco-museum.jpg`;

export const metadata: Metadata = {
  title: `${exampleMuseum.title} | One Minute Museum`,
  description: exampleMuseum.subtitle,
  robots: { index: false, follow: false },
  alternates: { canonical: pageUrl },
  openGraph: {
    title: `${exampleMuseum.title} | One Minute Museum`,
    description: exampleMuseum.subtitle,
    url: pageUrl,
    siteName: 'One Minute Museum',
    type: 'website',
    images: [{ url: imageUrl, width: 1536, height: 1024, alt: 'An Art Deco miniature museum built around a red bicycle photograph' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${exampleMuseum.title} | One Minute Museum`,
    description: exampleMuseum.subtitle,
    images: [imageUrl],
  },
};

export default function ExampleMuseumPage() {
  return <MuseumExhibition result={exampleMuseum} />;
}
