import { env } from 'cloudflare:workers';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bindings = env as unknown as { DB: D1Database; FILES: R2Bucket };
  await bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS museums (id TEXT PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT NOT NULL, lens TEXT NOT NULL, source_key TEXT NOT NULL, render_key TEXT NOT NULL, exhibits_json TEXT NOT NULL, created_at INTEGER NOT NULL)`).run();
  const row = await bindings.DB.prepare('SELECT render_key FROM museums WHERE id = ?').bind(id).first<{ render_key: string }>();
  if (!row) return new Response('Not found', { status: 404 });
  const object = await bindings.FILES.get(row.render_key);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
