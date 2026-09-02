import { env } from 'cloudflare:workers';
import type { MuseumExhibit } from '@/lib/museum';

type Bindings = { DB: D1Database; FILES: R2Bucket; OPENAI_API_KEY?: string };
type MuseumJob = {
  id: string; title: string; subtitle: string; lens: string; render_key: string; exhibits_json: string;
  status: string; render_response_id: string | null; curation_response_id: string | null; created_at: number;
};
type OpenAIResponse = {
  status?: string;
  error?: { message?: string } | null;
  output?: Array<{ type?: string; result?: string; content?: Array<{ type?: string; text?: string }> }>;
};

async function retrieve(apiKey: string, id: string) {
  const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const payload = await response.json() as OpenAIResponse;
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI status failed (${response.status})`);
  return payload;
}

function decodeBase64(encoded: string) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function readyRecord(row: MuseumJob) {
  return { id: row.id, title: row.title, subtitle: row.subtitle, lens: row.lens, exhibits: JSON.parse(row.exhibits_json) as MuseumExhibit[], imageUrl: `/api/museums/${row.id}/image`, generated: true };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bindings = env as unknown as Bindings;
  const row = await bindings.DB.prepare('SELECT id, title, subtitle, lens, render_key, exhibits_json, status, render_response_id, curation_response_id, created_at FROM museums WHERE id = ?').bind(id).first<MuseumJob>();
  if (!row) return Response.json({ error: 'Museum not found.' }, { status: 404 });
  if (row.status === 'ready') return Response.json(readyRecord(row));
  if (row.status === 'failed') return Response.json({ error: 'The AI could not finish this museum. Try another photograph.' }, { status: 502 });
  if (!bindings.OPENAI_API_KEY || !row.render_response_id || !row.curation_response_id) return Response.json({ error: 'This museum job cannot continue.' }, { status: 500 });

  try {
    const [render, curation] = await Promise.all([retrieve(bindings.OPENAI_API_KEY, row.render_response_id), retrieve(bindings.OPENAI_API_KEY, row.curation_response_id)]);
    if (render.status === 'failed' || render.status === 'cancelled') {
      await bindings.DB.prepare("UPDATE museums SET status = 'failed', error = ? WHERE id = ?").bind(render.error?.message || 'Render failed', id).run();
      return Response.json({ error: 'The AI could not finish this museum. Try another photograph.' }, { status: 502 });
    }
    if (render.status !== 'completed') {
      const elapsed = Math.floor((Date.now() - row.created_at) / 1000);
      return Response.json({ id, status: 'processing', message: elapsed > 55 ? 'Lighting the final gallery. Detailed renders can take about two minutes.' : 'Constructing your architectural world.' }, { status: 202 });
    }

    const image = render.output?.find((item) => item.type === 'image_generation_call')?.result;
    if (!image) throw new Error('Completed response had no image');
    let subtitle = row.subtitle;
    let exhibits = JSON.parse(row.exhibits_json) as MuseumExhibit[];
    if (curation.status === 'completed') {
      const text = curation.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
      if (text) {
        const parsed = JSON.parse(text) as { subtitle: string; exhibits: Array<Omit<MuseumExhibit, 'number'>> };
        subtitle = parsed.subtitle;
        exhibits = parsed.exhibits.map((item, index) => ({ ...item, number: String(index + 1).padStart(2, '0') }));
      }
    } else if (curation.status !== 'failed' && curation.status !== 'cancelled') {
      return Response.json({ id, status: 'processing', message: 'The curator is writing your exhibit labels.' }, { status: 202 });
    }

    await bindings.FILES.put(row.render_key, decodeBase64(image), { httpMetadata: { contentType: 'image/png' } });
    await bindings.DB.prepare("UPDATE museums SET subtitle = ?, exhibits_json = ?, status = 'ready', error = NULL WHERE id = ?").bind(subtitle, JSON.stringify(exhibits), id).run();
    return Response.json(readyRecord({ ...row, subtitle, exhibits_json: JSON.stringify(exhibits), status: 'ready' }));
  } catch {
    return Response.json({ error: 'The museum status could not be checked. Please try again.' }, { status: 502 });
  }
}
