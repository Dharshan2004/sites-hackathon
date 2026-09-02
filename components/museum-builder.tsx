'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent, SyntheticEvent } from 'react';
import Image from 'next/image';
import { Aperture, ArrowRight, Dices, Eye, ImagePlus, LockKeyhole, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlueprintWorkshop, type WorkshopPhase } from '@/components/blueprint-workshop';
import { MuseumExhibition } from '@/components/museum-exhibition';
import { OpeningNightReveal } from '@/components/opening-night-reveal';
import { ARCHITECTURES, type ArchitectureId } from '@/lib/architectures';
import { exampleMuseum, type MuseumRecord } from '@/lib/museum';
import { siteUrl } from '@/lib/site-url';

type BuilderStatus = 'idle' | 'curating' | 'revealing' | 'ready';
type ActiveMuseumJob = { id: string; title: string; architecture: ArchitectureId; startedAt: number };

const activeJobKey = 'one-minute-museum.active-job';

export function MuseumBuilder() {
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const rouletteRun = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [architecture, setArchitecture] = useState<ArchitectureId>('art-deco');
  const [isRouletting, setIsRouletting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rouletteAnnouncement, setRouletteAnnouncement] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<BuilderStatus>('idle');
  const [result, setResult] = useState<MuseumRecord | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('Preparing your photograph.');
  const [progressPhase, setProgressPhase] = useState<WorkshopPhase>('preparing');
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const selectedWorld = ARCHITECTURES.find((item) => item.id === architecture) ?? ARCHITECTURES[0];

  useEffect(() => () => {
    rouletteRun.current += 1;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    const saved = readActiveJob();
    if (!saved) return;
    const controller = new AbortController();
    let active = true;
    const resume = async () => {
      await Promise.resolve();
      if (!active) return;
      setArchitecture(saved.architecture);
      setTitle(saved.title);
      setStartedAt(saved.startedAt);
      setProgressPhase('rendering');
      setProgress('Reopening the museum already in progress.');
      setStatus('curating');

      try {
        const museum = await waitForMuseum(saved.id, (message, phase) => {
          if (!active) return;
          setProgress(message);
          setProgressPhase(phase);
        }, controller.signal);
        if (!active) return;
        museum.imageUrl = siteUrl(museum.imageUrl);
        clearActiveJob();
        window.scrollTo({ top: 0, behavior: 'auto' });
        setResult(museum);
        setStatus('revealing');
      } catch (caught) {
        if (!active || isAbortError(caught)) return;
        if (!isTransientError(caught)) clearActiveJob();
        setError(caught instanceof Error ? caught.message : 'The museum could not be reopened.');
        setStatus('idle');
      }
    };
    void resume();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const finishReveal = useCallback(() => setStatus('ready'), []);
  const resetMuseum = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setStatus('idle');
    setResult(null);
    setFile(null);
    setImageUrl(null);
    setTitle('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
    window.requestAnimationFrame(() => uploadButtonRef.current?.focus());
  }, [imageUrl]);

  function receiveFile(next?: File) {
    setIsDragging(false);
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      setError('Choose a JPG, PNG, or WEBP photograph.');
      return;
    }
    if (next.size > 40 * 1024 * 1024) {
      setError('That photo is over 40 MB. Choose a smaller one.');
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setFile(next);
    setImageUrl(URL.createObjectURL(next));
    setTitle(next.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    setError('');
    window.requestAnimationFrame(() => titleRef.current?.focus());
  }

  function clearPhoto() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    rouletteRun.current += 1;
    setIsRouletting(false);
    setFile(null);
    setImageUrl(null);
    setTitle('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
    window.requestAnimationFrame(() => uploadButtonRef.current?.focus());
  }

  function chooseArchitecture(id: ArchitectureId) {
    rouletteRun.current += 1;
    setIsRouletting(false);
    setArchitecture(id);
  }

  async function spinRoulette() {
    if (isRouletting) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const choices = ARCHITECTURES.filter((item) => item.id !== architecture);
      const winner = choices[Math.floor(Math.random() * choices.length)] ?? ARCHITECTURES[0];
      setArchitecture(winner.id);
      setRouletteAnnouncement(`${winner.world} selected.`);
      return;
    }
    const run = rouletteRun.current + 1;
    rouletteRun.current = run;
    setIsRouletting(true);
    setRouletteAnnouncement('The architectural roulette is spinning.');

    const start = ARCHITECTURES.findIndex((item) => item.id === architecture);
    const turns = 15 + Math.floor(Math.random() * 6);
    let finalIndex = start;
    for (let step = 0; step < turns; step += 1) {
      await pause(54 + step * 9);
      if (rouletteRun.current !== run) return;
      finalIndex = (start + step * 3 + 1) % ARCHITECTURES.length;
      setArchitecture(ARCHITECTURES[finalIndex].id);
    }

    if (rouletteRun.current !== run) return;
    const winner = ARCHITECTURES[finalIndex];
    setIsRouletting(false);
    setRouletteAnnouncement(`${winner.world} selected.`);
  }

  function tryExample() {
    setError('');
    setArchitecture('art-deco');
    setResult(exampleMuseum);
    window.scrollTo({ top: 0, behavior: 'auto' });
    setStatus('revealing');
  }

  async function curate() {
    if (!file || !title.trim()) return;
    rouletteRun.current += 1;
    setIsRouletting(false);
    setStatus('curating');
    setError('');
    window.requestAnimationFrame(() => progressRef.current?.focus());
    const jobStartedAt = Date.now();
    setStartedAt(jobStartedAt);
    setProgressPhase('preparing');
    setProgress('Optimizing your photograph on this device.');
    try {
      const upload = await prepareImageUpload(file);
      setProgressPhase('rendering');
      setProgress('Sending the miniature plans to the gallery architects.');
      const form = new FormData();
      form.append('photo', upload);
      form.append('title', title.trim());
      form.append('lens', architecture);
      const response = await fetchWithDeadline(siteUrl('/api/museums'), { method: 'POST', body: form }, 45_000);
      const body = await response.text();
      let payload: MuseumRecord & { error?: string; status?: string; message?: string };
      try {
        payload = JSON.parse(body) as MuseumRecord & { error?: string; status?: string; message?: string };
      } catch {
        payload = {
          error: response.status === 413
            ? 'The optimized photo is still too large. Try a smaller image.'
            : 'The museum service returned an unexpected response.',
        } as MuseumRecord & { error?: string };
      }
      if (!response.ok) throw new Error(payload.error || 'The museum could not be curated.');
      if (payload.status !== 'processing' || !payload.id) throw new Error('The museum job did not start correctly.');
      writeActiveJob({ id: payload.id, title: title.trim(), architecture, startedAt: jobStartedAt });
      setProgress(payload.message || 'Constructing your architectural world.');
      const museum = await waitForMuseum(payload.id, (message, phase) => {
        setProgress(message);
        setProgressPhase(phase);
      });
      museum.imageUrl = siteUrl(museum.imageUrl);
      museum.sourceUrl = imageUrl ?? undefined;
      clearActiveJob();
      window.scrollTo({ top: 0, behavior: 'auto' });
      setResult(museum);
      setStatus('revealing');
    } catch (caught) {
      if (!isTransientError(caught)) clearActiveJob();
      setError(caught instanceof Error ? caught.message : 'The museum could not be curated.');
      setStatus('idle');
      window.requestAnimationFrame(() => titleRef.current?.focus());
    }
  }

  function submitCuration(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void curate();
  }

  if ((status === 'ready' || status === 'revealing') && result) {
    const exhibition = <MuseumExhibition result={result} onReset={resetMuseum} focusOnMount />;
    return status === 'revealing'
      ? <OpeningNightReveal architecture={result.lens as ArchitectureId} onComplete={finishReveal}>{exhibition}</OpeningNightReveal>
      : exhibition;
  }

  return (
    <main className="museum-shell min-h-[100dvh]">
      <nav className="museum-nav">
        <a className="brand" href="#top"><span className="brand-mark"><Aperture size={18} strokeWidth={1.7} /></span><span>One Minute Museum</span></a>
        <div className="nav-edition">AI exhibition studio</div>
      </nav>
      <section id="top" className="hero-grid">
        <div className="intro-copy">
          <div className="eyebrow"><span /> One photo · Eight worlds · Three exhibits</div>
          <h1>Your photo<br />becomes a <em>museum.</em></h1>
          <p className="intro-text">Choose an architectural world. AI preserves your moment, builds a miniature gallery around it, then turns three visible details into exhibits you can explore.</p>
          <div className="hero-actions">
            <Button ref={uploadButtonRef} type="button" className="hero-upload-button" size="lg" onClick={() => inputRef.current?.click()}><ImagePlus /> Choose a photo <ArrowRight /></Button>
            <button type="button" className="hero-demo-button" onClick={tryExample}><Eye size={17} /><span><strong>Tour the live example</strong><small>20 seconds · no upload</small></span></button>
          </div>
          <div className="privacy-note"><LockKeyhole size={15} /><span>No account. Unlisted by default. Share only when you are ready.</span></div>
          <div className="hero-pipeline" aria-label="How One Minute Museum works">
            <span>Photo</span><ArrowRight aria-hidden="true" /><span>AI-built room</span><ArrowRight aria-hidden="true" /><span>Vision-mapped exhibits</span><ArrowRight aria-hidden="true" /><span>Living 2.5D tour</span>
          </div>
        </div>
        <div className="builder-card">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-hidden="true" onChange={(event) => receiveFile(event.target.files?.[0])} className="sr-only" />
          <div className="builder-surface" inert={status === 'curating' ? true : undefined} aria-hidden={status === 'curating'}>
            {!imageUrl ? (
            <div
              className={isDragging ? 'drop-zone is-dragging' : 'drop-zone'}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false); }}
              onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); receiveFile(event.dataTransfer.files?.[0]); }}
            >
              <div className="studio-status"><span>01 / Source photograph</span><small>Usually 1–3 minutes</small></div>
              <button type="button" className="drop-zone-primary" onClick={() => inputRef.current?.click()}>
                <div className="upload-icon"><ImagePlus size={26} strokeWidth={1.5} /></div>
                <h2>Choose a moment worth keeping</h2>
                <p>Drop it here, or choose one from your device</p>
                <span className="file-note">JPG, PNG OR WEBP · OPTIMIZED ON YOUR DEVICE</span>
              </button>
              <div className="drop-zone-proof"><span>AI image generation</span><span>Spatial vision mapping</span><span>Shareable result</span></div>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
          ) : (
            <div className="photo-stage">
              <div className="studio-status photo-stage-status"><span>02 / Curatorial direction</span><small>Make the room yours</small></div>
              <div className="photo-frame">
                <Image src={imageUrl} alt="Your selected museum source" fill sizes="(max-width: 560px) 100vw, 30vw" unoptimized />
                <button className="remove-photo" onClick={clearPhoto} aria-label="Remove photograph"><X size={16} /></button>
                <div className="frame-index">SOURCE PHOTOGRAPH</div>
              </div>
              <form className="curation-controls" onSubmit={submitCuration}>
                <label htmlFor="museum-title">Name this moment</label>
                <input ref={titleRef} id="museum-title" value={title} maxLength={80} aria-describedby="build-time" aria-invalid={Boolean(error)} onChange={(event) => setTitle(event.target.value)} placeholder="Sunday, just before the rain" />
                <fieldset>
                  <legend>Choose an architectural world</legend>
                  <div className={isRouletting ? 'lens-grid is-rolling' : 'lens-grid'}>
                    {ARCHITECTURES.map((item) => (
                      <label
                        key={item.id}
                        className={architecture === item.id ? 'lens active' : 'lens'}
                        data-world={item.id}
                        aria-label={`Choose ${item.label}: ${item.world}`}
                      >
                        <input type="radio" name="architecture" value={item.id} checked={architecture === item.id} onChange={() => chooseArchitecture(item.id)} className="sr-only" />
                        <i className="lens-swatch" aria-hidden="true" />
                        <span className="lens-copy"><strong>{item.label}</strong><small>{item.world}</small></span>
                      </label>
                    ))}
                  </div>
                  <button type="button" className="roulette-button" disabled={isRouletting} onClick={spinRoulette}><Dices size={14} /> {isRouletting ? 'Choosing a world' : 'Surprise me'}</button>
                  <span className="sr-only" aria-live="polite">{rouletteAnnouncement}</span>
                </fieldset>
                <div className="world-summary"><span>{selectedWorld.world}</span><small>{selectedWorld.blueprint.material} · {selectedWorld.blueprint.light}</small></div>
                <Button type="submit" className="curate-button" size="lg" disabled={!title.trim() || status === 'curating' || isRouletting}><Sparkles /> Build this museum <ArrowRight /></Button>
                <p id="build-time" className="build-time">Usually 1–3 minutes. You can tour the example in another tab while it builds.</p>
                {error && <p className="form-error" role="alert">{error}</p>}
              </form>
            </div>
          )}
          </div>
          {status === 'curating' && <section ref={progressRef} className="curating-overlay" aria-label="Museum construction progress" tabIndex={-1}><BlueprintWorkshop architecture={architecture} progress={progress} phase={progressPhase} startedAt={startedAt} /></section>}
        </div>
      </section>
      <section className="promise-strip" aria-label="What every museum includes">
        <div><strong>01</strong><span>source photograph</span></div>
        <div><strong>08</strong><span>architectural worlds</span></div>
        <div><strong>03</strong><span>vision-mapped exhibits</span></div>
        <div><strong>1080 × 1920</strong><span>Story card with visit link</span></div>
      </section>
    </main>
  );
}

function pause(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function prepareImageUpload(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  let canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Your browser could not prepare that photograph.');
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.84;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > 850 * 1024 && Math.max(canvas.width, canvas.height) > 700) {
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(1, Math.round(canvas.width * 0.84));
    smaller.height = Math.max(1, Math.round(canvas.height * 0.84));
    smaller.getContext('2d')?.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    canvas = smaller;
    quality = Math.max(0.68, quality - 0.03);
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > 900 * 1024) throw new Error('This photograph stays too large after optimization. Try a smaller image.');
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'museum-source'}.webp`, { type: 'image/webp' });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Your browser could not prepare that photograph.')), 'image/webp', quality));
}

class TransientMuseumError extends Error {}

async function waitForMuseum(id: string, report: (message: string, phase: WorkshopPhase) => void, signal?: AbortSignal): Promise<MuseumRecord> {
  let currentPhase: WorkshopPhase = 'rendering';
  for (let attempt = 0; attempt < 144; attempt += 1) {
    await pause(2500);
    if (signal?.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
    try {
      const response = await fetchWithDeadline(siteUrl(`/api/museums/${id}/status`), { cache: 'no-store', signal }, 45_000);
      const text = await response.text();
      let payload: MuseumRecord & { error?: string; status?: string; message?: string; retryAfterMs?: number };
      try {
        payload = JSON.parse(text) as MuseumRecord & { error?: string; status?: string; message?: string; retryAfterMs?: number };
      } catch {
        throw new TransientMuseumError(`The museum status service returned ${response.status}.`);
      }
      if (response.ok && response.status !== 202) return payload;
      if (!response.ok) {
        if ([429, 503, 504].includes(response.status)) throw new TransientMuseumError(payload.error || 'The museum status service is briefly unavailable.');
        throw new Error(payload.error || 'The museum render failed.');
      }
      const message = payload.message || 'The museum is still taking shape.';
      currentPhase = inferWorkshopPhase(message);
      report(message, currentPhase);
      if (payload.retryAfterMs && payload.retryAfterMs > 2500) await pause(Math.min(60_000, payload.retryAfterMs - 2500));
    } catch (caught) {
      if (signal?.aborted) throw signal.reason ?? caught;
      if (!isTransientError(caught)) throw caught;
      report('A status check paused. Your museum is safe, and we are reconnecting.', currentPhase);
    }
  }
  throw new TransientMuseumError('This detailed museum is taking longer than expected. Refresh this page to keep waiting.');
}

async function fetchWithDeadline(input: RequestInfo | URL, init: RequestInit, timeout: number) {
  const controller = new AbortController();
  const upstream = init.signal;
  const abortFromUpstream = () => controller.abort(upstream?.reason);
  if (upstream?.aborted) abortFromUpstream(); else upstream?.addEventListener('abort', abortFromUpstream, { once: true });
  const timer = window.setTimeout(() => controller.abort(new DOMException('The request timed out.', 'TimeoutError')), timeout);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    upstream?.removeEventListener('abort', abortFromUpstream);
  }
}

function inferWorkshopPhase(message: string): WorkshopPhase {
  return /curator|label|position|map exhibit|finished room|gallery handoff|opening the finished/i.test(message) ? 'mapping' : 'rendering';
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function isTransientError(error: unknown) {
  if (error instanceof TransientMuseumError || error instanceof TypeError || isAbortError(error)) return true;
  return error instanceof Error && /network|fetch|timed out|connection/i.test(error.message);
}

function readActiveJob(): ActiveMuseumJob | null {
  try {
    const value = window.localStorage.getItem(activeJobKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<ActiveMuseumJob>;
    const validArchitecture = ARCHITECTURES.some((item) => item.id === parsed.architecture);
    if (typeof parsed.id !== 'string' || typeof parsed.title !== 'string' || typeof parsed.startedAt !== 'number' || !validArchitecture || Date.now() - parsed.startedAt > 20 * 60_000) {
      clearActiveJob();
      return null;
    }
    return parsed as ActiveMuseumJob;
  } catch {
    clearActiveJob();
    return null;
  }
}

function writeActiveJob(job: ActiveMuseumJob) {
  try { window.localStorage.setItem(activeJobKey, JSON.stringify(job)); } catch { /* The job still continues without local recovery. */ }
}

function clearActiveJob() {
  try { window.localStorage.removeItem(activeJobKey); } catch { /* Storage is optional. */ }
}
