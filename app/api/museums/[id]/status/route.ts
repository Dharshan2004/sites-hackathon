import { env } from 'cloudflare:workers';
import type { MuseumExhibit } from '@/lib/museum';

type Bindings = { DB: D1Database; FILES: R2Bucket; OPENAI_API_KEY?: string };

type MuseumJob = {
  id: string;
  title: string;
  subtitle: string;
  lens: string;
  source_key: string;
  render_key: string;
  exhibits_json: string;
  status: string;
  render_response_id: string | null;
  curation_response_id: string | null;
  error: string | null;
  phase_updated_at: number | null;
  created_at: number;
};

type OpenAIResponse = {
  status?: string;
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
  output?: Array<{
    type?: string;
    result?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

type CurationPayload = {
  subtitle: string;
  exhibits: Array<Omit<MuseumExhibit, 'number'>>;
};

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
const failedStatuses = new Set(['failed', 'cancelled', 'incomplete']);
const jobSelect = 'SELECT id, title, subtitle, lens, source_key, render_key, exhibits_json, status, render_response_id, curation_response_id, error, phase_updated_at, created_at FROM museums WHERE id = ?';

class OpenAIRequestError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs: number) {
    super(message);
    this.name = 'OpenAIRequestError';
  }

  get retryable() {
    return this.status === 429 || this.status >= 500;
  }
}

function isReadyStatus(status: string | undefined) {
  return status === 'ready' || status === 'ready_unmapped';
}

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  return Response.json(data, { ...init, headers });
}

function processing(id: string, message: string, retryAfterMs?: number) {
  const headers = retryAfterMs ? { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } : undefined;
  return json({ id, status: 'processing', message, retryAfterMs }, { status: 202, headers });
}

async function retrieve(apiKey: string, id: string) {
  const response = await fetchWithDeadline(`https://api.openai.com/v1/responses/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }, 18_000);
  const text = await response.text();
  let payload: OpenAIResponse = {};
  try { payload = JSON.parse(text) as OpenAIResponse; } catch { /* The status below still controls retry behavior. */ }
  if (!response.ok) throw new OpenAIRequestError(
    payload.error?.message || `OpenAI status failed (${response.status})`,
    response.status,
    retryDelay(response),
  );
  if (!text) throw new Error('OpenAI returned an empty status response.');
  return payload;
}

async function startBackgroundResponse(apiKey: string, payload: Record<string, unknown>) {
  const response = await fetchWithDeadline('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, background: true, store: true }),
  }, 30_000);
  const text = await response.text();
  let result: { id?: string; error?: { message?: string } } = {};
  try { result = JSON.parse(text) as { id?: string; error?: { message?: string } }; } catch { /* The status below still controls retry behavior. */ }
  if (!response.ok) throw new OpenAIRequestError(
    result.error?.message || `OpenAI request failed (${response.status})`,
    response.status,
    retryDelay(response),
  );
  if (!result.id) throw new Error('OpenAI did not return a response reference.');
  return result.id;
}

function retryDelay(response: Response) {
  const retryAfter = Number.parseFloat(response.headers.get('Retry-After') ?? '');
  return Number.isFinite(retryAfter) ? Math.min(60_000, Math.max(5_000, retryAfter * 1000)) : 12_000;
}

async function fetchWithDeadline(input: RequestInfo | URL, init: RequestInit, timeout: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('OpenAI request timed out.', 'TimeoutError')), timeout);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function decodeBase64(encoded: string) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function imageResult(response: OpenAIResponse) {
  return response.output?.find((item) => item.type === 'image_generation_call')?.result;
}

function renderContentType(row: MuseumJob) {
  return row.render_key.endsWith('.jpg') || row.render_key.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
}

function outputText(response: OpenAIResponse) {
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === 'output_text')
    ?.text;
}

function readyRecord(row: MuseumJob) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    lens: row.lens,
    exhibits: JSON.parse(row.exhibits_json) as MuseumExhibit[],
    imageUrl: `/api/museums/${row.id}/image`,
    generated: true,
    mapped: row.status === 'ready',
  };
}

function validateCuration(text: string): CurationPayload {
  const parsed = JSON.parse(text) as Partial<CurationPayload>;
  const subtitle = typeof parsed.subtitle === 'string' ? parsed.subtitle.trim().slice(0, 260) : '';
  if (subtitle.length < 4 || !Array.isArray(parsed.exhibits) || parsed.exhibits.length !== 3) {
    throw new Error('The curator returned an incomplete exhibition.');
  }

  const exhibits = parsed.exhibits.map((candidate, index) => {
    const title = typeof candidate?.title === 'string' ? candidate.title.trim().slice(0, 90) : '';
    const label = typeof candidate?.label === 'string' ? candidate.label.trim().slice(0, 300) : '';
    const x = candidate?.x;
    const y = candidate?.y;
    if (!title || !label || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Exhibit ${index + 1} is incomplete.`);
    }
    return { title, label, x: Math.min(93, Math.max(7, x)), y: Math.min(90, Math.max(10, y)) };
  });

  for (let first = 0; first < exhibits.length; first += 1) {
    for (let second = first + 1; second < exhibits.length; second += 1) {
      let distance = Math.hypot(exhibits[first].x - exhibits[second].x, exhibits[first].y - exhibits[second].y);
      let adjustment = 0;
      while (distance < 7 && adjustment < 3) {
        exhibits[second].x = Math.min(93, Math.max(7, exhibits[second].x + (second % 2 === 0 ? -8 : 8)));
        exhibits[second].y = Math.min(90, Math.max(10, exhibits[second].y + (second % 2 === 0 ? 5 : -5)));
        distance = Math.hypot(exhibits[first].x - exhibits[second].x, exhibits[first].y - exhibits[second].y);
        adjustment += 1;
      }
    }
  }

  return { subtitle, exhibits };
}

function numberedExhibits(exhibits: CurationPayload['exhibits']): MuseumExhibit[] {
  return exhibits.map((exhibit, index) => ({ ...exhibit, number: String(index + 1).padStart(2, '0') }));
}

async function markFailed(bindings: Bindings, id: string, reason: string) {
  const failed = await bindings.DB.prepare("UPDATE museums SET status = 'failed', error = ?, phase_updated_at = ? WHERE id = ? AND status NOT IN ('ready', 'ready_unmapped', 'failed')")
    .bind(reason.slice(0, 500), Date.now(), id)
    .run();
  if ((failed.meta.changes ?? 0) === 0) {
    const latest = await bindings.DB.prepare(jobSelect).bind(id).first<MuseumJob>();
    if (isReadyStatus(latest?.status)) return json(readyRecord(latest as MuseumJob));
  }
  return json({ error: 'The AI could not finish this museum. Try another photograph or open the example.' }, { status: 502 });
}

async function finishWithFallbackCuration(bindings: Bindings, row: MuseumJob, reason: string) {
  console.error('Museum curation fell back to the prepared labels', reason);
  const completed = await bindings.DB.prepare("UPDATE museums SET status = 'ready_unmapped', error = ?, phase_updated_at = ? WHERE id = ? AND status IN ('rendered', 'curation_starting', 'curating')")
    .bind(reason.slice(0, 500), Date.now(), row.id)
    .run();
  if ((completed.meta.changes ?? 0) === 1) return json(readyRecord({ ...row, status: 'ready_unmapped' }));
  const latest = await bindings.DB.prepare(jobSelect).bind(row.id).first<MuseumJob>();
  return isReadyStatus(latest?.status) ? json(readyRecord(latest as MuseumJob)) : markFailed(bindings, row.id, reason);
}

function curationPrompt(row: MuseumJob) {
  return `You are curating interactive labels for the exact finished museum render attached below. The museum is titled "${row.title}" and uses ${row.lens.replaceAll('-', ' ')} architecture.

Select exactly three visually distinct exhibit zones that are clearly present in this finished render. Prefer the three derived object, material, projection, sculpture, or light-installation zones around the anchor photograph. Do not place a hotspot on the anchor photograph itself unless fewer than three separate derived exhibits are visible.

Coordinates must refer to this exact image. x is the percentage from its left edge. y is the percentage from its top edge. Target the visible center of each chosen exhibit. Keep coordinates inside the image and do not position them on labels, empty walls, visitors, or architectural voids.

Write one short atmospheric subtitle for the whole museum. Give each exhibit a concise title and a one-sentence label grounded only in what is visibly present. Never identify a person, infer relationships, or invent sensitive facts.`;
}

function curationRequest(row: MuseumJob, imageUrl: string) {
  return {
    model: 'gpt-5.6-luna',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: curationPrompt(row) },
        { type: 'input_image', image_url: imageUrl, detail: 'high' },
      ],
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'finished_museum_curation',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            subtitle: { type: 'string' },
            exhibits: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  title: { type: 'string' },
                  label: { type: 'string' },
                  x: { type: 'number', minimum: 7, maximum: 93 },
                  y: { type: 'number', minimum: 10, maximum: 90 },
                },
                required: ['title', 'label', 'x', 'y'],
              },
            },
          },
          required: ['subtitle', 'exhibits'],
        },
      },
    },
  };
}

async function finalRenderInput(bindings: Bindings, row: MuseumJob) {
  const object = await bindings.FILES.get(row.render_key);
  if (!object) throw new Error('The finished render is missing from storage.');
  const bytes = new Uint8Array(await object.arrayBuffer());
  return `data:${object.httpMetadata?.contentType || 'image/png'};base64,${bytesToBase64(bytes)}`;
}

async function finishLegacyJob(bindings: Bindings, row: MuseumJob) {
  const apiKey = bindings.OPENAI_API_KEY as string;
  const [render, curation] = await Promise.all([
    retrieve(apiKey, row.render_response_id as string),
    retrieve(apiKey, row.curation_response_id as string),
  ]);

  if (failedStatuses.has(render.status ?? '')) {
    return markFailed(bindings, row.id, render.error?.message || render.incomplete_details?.reason || 'Render failed');
  }
  if (render.status !== 'completed') return processing(row.id, 'Constructing your architectural world.');
  if (!failedStatuses.has(curation.status ?? '') && curation.status !== 'completed') {
    return processing(row.id, 'The curator is writing your exhibit labels.');
  }

  const image = imageResult(render);
  if (!image) return markFailed(bindings, row.id, 'Completed response had no image.');
  let subtitle = row.subtitle;
  let exhibits = JSON.parse(row.exhibits_json) as MuseumExhibit[];
  const text = outputText(curation);
  if (curation.status === 'completed' && text) {
    try {
      const curated = validateCuration(text);
      subtitle = curated.subtitle;
      exhibits = numberedExhibits(curated.exhibits);
    } catch {
      // Preserve the original fallback only for jobs started by the previous pipeline.
    }
  }

  await bindings.FILES.put(row.render_key, decodeBase64(image), { httpMetadata: { contentType: renderContentType(row) } });
  await bindings.DB.prepare("UPDATE museums SET subtitle = ?, exhibits_json = ?, status = 'ready', error = NULL, phase_updated_at = ? WHERE id = ? AND status = 'processing'")
    .bind(subtitle, JSON.stringify(exhibits), Date.now(), row.id)
    .run();
  return json(readyRecord({ ...row, subtitle, exhibits_json: JSON.stringify(exhibits), status: 'ready' }));
}

async function continueRender(bindings: Bindings, row: MuseumJob) {
  const render = await retrieve(bindings.OPENAI_API_KEY as string, row.render_response_id as string);
  if (failedStatuses.has(render.status ?? '')) {
    return markFailed(bindings, row.id, render.error?.message || render.incomplete_details?.reason || 'Render failed');
  }
  if (render.status !== 'completed') {
    const elapsed = Math.floor((Date.now() - row.created_at) / 1000);
    return processing(row.id, elapsed > 55
      ? 'Lighting the final gallery. Detailed renders can take about two minutes.'
      : 'Building the room around your photograph.');
  }

  const image = imageResult(render);
  if (!image) return markFailed(bindings, row.id, 'Completed response had no image.');
  await bindings.FILES.put(row.render_key, decodeBase64(image), { httpMetadata: { contentType: renderContentType(row) } });
  await bindings.DB.prepare("UPDATE museums SET status = 'rendered', error = NULL, phase_updated_at = ? WHERE id = ? AND status IN ('rendering', 'processing') AND curation_response_id IS NULL")
    .bind(Date.now(), row.id)
    .run();
  return processing(row.id, 'The room is built. Positioning each exhibit on the finished gallery.');
}

async function startCuration(_request: Request, bindings: Bindings, row: MuseumJob) {
  const claimed = await bindings.DB.prepare("UPDATE museums SET status = 'curation_starting' WHERE id = ? AND status = 'rendered' AND curation_response_id IS NULL")
    .bind(row.id)
    .run();
  if ((claimed.meta.changes ?? 0) !== 1) return processing(row.id, 'The curator is entering the finished room.');

  try {
    const imageUrl = await finalRenderInput(bindings, row);
    const responseId = await startBackgroundResponse(bindings.OPENAI_API_KEY as string, curationRequest(row, imageUrl));
    const persisted = await bindings.DB.prepare("UPDATE museums SET curation_response_id = ?, status = 'curating', error = NULL, phase_updated_at = ? WHERE id = ? AND status = 'curation_starting' AND curation_response_id IS NULL")
      .bind(responseId, Date.now(), row.id)
      .run();
    if ((persisted.meta.changes ?? 0) !== 1) {
      const latest = await bindings.DB.prepare(jobSelect).bind(row.id).first<MuseumJob>();
      if (isReadyStatus(latest?.status)) return json(readyRecord(latest as MuseumJob));
      return processing(row.id, 'The curator is confirming the gallery handoff.');
    }
    return processing(row.id, 'The curator is placing three labels on the finished museum.');
  } catch (error) {
    console.error('Museum curation start failed', error);
    if (error instanceof OpenAIRequestError && error.retryable) {
      return processing(row.id, 'OpenAI is briefly busy. The finished room is safe, and the curator will retry.', error.retryAfterMs);
    }
    if (error instanceof TypeError || (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))) {
      return processing(row.id, 'The curator is reconnecting to the finished gallery.');
    }
    return finishWithFallbackCuration(bindings, row, error instanceof Error ? error.message : 'Curation could not start.');
  }
}

async function continueCuration(bindings: Bindings, row: MuseumJob) {
  if (!row.curation_response_id) return markFailed(bindings, row.id, 'The curator response is missing.');
  const curation = await retrieve(bindings.OPENAI_API_KEY as string, row.curation_response_id);
  if (failedStatuses.has(curation.status ?? '')) {
    return finishWithFallbackCuration(bindings, row, curation.error?.message || curation.incomplete_details?.reason || 'Curation failed');
  }
  if (curation.status !== 'completed') return processing(row.id, 'Writing the wall labels and checking their positions.');

  const text = outputText(curation);
  if (!text) return finishWithFallbackCuration(bindings, row, 'Completed curation had no text.');
  let curated: CurationPayload;
  try {
    curated = validateCuration(text);
  } catch (error) {
    return finishWithFallbackCuration(bindings, row, error instanceof Error ? error.message : 'Curation validation failed.');
  }

  const exhibits = numberedExhibits(curated.exhibits);
  const completed = await bindings.DB.prepare("UPDATE museums SET subtitle = ?, exhibits_json = ?, status = 'ready', error = NULL, phase_updated_at = ? WHERE id = ? AND status = 'curating' AND curation_response_id = ?")
    .bind(curated.subtitle, JSON.stringify(exhibits), Date.now(), row.id, row.curation_response_id)
    .run();
  if ((completed.meta.changes ?? 0) === 1) {
    return json(readyRecord({ ...row, subtitle: curated.subtitle, exhibits_json: JSON.stringify(exhibits), status: 'ready' }));
  }

  const latest = await bindings.DB.prepare(jobSelect)
    .bind(row.id)
    .first<MuseumJob>();
  return isReadyStatus(latest?.status) ? json(readyRecord(latest as MuseumJob)) : processing(row.id, 'Opening the finished exhibition.');
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bindings = env as unknown as Bindings;
  let row: MuseumJob | null;
  try {
    row = await bindings.DB.prepare(jobSelect).bind(id).first<MuseumJob>();
  } catch (error) {
    console.error('Museum database read failed', error);
    return json({ error: 'The museum database is being upgraded. Please retry in a moment.' }, { status: 503 });
  }

  if (!row) return json({ error: 'Museum not found.' }, { status: 404 });
  if (isReadyStatus(row.status)) return json(readyRecord(row));
  if (row.status === 'failed') {
    return json({ error: 'The AI could not finish this museum. Try another photograph or open the example.' }, { status: 502 });
  }
  const phaseAge = Date.now() - (row.phase_updated_at ?? row.created_at);
  const curationStatuses = new Set(['rendered', 'curation_starting', 'curating']);
  if ((row.status === 'rendering' || (row.status === 'processing' && !row.curation_response_id)) && Date.now() - row.created_at > 7 * 60_000) {
    return markFailed(bindings, row.id, 'Museum rendering exceeded its seven-minute deadline.');
  }
  if (curationStatuses.has(row.status) && phaseAge > 4 * 60_000) {
    return finishWithFallbackCuration(bindings, row, 'Exhibit mapping exceeded its four-minute deadline.');
  }
  if (!bindings.OPENAI_API_KEY) {
    if (curationStatuses.has(row.status)) return finishWithFallbackCuration(bindings, row, 'Visual curation is temporarily unavailable.');
    return markFailed(bindings, row.id, 'This museum job cannot continue.');
  }
  if (!row.render_response_id) {
    return markFailed(bindings, row.id, 'This museum job cannot continue.');
  }

  try {
    if (row.status === 'processing' && row.curation_response_id) return await finishLegacyJob(bindings, row);
    if (row.status === 'rendering' || (row.status === 'processing' && !row.curation_response_id)) {
      return await continueRender(bindings, row);
    }
    if (row.status === 'rendered') return await startCuration(request, bindings, row);
    if (row.status === 'curation_starting') {
      const phaseStarted = row.phase_updated_at ?? row.created_at;
      if (!row.curation_response_id && Date.now() - phaseStarted > 75_000) {
        await bindings.DB.prepare("UPDATE museums SET status = 'rendered' WHERE id = ? AND status = 'curation_starting' AND curation_response_id IS NULL AND COALESCE(phase_updated_at, created_at) < ?")
          .bind(row.id, Date.now() - 75_000)
          .run();
      }
      return processing(row.id, 'The curator is entering the finished room.');
    }
    if (row.status === 'curating') return await continueCuration(bindings, row);
    return markFailed(bindings, row.id, `Unknown museum state: ${row.status}`);
  } catch (error) {
    console.error('Museum status check paused', error);
    if (error instanceof OpenAIRequestError && error.retryable) {
      return processing(row.id, 'OpenAI is briefly busy. Your museum is safe, and we will try again.', error.retryAfterMs);
    }
    if (curationStatuses.has(row.status)) {
      return finishWithFallbackCuration(bindings, row, error instanceof Error ? error.message : 'Exhibit mapping could not finish.');
    }
    if (Date.now() - (row.phase_updated_at ?? row.created_at) > 8 * 60_000) {
      return markFailed(bindings, row.id, error instanceof Error ? error.message : 'Museum processing timed out.');
    }
    return processing(row.id, 'The gallery connection paused. Your museum is still safe, and we are reconnecting.');
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
}
