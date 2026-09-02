import { env } from 'cloudflare:workers';
import { getArchitecture } from '@/lib/architectures';
import { fallbackMuseum } from '@/lib/museum';

type Bindings = { DB: D1Database; FILES: R2Bucket; OPENAI_API_KEY?: string };
type ExistingJob = { id: string; status: string };

const acceptedImages = new Set(['image/jpeg', 'image/png', 'image/webp']);
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function corsHeaders(request: Request) {
  const headers = new Headers({ Vary: 'Origin' });
  const origin = request.headers.get('Origin');
  if (origin && origin === new URL(request.url).origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function json(request: Request, data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  corsHeaders(request).forEach((value, key) => headers.set(key, value));
  return Response.json(data, { ...init, headers });
}

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

const createLimitsTableSql = `CREATE TABLE IF NOT EXISTS generation_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
)`;

function hasExpectedSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  return bytes.length >= 12
    && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
}

async function fingerprint(request: Request, visitorId: string) {
  const source = `${request.headers.get('CF-Connecting-IP') || 'unknown-client'}:${visitorId}`;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)));
  return Array.from(digest.subarray(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function consumeGenerationBudget(request: Request, database: D1Database, now: number, visitorId: string) {
  const visitor = await fingerprint(request, visitorId);
  const windows = [
    { bucket: `visitor:${visitor}:minute:${Math.floor(now / 60_000)}`, expiresAt: now + 2 * 60_000, limit: 6 },
    { bucket: `visitor:${visitor}:hour:${Math.floor(now / 3_600_000)}`, expiresAt: now + 2 * 3_600_000, limit: 24 },
    { bucket: `global:minute:${Math.floor(now / 60_000)}`, expiresAt: now + 2 * 60_000, limit: 10 },
    { bucket: `global:hour:${Math.floor(now / 3_600_000)}`, expiresAt: now + 2 * 3_600_000, limit: 40 },
  ];

  for (const window of windows) {
    const row = await database.prepare(`INSERT INTO generation_limits (bucket, count, expires_at)
      VALUES (?, 1, ?)
      ON CONFLICT(bucket) DO UPDATE SET count = count + 1
      RETURNING count`)
      .bind(window.bucket, window.expiresAt)
      .first<{ count: number }>();
    if ((row?.count ?? window.limit + 1) > window.limit) return false;
  }

  await database.prepare('DELETE FROM generation_limits WHERE expires_at < ?').bind(now).run().catch(() => undefined);
  return true;
}

async function cleanAbandonedSources(bindings: Bindings, now: number) {
  const stale = await bindings.DB.prepare("SELECT id, source_key FROM museums WHERE status IN ('uploading', 'queued', 'render_starting', 'failed') AND created_at < ? LIMIT 12")
    .bind(now - 30 * 60_000)
    .all<{ id: string; source_key: string }>()
    .catch(() => ({ results: [] }));
  for (const row of stale.results) {
    try {
      await bindings.FILES.delete(row.source_key);
    } catch {
      continue;
    }
    await bindings.DB.prepare("DELETE FROM museums WHERE id = ? AND status IN ('uploading', 'queued', 'render_starting', 'failed') AND created_at < ?")
      .bind(row.id, now - 30 * 60_000)
      .run()
      .catch(() => undefined);
  }
}

export async function POST(request: Request) {
  const bindings = env as unknown as Bindings;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(request, { error: 'The upload could not be read. Choose the photograph again.' }, { status: 400 });
  }

  const photo = form.get('photo');
  const rawTitle = form.get('title');
  const rawLens = form.get('lens');
  const rawRequestId = form.get('requestId');
  const rawVisitorId = form.get('visitorId');
  const title = (typeof rawTitle === 'string' ? rawTitle.trim() : '').slice(0, 80) || 'Untitled moment';
  const lens = getArchitecture(typeof rawLens === 'string' ? rawLens : 'art-deco').id;
  const id = typeof rawRequestId === 'string' && requestIdPattern.test(rawRequestId) ? rawRequestId : crypto.randomUUID();
  const visitorId = typeof rawVisitorId === 'string' && requestIdPattern.test(rawVisitorId) ? rawVisitorId : 'anonymous-session';

  if (!(photo instanceof File) || photo.size === 0 || photo.size > 900 * 1024 || !acceptedImages.has(photo.type)) {
    return json(request, { error: 'Choose a JPG, PNG, or WEBP under 900 KB after browser optimization.' }, { status: 400 });
  }
  if (!bindings.OPENAI_API_KEY) return json(request, { error: 'AI rendering is not connected yet. Add OPENAI_API_KEY in Site settings, then try again.' }, { status: 503 });

  const sourceBytes = new Uint8Array(await photo.arrayBuffer());
  if (!hasExpectedSignature(sourceBytes, photo.type)) {
    return json(request, { error: 'That file does not appear to be a valid JPG, PNG, or WEBP photograph.' }, { status: 400 });
  }

  await bindings.DB.prepare(createTableSql).run();
  await bindings.DB.prepare(createLimitsTableSql).run();
  await cleanAbandonedSources(bindings, Date.now());

  const existing = await bindings.DB.prepare('SELECT id, status FROM museums WHERE id = ?').bind(id).first<ExistingJob>();
  if (existing) {
    if (existing.status === 'failed') return json(request, { error: 'That generation attempt ended. Please try again.' }, { status: 409 });
    return json(request, { id, status: 'processing', message: 'Reconnected to your museum.' }, { status: 202 });
  }

  const now = Date.now();
  if (!await consumeGenerationBudget(request, bindings.DB, now, visitorId)) {
    return json(request, { error: 'The museum studio is at capacity right now. Tour the example and try your photograph again shortly.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const sourceKey = `museums/${id}/source`;
  const renderKey = `museums/${id}/render.jpg`;
  const fallback = fallbackMuseum(title, lens);

  try {
    await bindings.DB.prepare(`INSERT INTO museums (id, title, subtitle, alt_text, lens, source_key, render_key, exhibits_json, status, render_response_id, curation_response_id, error, phase_updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploading', NULL, NULL, NULL, ?, ?)`)
      .bind(id, title, fallback.subtitle, fallback.altText, lens, sourceKey, renderKey, JSON.stringify(fallback.exhibits), now, now)
      .run();
  } catch (error) {
    console.error('Museum queue claim paused', error);
    const concurrent = await bindings.DB.prepare('SELECT id, status FROM museums WHERE id = ?').bind(id).first<ExistingJob>().catch(() => null);
    if (concurrent && concurrent.status !== 'failed') {
      return json(request, { id, status: 'processing', message: 'Reconnected to your museum.' }, { status: 202 });
    }
    return json(request, { error: 'The museum could not enter the generation queue. Please try again.' }, { status: 502 });
  }

  try {
    await bindings.FILES.put(sourceKey, sourceBytes, { httpMetadata: { contentType: photo.type } });
    const queued = await bindings.DB.prepare("UPDATE museums SET status = 'queued', phase_updated_at = ? WHERE id = ? AND status = 'uploading'")
      .bind(Date.now(), id)
      .run();
    if ((queued.meta.changes ?? 0) !== 1) throw new Error('The secured museum ticket could not enter the render queue.');
    return json(request, { id, status: 'processing', message: 'Your museum ticket is secured. The architects are entering the studio.' }, { status: 202 });
  } catch (error) {
    console.error('Museum source storage failed', error);
    await bindings.FILES.delete(sourceKey).catch(() => undefined);
    await bindings.DB.prepare("UPDATE museums SET status = 'failed', error = ?, phase_updated_at = ? WHERE id = ? AND status = 'uploading'")
      .bind(error instanceof Error ? error.message.slice(0, 500) : 'Source storage failed', Date.now(), id)
      .run()
      .catch(() => undefined);
    return json(request, { error: 'The photograph could not be secured for rendering. Please try again.' }, { status: 502 });
  }
}

export function OPTIONS(request: Request) {
  const headers = corsHeaders(request);
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return new Response(null, { status: 204, headers });
}
