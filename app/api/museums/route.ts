import { env } from 'cloudflare:workers';
import { getArchitecture } from '@/lib/architectures';
import { fallbackMuseum } from '@/lib/museum';
import { PUBLIC_SITE_ORIGIN } from '@/lib/site-url';

type Bindings = { DB: D1Database; FILES: R2Bucket; OPENAI_API_KEY?: string };

const allowedOrigins = new Set([PUBLIC_SITE_ORIGIN, 'https://one-minute-museum.dharshanlab.chatgpt.site']);
const maxCreatesPerMinute = 12;
const maxCreatesPerHour = 100;

function corsHeaders(request: Request) {
  const headers = new Headers({ Vary: 'Origin' });
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigins.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
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

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

async function startBackgroundResponse(apiKey: string, payload: Record<string, unknown>) {
  const response = await fetchWithDeadline('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, background: true, store: true }),
  }, 35_000);
  const result = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !result.id) throw new Error(result.error?.message || `OpenAI request failed (${response.status})`);
  return result.id;
}

async function fetchWithDeadline(input: RequestInfo | URL, init: RequestInit, timeout: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('OpenAI request timed out'), timeout);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function renderPrompt(lens: string) {
  const direction = {
    gothic: 'Gothic architecture: pointed arches, ribbed vaults, tracery, stained-glass colour, carved stone, gargoyle motifs, and dramatic pools of darkness',
    'art-deco': 'Art Deco architecture: strict symmetry, stepped geometry, brass and black lacquer, sunburst motifs, polished stone, and glamorous 1920s illumination',
    'art-nouveau': 'Art Nouveau architecture: flowing botanical ironwork, vines, flowers, curved ornamental lines, coloured glass, and organic spatial rhythm',
    brutalism: 'Brutalist architecture: monumental exposed concrete, deep geometric voids, massive cantilevers, raw texture, and stark directional light',
    bauhaus: 'Bauhaus architecture: functional grids, primary red yellow and blue accents, circles and rectangles, clean white planes, steel, and balanced asymmetry',
    moorish: 'Moorish architecture: horseshoe arches, intricate non-figurative geometry, carved plaster, mosaic tile, courtyards, and repeating patterns handled with cultural respect',
    'ancient-egyptian': 'Ancient Egyptian monumental architecture: sandstone pylons, papyrus columns, gold accents, processional symmetry, sacred solar geometry, and historically inspired non-readable relief patterns',
    solarpunk: 'Neo-futurist solarpunk architecture: sweeping white curves, planted terraces, translucent solar surfaces, living greenery, daylight, water, and optimistic regenerative design',
  }[lens] ?? 'warm, intimate, and museum-like';

  return `Create one polished landscape isometric miniature art museum that curates the supplied photograph.

ANCHOR ARTWORK: Display the supplied photograph faithfully as the museum's large hero artwork, projection, or installation. Its main subject, people, distinctive objects, colours, composition, and emotional atmosphere must remain immediately recognizable. Do not repaint it into an unrelated scene, alter identities, or invent a different event.

MUSEUM ARCHITECTURE: Build a believable museum gallery as a single open-front architectural cutaway, viewed from an elevated three-quarter isometric angle. Use proper gallery proportions, track lighting, museum glass, elegant plinths, and generous negative space. It must read as an actual curated museum, never a bedroom, house, toy shop, fantasy village, or generic dollhouse.

EXHIBITION DESIGN: Make the anchor artwork the focal point. Create exactly three visually distinct exhibit zones around it, each isolating a real visible detail from the source as a museum object, material study, light installation, projection, or sculpture. Keep the zones spatially separated and easy to identify. Include at most two tiny anonymous visitors for scale.

ART DIRECTION: ${direction}. Premium stylized 3D render, subtle tilt-shift depth, tactile miniature materials, realistic scale, elegant gallery spotlights, restrained atmospheric dust, and a sophisticated editorial finish. Adapt to rather than overwrite the source palette.

AVOID: no written text, captions, signage, logos, watermarks, UI, borders, crowds, extra limbs, duplicate subjects, copyrighted characters, fantasy clutter, domestic furniture, fisheye distortion, enclosed roof, or extreme blur. The final image must read immediately as a refined museum exhibition built around this specific photograph.`;
}

export async function POST(request: Request) {
  const bindings = env as unknown as Bindings;
  const form = await request.formData();
  const photo = form.get('photo');
  const rawTitle = form.get('title');
  const rawLens = form.get('lens');
  const title = (typeof rawTitle === 'string' ? rawTitle.trim() : '').slice(0, 80) || 'Untitled moment';
  const lens = getArchitecture(typeof rawLens === 'string' ? rawLens : 'art-deco').id;
  if (!(photo instanceof File) || !photo.type.startsWith('image/') || photo.size > 900 * 1024) {
    return json(request, { error: 'Choose a JPG, PNG, or WEBP under 900 KB after browser optimization.' }, { status: 400 });
  }
  if (!bindings.OPENAI_API_KEY) return json(request, { error: 'AI rendering is not connected yet. Add OPENAI_API_KEY in Site settings, then try again.' }, { status: 503 });

  const id = crypto.randomUUID();
  const sourceBytes = new Uint8Array(await photo.arrayBuffer());
  const dataUrl = `data:${photo.type};base64,${bytesToBase64(sourceBytes)}`;
  const sourceKey = `museums/${id}/source.webp`;
  const renderKey = `museums/${id}/render.jpg`;
  const fallback = fallbackMuseum(title, lens);
  let rowCreated = false;

  try {
    await bindings.DB.prepare(createTableSql).run();
    const now = Date.now();
    const usage = await bindings.DB.prepare(`SELECT
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS minute_count,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS hour_count
      FROM museums WHERE status != 'failed'`)
      .bind(now - 60_000, now - 60 * 60_000)
      .first<{ minute_count: number | null; hour_count: number | null }>();
    if ((usage?.minute_count ?? 0) >= maxCreatesPerMinute || (usage?.hour_count ?? 0) >= maxCreatesPerHour) {
      return json(request, { error: 'The museum studio is at capacity right now. Tour the example and try your photograph again shortly.' }, { status: 429 });
    }

    await bindings.FILES.put(sourceKey, sourceBytes, { httpMetadata: { contentType: photo.type } });
    await bindings.DB.prepare(`INSERT INTO museums (id, title, subtitle, lens, source_key, render_key, exhibits_json, status, render_response_id, curation_response_id, error, phase_updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'render_starting', NULL, NULL, NULL, ?, ?)`).bind(
      id, title, fallback.subtitle, lens, sourceKey, renderKey, JSON.stringify(fallback.exhibits), now, now,
    ).run();
    rowCreated = true;

    const renderResponseId = await startBackgroundResponse(bindings.OPENAI_API_KEY, {
      model: 'gpt-5.6-luna',
      input: [{ role: 'user', content: [{ type: 'input_text', text: renderPrompt(lens) }, { type: 'input_image', image_url: dataUrl, detail: 'high' }] }],
      tools: [{ type: 'image_generation', action: 'edit', quality: 'high', size: '1536x1024', output_format: 'jpeg', output_compression: 82 }],
    });
    const started = await bindings.DB.prepare("UPDATE museums SET status = 'rendering', render_response_id = ?, phase_updated_at = ? WHERE id = ? AND status = 'render_starting' AND render_response_id IS NULL").bind(
      renderResponseId, Date.now(), id,
    ).run();
    if ((started.meta.changes ?? 0) !== 1) throw new Error('The museum job could not save its render reference.');
    return json(request, { id, status: 'processing', message: 'The gallery architects are drawing the first elevation.' }, { status: 202 });
  } catch (error) {
    console.error('Museum render start failed', error);
    if (rowCreated) {
      await bindings.DB.prepare("UPDATE museums SET status = 'failed', error = ?, phase_updated_at = ? WHERE id = ? AND status = 'render_starting'")
        .bind(error instanceof Error ? error.message.slice(0, 500) : 'Render start failed', Date.now(), id)
        .run()
        .catch(() => undefined);
    }
    return json(request, { error: 'The museum could not start rendering. Check the connection and try again.' }, { status: 502 });
  }
}

export function OPTIONS(request: Request) {
  const headers = corsHeaders(request);
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return new Response(null, { status: 204, headers });
}
