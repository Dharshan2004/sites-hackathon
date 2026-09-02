import { env } from 'cloudflare:workers';
import { fallbackMuseum } from '@/lib/museum';

type Bindings = { DB: D1Database; FILES: R2Bucket; OPENAI_API_KEY?: string };

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: corsHeaders });
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
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, background: true, store: true }),
  });
  const result = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !result.id) throw new Error(result.error?.message || `OpenAI request failed (${response.status})`);
  return result.id;
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
  const title = (typeof rawTitle === 'string' ? rawTitle : 'Untitled moment').slice(0, 80);
  const lens = (typeof rawLens === 'string' ? rawLens : 'art-deco').slice(0, 24);
  if (!(photo instanceof File) || !photo.type.startsWith('image/') || photo.size > 900 * 1024) {
    return json({ error: 'Choose a JPG, PNG, or WEBP under 900 KB after browser optimization.' }, { status: 400 });
  }
  if (!bindings.OPENAI_API_KEY) return json({ error: 'AI rendering is not connected yet. Add OPENAI_API_KEY in Site settings, then try again.' }, { status: 503 });

  const id = crypto.randomUUID();
  const sourceBytes = new Uint8Array(await photo.arrayBuffer());
  const dataUrl = `data:${photo.type};base64,${bytesToBase64(sourceBytes)}`;
  const sourceKey = `museums/${id}/source.webp`;
  const renderKey = `museums/${id}/render.jpg`;
  const fallback = fallbackMuseum(title, lens);

  try {
    await bindings.FILES.put(sourceKey, sourceBytes, { httpMetadata: { contentType: photo.type } });
    await bindings.DB.prepare(createTableSql).run();
    const renderResponseId = await startBackgroundResponse(bindings.OPENAI_API_KEY, {
      model: 'gpt-5.6-luna',
      input: [{ role: 'user', content: [{ type: 'input_text', text: renderPrompt(lens) }, { type: 'input_image', image_url: dataUrl, detail: 'high' }] }],
      tools: [{ type: 'image_generation', action: 'edit', quality: 'high', size: '1536x1024', output_format: 'jpeg', output_compression: 82 }],
    });

    const now = Date.now();
    await bindings.DB.prepare(`INSERT INTO museums (id, title, subtitle, lens, source_key, render_key, exhibits_json, status, render_response_id, curation_response_id, error, phase_updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'rendering', ?, NULL, NULL, ?, ?)`).bind(
      id, title, fallback.subtitle, lens, sourceKey, renderKey, JSON.stringify(fallback.exhibits), renderResponseId, now, now,
    ).run();
    return json({ id, status: 'processing', message: 'The gallery architects are drawing the first elevation.' }, { status: 202 });
  } catch (error) {
    console.error('Museum render start failed', error);
    return json({ error: 'The museum could not start rendering. Check the API key and try again.' }, { status: 502 });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
