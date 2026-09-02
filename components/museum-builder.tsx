'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Aperture, ArrowRight, ImagePlus, LockKeyhole, Sparkles, Ticket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MuseumExhibition } from '@/components/museum-exhibition';
import type { MuseumRecord } from '@/lib/museum';

type Lens = 'poetic' | 'cinematic' | 'future';
const lenses: Array<{ id: Lens; label: string; note: string }> = [
  { id: 'poetic', label: 'Poetic', note: 'Memory, feeling, small details' },
  { id: 'cinematic', label: 'Cinematic', note: 'Drama, composition, atmosphere' },
  { id: 'future', label: 'Future archive', note: 'How tomorrow might remember it' },
];

export function MuseumBuilder() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>('poetic');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'idle' | 'curating' | 'ready'>('idle');
  const [result, setResult] = useState<MuseumRecord | null>(null);
  const [error, setError] = useState('');

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  function receiveFile(next?: File) {
    if (!next || !next.type.startsWith('image/')) return;
    if (next.size > 40 * 1024 * 1024) { setError('That photo is over 40 MB. Choose a smaller one.'); return; }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setFile(next);
    setImageUrl(URL.createObjectURL(next));
    setTitle(next.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    setError('');
  }

  function clearPhoto() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setFile(null); setImageUrl(null); setTitle(''); setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function curate() {
    if (!file || !title.trim()) return;
    setStatus('curating'); setError('');
    try {
      const upload = await prepareImageUpload(file);
      const form = new FormData();
      form.append('photo', upload); form.append('title', title.trim()); form.append('lens', lens);
      const response = await fetch('/api/museums', { method: 'POST', body: form });
      const body = await response.text();
      let payload: MuseumRecord & { error?: string };
      try { payload = JSON.parse(body) as MuseumRecord & { error?: string }; }
      catch { payload = { error: response.status === 413 ? 'The optimized photo is still too large. Try a smaller image.' : 'The museum service returned an unexpected response.' } as MuseumRecord & { error?: string }; }
      if (!response.ok) throw new Error(payload.error || 'The museum could not be curated.');
      setResult(payload); setStatus('ready');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The museum could not be curated.');
      setStatus('idle');
    }
  }

  if (status === 'ready' && result) {
    return <MuseumExhibition result={result} onReset={() => { setStatus('idle'); setResult(null); }} />;
  }

  return (
    <main className="museum-shell min-h-screen">
      <nav className="museum-nav">
        <a className="brand" href="#top"><span className="brand-mark"><Aperture size={18} strokeWidth={1.7} /></span><span>One Minute Museum</span></a>
        <div className="nav-edition">Exhibition builder · 01</div>
      </nav>
      <section id="top" className="hero-grid">
        <div className="intro-copy">
          <div className="eyebrow"><span /> Turn a moment into a museum</div>
          <h1>Your photo<br />deserves a <em>gallery.</em></h1>
          <p className="intro-text">Upload one photograph. We’ll uncover its details, build a miniature world around it, and create an exhibition you can visit and share.</p>
          <div className="privacy-note"><LockKeyhole size={15} /><span>Unlisted by default. Only people with your link can visit.</span></div>
        </div>
        <div className="builder-card">
          {!imageUrl ? (<>
            <button type="button" className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); receiveFile(event.dataTransfer.files?.[0]); }} onClick={() => inputRef.current?.click()}>
              <div className="upload-icon"><ImagePlus size={26} strokeWidth={1.5} /></div><h2>Begin with a photograph</h2><p>Drop it here, or choose from your device</p><span className="file-note">JPG, PNG or WEBP · optimized privately in your browser</span>
            </button>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => receiveFile(event.target.files?.[0])} className="sr-only" />
          </>
          ) : (
            <div className="photo-stage">
              <div className="photo-frame"><Image src={imageUrl} alt="Your selected museum source" fill sizes="(max-width: 560px) 100vw, 30vw" unoptimized /><button className="remove-photo" onClick={clearPhoto}><X size={16} /></button><div className="frame-index">SOURCE / 001</div></div>
              <div className="curation-controls">
                <label htmlFor="museum-title">Name this moment</label><input id="museum-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Sunday, just before the rain" />
                <fieldset><legend>Choose a curatorial lens</legend><div className="lens-grid">{lenses.map((item) => <button type="button" key={item.id} className={lens === item.id ? 'lens active' : 'lens'} onClick={() => setLens(item.id)}><span>{item.label}</span><small>{item.note}</small></button>)}</div></fieldset>
                <Button className="curate-button" size="lg" disabled={!title.trim() || status === 'curating'} onClick={curate}><Sparkles /> Curate my museum <ArrowRight /></Button>
                {error && <p className="form-error" role="alert">{error}</p>}
              </div>
            </div>
          )}
          {status === 'curating' && <div className="curating-overlay"><div className="curating-orbit"><span /><span /><span /></div><p>Building the miniature world</p><small>Finding exhibits · shaping the room · writing the labels</small></div>}
        </div>
      </section>
      <section className="promise-strip"><div><span>01</span><strong>A miniature world</strong><p>Your moment, restaged as a diorama</p></div><div><span>02</span><strong>Three exhibits</strong><p>Details hiding in plain sight</p></div><div><span>03</span><strong>A keepsake</strong><p>Download a Story-ready museum card</p></div><div className="ticket-cell"><Ticket size={20} /><p>One photograph.<br />One minute. One museum.</p></div></section>
    </main>
  );
}

async function prepareImageUpload(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  let canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('Your browser could not prepare that photograph.'); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();

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
