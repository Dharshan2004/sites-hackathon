'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Aperture, ArrowLeft, ArrowRight, Check, ChevronDown, Cpu, Download, Eye, ImageIcon, LoaderCircle, MousePointer2, Printer, Share2, Square, Sparkles, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LivingDiorama } from '@/components/living-diorama';
import { PostcardPrinter } from '@/components/postcard-printer';
import { getArchitecture } from '@/lib/architectures';
import type { MuseumRecord } from '@/lib/museum';
import { PUBLIC_SITE_ORIGIN } from '@/lib/site-url';

type Postcard = { file: File; previewUrl: string; exhibitTitle: string };
type ViewMode = 'museum' | 'source';

export function MuseumExhibition({ result, onReset, focusOnMount = false }: { result: MuseumRecord; onReset?: () => void; focusOnMount?: boolean }) {
  const [activeExhibit, setActiveExhibit] = useState(0);
  const [visited, setVisited] = useState<number[]>([0]);
  const [viewMode, setViewMode] = useState<ViewMode>('museum');
  const [isTouring, setIsTouring] = useState(false);
  const [shared, setShared] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [postcard, setPostcard] = useState<Postcard | null>(null);
  const [cardError, setCardError] = useState('');
  const [shareError, setShareError] = useState('');
  const [shareFallbackUrl, setShareFallbackUrl] = useState('');
  const [dioramaMode, setDioramaMode] = useState<'living' | 'still'>('still');
  const labelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tourRun = useRef(0);
  const exhibit = result.exhibits[activeExhibit] ?? result.exhibits[0];
  const architecture = getArchitecture(result.lens);
  const hasMappedExhibits = result.mapped !== false;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (focusOnMount) window.requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  }, [focusOnMount]);

  useEffect(() => () => {
    tourRun.current += 1;
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => () => {
    if (postcard) URL.revokeObjectURL(postcard.previewUrl);
  }, [postcard]);

  function selectExhibit(index: number) {
    setActiveExhibit(index);
    setVisited((current) => current.includes(index) ? current : [...current, index]);
  }

  async function shareMuseum() {
    setShareError('');
    setShareFallbackUrl('');
    const url = museumUrl(result.id);
    const text = `I turned “${result.title}” into a tiny ${architecture.label} museum. Come inside.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${result.title} | One Minute Museum`, text, url });
        setShared(true);
        window.setTimeout(() => setShared(false), 1800);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await copyText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      setShareError('Automatic copy was unavailable. Select the exact museum link below.');
      setShareFallbackUrl(url);
    }
  }

  async function printCard() {
    if (isPrinting) return;
    setIsPrinting(true);
    setCardError('');
    try {
      const file = await buildPostcard(result, activeExhibit);
      setPostcard({ file, previewUrl: URL.createObjectURL(file), exhibitTitle: exhibit.title });
    } catch {
      setCardError('The exhibition press could not print this image. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  }

  function closePrinter() {
    setPostcard(null);
  }

  function showFullLabel() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    labelRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function stopTour() {
    tourRun.current += 1;
    window.speechSynthesis?.cancel();
    setIsTouring(false);
  }

  async function startTour() {
    if (isTouring) {
      stopTour();
      return;
    }

    const run = tourRun.current + 1;
    tourRun.current = run;
    setIsTouring(true);
    setViewMode('museum');
    for (let index = 0; index < result.exhibits.length; index += 1) {
      if (tourRun.current !== run) return;
      selectExhibit(index);
      const item = result.exhibits[index];
      const introduction = index === 0 ? `Welcome to ${result.title}. ${result.subtitle} ` : '';
      await narrate(`${introduction}Exhibit ${index + 1}. ${item.title}. ${item.label}`);
      if (tourRun.current !== run) return;
      await pause(450);
    }
    if (tourRun.current === run) setIsTouring(false);
  }

  const progressLabel = visited.length === result.exhibits.length ? 'Catalogue complete' : `${visited.length} of ${result.exhibits.length} seen`;

  return (
    <main className="exhibition-view">
      <nav className="exhibition-nav">
        {onReset
          ? <button onClick={onReset}><ArrowLeft size={16} /> New museum</button>
          : <Link className="new-museum-link" href="/"><ArrowLeft size={16} /> Make yours</Link>}
        <div className="exhibition-brand"><Aperture size={17} /> One Minute Museum</div>
        <div className="exhibition-actions">
          <Button variant="ghost" onClick={printCard} disabled={isPrinting}>{isPrinting ? <LoaderCircle className="button-spinner" /> : <Printer />} {isPrinting ? 'Composing' : 'Story card'}</Button>
          <Button onClick={shareMuseum}>{shared ? <Check /> : <Share2 />}{shared ? 'Ready' : 'Invite visitors'}</Button>
        </div>
      </nav>
      <section className="museum-room">
        <div className="room-header">
          <span>AI-curated · {hasMappedExhibits ? '3 vision-mapped exhibits' : 'safe label fallback'}</span>
          <span>{architecture.label} / {architecture.world}</span>
          <span>{result.sourceUrl ? 'Original stays on this device' : 'Unlisted collection'}</span>
        </div>
        <div className="diorama-stage">
          <div className="artwork-field">
            {viewMode === 'museum'
              ? <LivingDiorama src={result.imageUrl} alt={result.altText} focus={hasMappedExhibits ? { x: exhibit.x, y: exhibit.y } : { x: 50, y: 50 }} onModeChange={setDioramaMode} />
              : result.sourceUrl && <Image className="source-original" src={result.sourceUrl} alt={`Original photograph used to create ${result.title}`} fill sizes="(max-width: 860px) 100vw, 73vw" unoptimized />}
            <div className="stage-vignette" />
            {result.sourceUrl && (
              <fieldset className="compare-switch">
                <legend className="sr-only">Compare the original photograph and generated museum</legend>
                <button type="button" className={viewMode === 'source' ? 'active' : ''} onClick={() => setViewMode('source')} aria-pressed={viewMode === 'source'}><Eye size={13} /> Original</button>
                <button type="button" className={viewMode === 'museum' ? 'active' : ''} onClick={() => setViewMode('museum')} aria-pressed={viewMode === 'museum'}><ImageIcon size={13} /> Museum</button>
              </fieldset>
            )}
            {viewMode === 'museum' && hasMappedExhibits && (
              <fieldset className="hotspot-layer">
                <legend className="sr-only">Visually mapped museum exhibits</legend>
                {result.exhibits.map((item, index) => (
                  <span key={item.number}>
                    <input
                      id={`exhibit-${result.id}-${index}`}
                      className="hotspot-input sr-only"
                      type="radio"
                      name={`museum-exhibits-${result.id}`}
                      checked={activeExhibit === index}
                      onChange={() => selectExhibit(index)}
                    />
                    <label
                      className={activeExhibit === index ? 'hotspot active' : 'hotspot'}
                      style={{ left: `${item.x}%`, top: `${item.y}%` }}
                      data-title={item.title}
                      htmlFor={`exhibit-${result.id}-${index}`}
                    ><span>{item.number}</span><span className="sr-only">{item.title}</span></label>
                  </span>
                ))}
              </fieldset>
            )}
            <div className="diorama-hint"><MousePointer2 size={13} /><span>{viewMode === 'source' ? 'The original stays on this device.' : hasMappedExhibits ? (dioramaMode === 'living' ? 'Move to look. Choose a marker.' : 'Choose a marker to explore.') : 'The room is ready. Read the labels below.'}</span></div>
          </div>
          {viewMode === 'museum' && (
            <button type="button" className="mobile-exhibit-caption" onClick={showFullLabel} aria-label={`Read the full label for ${exhibit.title}`}>
              <span>Exhibit {exhibit.number}<em>Read full label <ArrowRight size={12} /></em></span>
              <strong>{exhibit.title}</strong>
              <small>{exhibit.label}</small>
            </button>
          )}
        </div>
        <aside ref={labelRef} className="museum-label">
          <div className="museum-proof" aria-label="How this museum was built">
            <span><Sparkles size={12} /> OpenAI room</span>
            <span>{hasMappedExhibits ? '3 vision mapped details' : '3 curated labels'}</span>
            <span>{dioramaMode === 'living' ? 'Image relief active' : 'Adaptive still'}</span>
          </div>
          <div className="visitor-catalogue">
            <div><small>Visitor catalogue</small><strong>{progressLabel}</strong></div>
            <button type="button" onClick={startTour}>{isTouring ? <Square size={12} fill="currentColor" /> : <Volume2 size={14} />}{isTouring ? 'Stop tour' : 'Guided tour'}</button>
          </div>
          <h1 ref={titleRef} tabIndex={-1}>{result.title}</h1>
          <p className="museum-subtitle">{result.subtitle}</p>
          <div className="label-rule" />
          <div className="exhibit-live" aria-live="polite" aria-atomic="true">
            <div className="label-number">EXHIBIT {exhibit.number} / 03</div>
            <h2>{exhibit.title}</h2>
            <p>{exhibit.label}</p>
          </div>
          <span className="sr-only" aria-live="polite">{isTouring ? `Guided tour playing exhibit ${exhibit.number}` : visited.length === result.exhibits.length ? 'All three exhibits visited.' : ''}</span>
          {cardError && <p className="card-error" role="alert">{cardError}</p>}
          {shareError && <p className="card-error" role="alert">{shareError}</p>}
          {shareFallbackUrl && <label className="share-fallback">Museum link<input value={shareFallbackUrl} readOnly onFocus={(event) => event.currentTarget.select()} /></label>}
          <div className="exhibit-pagination" aria-label="Exhibit catalogue">
            {result.exhibits.map((item, index) => <button key={item.number} onClick={() => selectExhibit(index)} className={index === activeExhibit ? 'active' : ''} aria-label={`Show exhibit ${item.number}`} aria-pressed={index === activeExhibit}>{item.number}</button>)}
          </div>
          <details className="behind-exhibit" open>
            <summary><span><Cpu size={15} /> Behind the exhibit</span><small>{dioramaMode === 'living' ? 'Living 2.5D' : 'Performance still'}</small><ChevronDown size={14} /></summary>
            <p>{hasMappedExhibits ? 'OpenAI builds the room from your photograph, reads the finished render to map three visible exhibits, then hands it to an adaptive Three.js presentation. The uploaded source is removed from storage after the render handoff.' : 'OpenAI built this room from your photograph. The visual curator could not safely map markers, so the room opens with its interpretive labels instead. The uploaded source is removed after render handoff.'}</p>
            <div className="tech-pipeline" aria-label="Museum generation pipeline">
              <span>Photo</span><ArrowRight aria-hidden="true" /><span>Generated room</span><ArrowRight aria-hidden="true" /><span>{hasMappedExhibits ? 'Vision coordinates' : 'Safe labels'}</span><ArrowRight aria-hidden="true" /><span>Adaptive 2.5D</span>
            </div>
            <div className="build-evidence"><span>2 multimodal passes</span><span>Strict structured output</span><span>D1 + R2 persistence</span></div>
            <a className="save-render" href={result.imageUrl} download={`${slugify(result.title)}-museum.jpg`}><Download size={13} /> Save full museum render</a>
          </details>
        </aside>
      </section>
      {postcard && <PostcardPrinter file={postcard.file} previewUrl={postcard.previewUrl} exhibitTitle={postcard.exhibitTitle} onClose={closePrinter} />}
    </main>
  );
}

async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error('Copy was unavailable.');
  await navigator.clipboard.writeText(text);
}

function museumUrl(id: string) {
  const origin = window.location.hostname.endsWith('.chatgpt.site') ? PUBLIC_SITE_ORIGIN : window.location.origin;
  return `${origin}/museum/${id}`;
}

async function narrate(text: string) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    await pause(4600);
    return;
  }
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.94;
    utterance.pitch = 0.96;
    const timeout = window.setTimeout(resolve, 14_000);
    utterance.onend = () => { window.clearTimeout(timeout); resolve(); };
    utterance.onerror = () => { window.clearTimeout(timeout); resolve(); };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

function pause(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

async function loadCanvasImage(src: string) {
  const image = new window.Image();
  image.crossOrigin = 'anonymous';
  image.src = src;
  await image.decode();
  return image;
}

async function buildPostcard(result: MuseumRecord, exhibitIndex: number): Promise<File> {
  const architecture = getArchitecture(result.lens);
  const exhibit = result.exhibits[exhibitIndex] ?? result.exhibits[0];
  const [image, qrModule] = await Promise.all([loadCanvasImage(result.imageUrl), import('qrcode')]);
  const qrDataUrl = await qrModule.toDataURL(museumUrl(result.id), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 180,
    color: { dark: '#171713', light: '#f2efe7' },
  });
  const qrImage = await loadCanvasImage(qrDataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');

  context.fillStyle = '#171713';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawPaperGrain(context, canvas.width, canvas.height);

  context.fillStyle = '#ea6549';
  context.fillRect(72, 76, 62, 7);
  context.fillStyle = '#f2efe7';
  context.font = '700 29px Arial';
  context.letterSpacing = '3px';
  context.fillText('ONE MINUTE MUSEUM', 72, 139);
  context.letterSpacing = '0px';

  const frame = { x: 72, y: 228, width: 936, height: 704 };
  context.fillStyle = '#0d0d0a';
  context.fillRect(frame.x, frame.y, frame.width, frame.height);
  const scale = Math.min(frame.width / image.width, frame.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, frame.x + (frame.width - width) / 2, frame.y + (frame.height - height) / 2, width, height);
  context.strokeStyle = '#5a554b';
  context.lineWidth = 2;
  context.strokeRect(frame.x, frame.y, frame.width, frame.height);

  context.fillStyle = '#8f897e';
  context.font = '700 20px Arial';
  context.letterSpacing = '3px';
  context.fillText('ARCHITECTURAL WORLD', 72, 1005);
  context.fillStyle = '#ea6549';
  context.font = '700 29px Arial';
  context.letterSpacing = '1px';
  context.fillText(`${architecture.label.toUpperCase()} / ${architecture.world.toUpperCase()}`, 72, 1052);
  context.letterSpacing = '0px';

  const titleSize = result.title.length > 48 ? 58 : result.title.length > 28 ? 70 : 84;
  context.fillStyle = '#f2efe7';
  context.font = `italic ${titleSize}px Georgia`;
  const afterTitle = drawWrappedText(context, result.title, 72, 1156, 936, titleSize * 1.03, 2);

  const quoteTop = Math.max(1370, afterTitle + 34);
  context.fillStyle = '#ea6549';
  context.fillRect(72, quoteTop - 31, 40, 4);
  context.fillStyle = '#8f897e';
  context.font = '700 19px Arial';
  context.letterSpacing = '3px';
  context.fillText(`EXHIBIT ${exhibit.number} / ${exhibit.title.toUpperCase()}`, 72, quoteTop + 15);
  context.letterSpacing = '0px';
  context.fillStyle = '#c7c0b3';
  context.font = '32px Georgia';
  drawWrappedText(context, `“${exhibit.label}”`, 72, quoteTop + 70, 900, 42, 4);

  context.strokeStyle = '#3e3a33';
  context.beginPath();
  context.moveTo(72, 1714);
  context.lineTo(1008, 1714);
  context.stroke();
  context.fillStyle = '#777269';
  context.font = '17px Arial';
  context.letterSpacing = '2px';
  context.fillText(`UNLISTED COLLECTION / ${result.id.slice(0, 8).toUpperCase()}`, 72, 1770);
  context.fillText('SCAN TO ENTER THE INTERACTIVE ROOM', 72, 1810);
  context.fillStyle = '#f2efe7';
  context.fillRect(852, 1740, 156, 156);
  context.drawImage(qrImage, 858, 1746, 144, 144);
  context.letterSpacing = '0px';

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('The postcard could not be encoded.')), 'image/png'));
  return new File([blob], `${slugify(result.title)}-story.png`, { type: 'image/png' });
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'museum';
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) {
    let finalLine = visible[visible.length - 1];
    while (finalLine.length > 1 && context.measureText(`${finalLine}…`).width > width) finalLine = finalLine.slice(0, -1);
    visible[visible.length - 1] = `${finalLine.trimEnd()}…`;
  }
  visible.forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
  return y + visible.length * lineHeight;
}

function drawPaperGrain(context: CanvasRenderingContext2D, width: number, height: number) {
  context.save();
  context.globalAlpha = 0.045;
  context.fillStyle = '#f2efe7';
  for (let index = 0; index < 950; index += 1) {
    const x = (index * 89) % width;
    const y = (index * 173) % height;
    context.fillRect(x, y, 1, 1);
  }
  context.restore();
}
