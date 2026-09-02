import { env } from 'cloudflare:workers';
import { fallbackMuseum, type MuseumExhibit } from '@/lib/museum';

type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  OPENAI_API_KEY?: string;
};

const createTableSql = `CREATE TABLE IF NOT EXISTS museums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  lens TEXT NOT NULL,
  source_key TEXT NOT NULL,
  render_key TEXT NOT NULL,
  exhibits_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`;

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function createCuration(apiKey: string, bytes: Uint8Array, mime: string, title: string, lens: string) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.6-luna',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: `Curate this photograph as a tiny ${lens} museum titled “${title}”. Describe only visible details. Never identify people, infer relationships, or invent sensitive facts. Return three concise exhibit labels with hotspot positions as percentages.` },
          { type: 'input_image', image_url: `data:${mime};base64,${bytesToBase64(bytes)}` },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'museum_curation',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              subtitle: { type: 'string' },
              exhibits: {
                type: 'array', minItems: 3, maxItems: 3,
                items: {
                  type: 'object', additionalProperties: false,
                  properties: {
                    title: { type: 'string' }, label: { type: 'string' },
                    x: { type: 'number', minimum: 10, maximum: 90 },
                    y: { type: 'number', minimum: 15, maximum: 85 },
                  },
                  required: ['title', 'label', 'x', 'y'],
                },
              },
            },
            required: ['subtitle', 'exhibits'],
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`Curation failed (${response.status})`);
  const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  const text = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
  if (!text) throw new Error('Curation returned no text');
  const parsed = JSON.parse(text) as { subtitle: string; exhibits: Array<Omit<MuseumExhibit, 'number'>> };
  return { subtitle: parsed.subtitle, exhibits: parsed.exhibits.map((item, index) => ({ ...item, number: String(index + 1).padStart(2, '0') })) };
}

async function createDiorama(apiKey: string, source: File, lens: string) {
  const direction = {
    poetic: 'quiet, intimate, warm amber light, tactile wood and plaster, with the emotional tone of a cherished memory',
    cinematic: 'dramatic but elegant, with controlled contrast, volumetric gallery light, and a strong visual journey through the room',
    future: 'a refined speculative archive, with museum-grade glass, restrained luminous accents, and archaeological precision',
  }[lens] ?? 'warm, intimate, and museum-like';
  const body = new FormData();
  body.append('model', 'gpt-image-2');
  body.append('image', source, source.name || 'source.jpg');
  body.append('size', '1536x1024');
  body.append('quality', 'high');
  body.append('output_format', 'png');
  body.append('prompt', `Create one polished landscape isometric miniature art museum that curates the supplied photograph.

ANCHOR ARTWORK: Display the supplied photograph faithfully as the museum's large hero artwork, projection, or installation. Its main subject, people, distinctive objects, colours, composition, and emotional atmosphere must remain immediately recognizable. Do not repaint it into an unrelated scene, alter identities, or invent a different event.

MUSEUM ARCHITECTURE: Build a believable contemporary museum gallery as a single open-front architectural cutaway, viewed from an elevated three-quarter isometric angle. Use proper gallery proportions, track lighting, stone or polished concrete flooring, plaster walls, museum glass, restrained barriers, elegant plinths, and generous negative space. This must read as an actual curated museum—not a bedroom, house, toy shop, fantasy village, or generic dollhouse.

EXHIBITION DESIGN: The anchor artwork is the focal point. Create exactly three visually distinct exhibit zones around it. Each supporting zone should isolate a real, visible detail from the source as a tasteful museum object, material study, light installation, projection, or sculptural interpretation. Keep the relationship to the uploaded photograph obvious and specific. Include one or two tiny anonymous visitors only for scale, never as new story characters.

ART DIRECTION: ${direction}. Premium stylized 3D render, subtle tilt-shift depth, tactile miniature materials, realistic scale, elegant gallery spotlights, restrained atmospheric dust, sophisticated editorial finish. Warm ochre, terracotta, walnut, cream, and deep forest tones should adapt to—not overwrite—the source palette.

AVOID: no written text, captions, signage, logos, watermarks, UI, borders, crowds, extra limbs, duplicate subjects, recognizable copyrighted characters, fantasy clutter, domestic furniture, fisheye distortion, enclosed roof, or extreme blur. The final image must read immediately as a refined museum exhibition built around this specific photograph.`);
  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body,
  });
  if (!response.ok) throw new Error(`Render failed (${response.status})`);
  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) throw new Error('Render returned no image');
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

export async function POST(request: Request) {
  const bindings = env as unknown as Bindings;
  const form = await request.formData();
  const photo = form.get('photo');
  const rawTitle = form.get('title');
  const rawLens = form.get('lens');
  const title = (typeof rawTitle === 'string' ? rawTitle : 'Untitled moment').slice(0, 80);
  const lens = (typeof rawLens === 'string' ? rawLens : 'poetic').slice(0, 20);
  if (!(photo instanceof File) || !photo.type.startsWith('image/') || photo.size > 900 * 1024) {
    return Response.json({ error: 'Choose a JPG, PNG, or WEBP under 900 KB after browser optimization.' }, { status: 400 });
  }

  if (!bindings.OPENAI_API_KEY) {
    return Response.json({ error: 'AI rendering is not connected yet. Add OPENAI_API_KEY in Site settings, then try again.' }, { status: 503 });
  }

  const id = crypto.randomUUID();
  const sourceBytes = new Uint8Array(await photo.arrayBuffer());
  const sourceKey = `museums/${id}/source`;
  const renderKey = `museums/${id}/render.png`;
  let curation = fallbackMuseum(title, lens);
  let renderBytes = sourceBytes;
  let generated = false;

  const [curationResult, renderResult] = await Promise.allSettled([
    createCuration(bindings.OPENAI_API_KEY, sourceBytes, photo.type, title, lens),
    createDiorama(bindings.OPENAI_API_KEY, photo, lens),
  ]);
  if (curationResult.status === 'fulfilled') curation = { ...curation, ...curationResult.value };
  if (renderResult.status === 'rejected') {
    return Response.json({ error: 'The AI could not build this museum. Try a clearer photo or try again.' }, { status: 502 });
  }
  renderBytes = renderResult.value; generated = true;

  await bindings.FILES.put(sourceKey, sourceBytes, { httpMetadata: { contentType: photo.type } });
  await bindings.FILES.put(renderKey, renderBytes, { httpMetadata: { contentType: generated ? 'image/png' : photo.type } });
  await bindings.DB.prepare(createTableSql).run();
  await bindings.DB.prepare(`INSERT INTO museums (id, title, subtitle, lens, source_key, render_key, exhibits_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, title, curation.subtitle, lens, sourceKey, renderKey, JSON.stringify(curation.exhibits), Date.now(),
  ).run();

  return Response.json({ id, title, subtitle: curation.subtitle, lens, exhibits: curation.exhibits, imageUrl: `/api/museums/${id}/image`, generated });
}
