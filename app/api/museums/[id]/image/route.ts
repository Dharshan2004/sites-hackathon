import { env } from 'cloudflare:workers';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bindings = env as unknown as { DB: D1Database; FILES: R2Bucket };
  const row = await bindings.DB.prepare('SELECT render_key FROM museums WHERE id = ?').bind(id).first<{ render_key: string }>();
  if (!row) return new Response('Not found', { status: 404 });
  const object = await bindings.FILES.get(row.render_key);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'image/png', 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', 'Access-Control-Allow-Origin': '*' } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
