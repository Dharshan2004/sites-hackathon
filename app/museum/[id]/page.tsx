import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from 'cloudflare:workers';
import { MuseumExhibition } from '@/components/museum-exhibition';
import type { MuseumExhibit, MuseumRecord } from '@/lib/museum';

type MuseumRow = {
  id: string;
  title: string;
  subtitle: string;
  lens: string;
  exhibits_json: string;
};

const createTableSql = `CREATE TABLE IF NOT EXISTS museums (id TEXT PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT NOT NULL, lens TEXT NOT NULL, source_key TEXT NOT NULL, render_key TEXT NOT NULL, exhibits_json TEXT NOT NULL, created_at INTEGER NOT NULL)`;

async function getMuseum(id: string): Promise<MuseumRecord | null> {
  const bindings = env as unknown as { DB: D1Database };
  await bindings.DB.prepare(createTableSql).run();
  const row = await bindings.DB.prepare('SELECT id, title, subtitle, lens, exhibits_json FROM museums WHERE id = ?').bind(id).first<MuseumRow>();
  if (!row) return null;
  return { id: row.id, title: row.title, subtitle: row.subtitle, lens: row.lens, exhibits: JSON.parse(row.exhibits_json) as MuseumExhibit[], imageUrl: `/api/museums/${row.id}/image` };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const museum = await getMuseum(id);
  if (!museum) return { title: 'Museum not found — One Minute Museum' };
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const trustedOrigin = configuredOrigin && /^https:\/\/[a-z0-9.-]+$/i.test(configuredOrigin) ? configuredOrigin.replace(/\/$/, '') : null;
  const image = trustedOrigin ? `${trustedOrigin}/api/museums/${museum.id}/image` : undefined;
  return {
    title: `${museum.title} — One Minute Museum`,
    description: museum.subtitle,
    openGraph: { title: museum.title, description: museum.subtitle, images: image ? [{ url: image }] : [] },
  };
}

export default async function SharedMuseumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const museum = await getMuseum(id);
  if (!museum) notFound();
  return <MuseumExhibition result={museum} />;
}
