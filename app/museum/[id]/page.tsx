import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from 'cloudflare:workers';
import { MuseumExhibition } from '@/components/museum-exhibition';
import type { MuseumExhibit, MuseumRecord } from '@/lib/museum';
import { PUBLIC_SITE_ORIGIN } from '@/lib/site-url';

type MuseumRow = {
  id: string;
  title: string;
  subtitle: string;
  alt_text: string;
  lens: string;
  exhibits_json: string;
  status: string;
};

const createTableSql = `CREATE TABLE IF NOT EXISTS museums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT 'An isometric miniature museum generated from an uploaded photograph.',
  lens TEXT NOT NULL,
  source_key TEXT NOT NULL,
  render_key TEXT NOT NULL,
  exhibits_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  render_response_id TEXT,
  curation_response_id TEXT,
  error TEXT,
  phase_updated_at INTEGER,
  created_at INTEGER NOT NULL
)`;

async function getMuseum(id: string): Promise<MuseumRecord | null> {
  const bindings = env as unknown as { DB: D1Database };
  await bindings.DB.prepare(createTableSql).run();
  const row = await bindings.DB.prepare("SELECT id, title, subtitle, alt_text, lens, exhibits_json, status FROM museums WHERE id = ? AND status IN ('ready', 'ready_unmapped')").bind(id).first<MuseumRow>();
  if (!row) return null;
  return { id: row.id, title: row.title, subtitle: row.subtitle, altText: row.alt_text, lens: row.lens, exhibits: JSON.parse(row.exhibits_json) as MuseumExhibit[], imageUrl: `/api/museums/${row.id}/image`, mapped: row.status === 'ready' };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const museum = await getMuseum(id);
  if (!museum) return { title: 'Museum not found | One Minute Museum' };
  const pageUrl = `${PUBLIC_SITE_ORIGIN}/museum/${museum.id}`;
  const image = `${PUBLIC_SITE_ORIGIN}/api/museums/${museum.id}/image`;
  return {
    title: `${museum.title} | One Minute Museum`,
    description: museum.subtitle,
    robots: { index: false, follow: false },
    alternates: { canonical: pageUrl },
    openGraph: {
      title: `${museum.title} | One Minute Museum`,
      description: museum.subtitle,
      url: pageUrl,
      siteName: 'One Minute Museum',
      type: 'website',
      images: [{ url: image, alt: museum.altText }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${museum.title} | One Minute Museum`,
      description: museum.subtitle,
      images: [image],
    },
  };
}

export default async function SharedMuseumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const museum = await getMuseum(id);
  if (!museum) notFound();
  return <MuseumExhibition result={museum} />;
}
