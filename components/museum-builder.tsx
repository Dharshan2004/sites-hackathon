'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import Image from 'next/image';
import { Aperture, ArrowRight, Dices, Eye, ImagePlus, LockKeyhole, Sparkles, Ticket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlueprintWorkshop } from '@/components/blueprint-workshop';
import { MuseumExhibition } from '@/components/museum-exhibition';
import { OpeningNightReveal } from '@/components/opening-night-reveal';
import { ARCHITECTURES, type ArchitectureId } from '@/lib/architectures';
import { exampleMuseum, type MuseumRecord } from '@/lib/museum';
import { siteUrl } from '@/lib/site-url';

type BuilderStatus = 'idle' | 'curating' | 'revealing' | 'ready';

export function MuseumBuilder() {
  const inputRef = useRef<HTMLInputElement>(null);
  const rouletteRun = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [architecture, setArchitecture] = useState<ArchitectureId>('art-deco');
  const [isRouletting, setIsRouletting] = useState(false);
  const [rouletteAnnouncement, setRouletteAnnouncement] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<BuilderStatus>('idle');
  const [result, setResult] = useState<MuseumRecord | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('Preparing your photograph.');

  useEffect(() => () => {
    rouletteRun.current += 1;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const finishReveal = useCallback(() => setStatus('ready'), []);
  const resetMuseum = useCallback(() => {
    setStatus('idle');
    setResult(null);
  }, []);

  function receiveFile(next?: File) {
    if (!next || !next.type.startsWith('image/')) return;
    if (next.size > 40 * 1024 * 1024) {
      setError('That photo is over 40 MB. Choose a smaller one.');
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setFile(next);
    setImageUrl(URL.createObjectURL(next));
    setTitle(next.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    setError('');
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
  }

  function chooseArchitecture(id: ArchitectureId) {
    rouletteRun.current += 1;
    setIsRouletting(false);
    setArchitecture(id);
  }

  async function spinRoulette() {
    if (isRouletting) return;
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
    setStatus('revealing');
  }

  async function curate() {
    if (!file || !title.trim()) return;
    rouletteRun.current += 1;
    setIsRouletting(false);
    setStatus('curating');
    setError('');
    setProgress('Optimizing your photograph on this device.');
    try {
      const upload = await prepareImageUpload(file);
      setProgress('Sending the miniature plans to the gallery architects.');
      const form = new FormData();
      form.append('photo', upload);
      form.append('title', title.trim());
      form.append('lens', architecture);
      const response = await fetch(siteUrl('/api/museums'), { method: 'POST', body: form });
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
      setProgress(payload.message || 'Constructing your architectural world.');
      const museum = await waitForMuseum(payload.id, setProgress);
      museum.imageUrl = siteUrl(museum.imageUrl);
      setResult(museum);
      setStatus('revealing');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The museum could not be curated.');
      setStatus('idle');
    }
  }

  if ((status === 'ready' || status === 'revealing') && result) {
    const exhibition = <MuseumExhibition result={result} onReset={resetMuseum} />;
    return status === 'revealing'
      ? <OpeningNightReveal architecture={result.lens as ArchitectureId} onComplete={finishReveal}>{exhibition}</OpeningNightReveal>
      : exhibition;
  }

  return (
    <main className="museum-shell min-h-screen">
      <nav className="museum-nav">
        <a className="brand" href="#top"><span className="brand-mark"><Aperture size={18} strokeWidth={1.7} /></span><span>One Minute Museum</span></a>
        <div className="nav-edition">Private exhibition builder</div>
      </nav>
      <section id="top" className="hero-grid">
        <div className="intro-copy">
          <div className="eyebrow"><span /> Turn a moment into a museum</div>
          <h1>Your photo<br />deserves a <em>gallery.</em></h1>
          <p className="intro-text">Upload one photograph. We uncover its details, build a miniature world and open it for visitors.</p>
          <div className="privacy-note"><LockKeyhole size={15} /><span>Unlisted by default. Only people with your link can visit.</span></div>
        </div>
        <div className="builder-card">
          {!imageUrl ? (
            <div
              className="drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); receiveFile(event.dataTransfer.files?.[0]); }}
            >
              <button type="button" className="drop-zone-primary" onClick={() => inputRef.current?.click()}>
                <div className="upload-icon"><ImagePlus size={26} strokeWidth={1.5} /></div>
                <h2>Begin with a photograph</h2>
                <p>Drop it here, or choose from your device</p>
                <span className="file-note">JPG, PNG OR WEBP / OPTIMIZED ON YOUR DEVICE</span>
              </button>
              <div className="example-entry"><span>or enter through the staff door</span><button type="button" onClick={tryExample}><Eye size={15} /> Try an example</button></div>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => receiveFile(event.target.files?.[0])} className="sr-only" />
            </div>
          ) : (
            <div className="photo-stage">
              <div className="photo-frame">
                <Image src={imageUrl} alt="Your selected museum source" fill sizes="(max-width: 560px) 100vw, 30vw" unoptimized />
                <button className="remove-photo" onClick={clearPhoto} aria-label="Remove photograph"><X size={16} /></button>
                <div className="frame-index">SOURCE PHOTOGRAPH</div>
              </div>
              <div className="curation-controls">
                <label htmlFor="museum-title">Name this moment</label>
                <input id="museum-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Sunday, just before the rain" />
                <fieldset>
                  <legend>Choose an architectural world</legend>
                  <div className={isRouletting ? 'lens-grid is-rolling' : 'lens-grid'}>
                    {ARCHITECTURES.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={architecture === item.id ? 'lens active' : 'lens'}
                        onClick={() => chooseArchitecture(item.id)}
                        aria-pressed={architecture === item.id}
                      >
                        <span>{item.label}</span><small>{item.world}</small>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="roulette-button" disabled={isRouletting} onClick={spinRoulette}><Dices size={14} /> {isRouletting ? 'Choosing a world' : 'Surprise me'}</button>
                  <span className="sr-only" aria-live="polite">{rouletteAnnouncement}</span>
                </fieldset>
                <Button className="curate-button" size="lg" disabled={!title.trim() || status === 'curating' || isRouletting} onClick={curate}><Sparkles /> Curate my museum <ArrowRight /></Button>
                {error && <p className="form-error" role="alert">{error}</p>}
              </div>
            </div>
          )}
          {status === 'curating' && <div className="curating-overlay"><BlueprintWorkshop architecture={architecture} progress={progress} /></div>}
        </div>
      </section>
      <section className="promise-strip" aria-label="What the museum includes">
        <div className="promise-lead"><span>BUILT WITH OPENAI VISION + IMAGE GENERATION</span><strong>One photograph becomes an explorable miniature exhibition.</strong></div>
        <div className="promise-keepsake"><Ticket size={20} /><p>Private link<br />Interactive exhibits<br />Story-ready card</p></div>
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

async function waitForMuseum(id: string, report: (message: string) => void): Promise<MuseumRecord> {
  for (let attempt = 0; attempt < 144; attempt += 1) {
    await pause(2500);
    try {
      const response = await fetch(siteUrl(`/api/museums/${id}/status`), { cache: 'no-store' });
      const text = await response.text();
      const payload = JSON.parse(text) as MuseumRecord & { error?: string; status?: string; message?: string };
      if (response.ok && response.status !== 202) return payload;
      if (!response.ok) throw new Error(payload.error || 'The museum render failed.');
      report(payload.message || 'The museum is still taking shape.');
    } catch (caught) {
      if (caught instanceof Error && !(caught instanceof TypeError) && !caught.message.toLowerCase().includes('network')) throw caught;
      report('A status check was interrupted. The museum is safe, and we are reconnecting.');
    }
  }
  throw new Error('This detailed museum is taking longer than expected. Please try again.');
}
