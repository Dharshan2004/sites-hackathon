'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import Link from 'next/link';
import { Aperture, ArrowLeft, ArrowRight, Check, ChevronDown, Cpu, LoaderCircle, MousePointer2, Printer, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LivingDiorama } from '@/components/living-diorama';
import { PostcardPrinter } from '@/components/postcard-printer';
import { getArchitecture } from '@/lib/architectures';
import type { MuseumRecord } from '@/lib/museum';
import { PUBLIC_SITE_ORIGIN } from '@/lib/site-url';

type Postcard = { file: File; previewUrl: string };

export function MuseumExhibition({ result, onReset }: { result: MuseumRecord; onReset?: () => void }) {
  const [activeExhibit, setActiveExhibit] = useState(0);
  const [shared, setShared] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [postcard, setPostcard] = useState<Postcard | null>(null);
  const [cardError, setCardError] = useState('');
  const [shareError, setShareError] = useState('');
  const [dioramaMode, setDioramaMode] = useState<'living' | 'still'>('still');
  const labelRef = useRef<HTMLElement>(null);
  const exhibit = result.exhibits[activeExhibit];
  const architecture = getArchitecture(result.lens);
  const hasMappedExhibits = result.mapped !== false;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => () => {
    if (postcard) URL.revokeObjectURL(postcard.previewUrl);
  }, [postcard]);

  async function shareMuseum() {
    setShareError('');
    const origin = window.location.hostname.endsWith('.chatgpt.site') ? PUBLIC_SITE_ORIGIN : window.location.origin;
    const url = `${origin}/museum/${result.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: result.title, text: 'Visit my One Minute Museum', url });
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
      setShareError('The link could not be copied. Use your browser address bar to copy this museum.');
    }
  }

  async function printCard() {
    if (isPrinting) return;
    setIsPrinting(true);
    setCardError('');
    try {
      const file = await buildPostcard(result, activeExhibit);
      setPostcard({ file, previewUrl: URL.createObjectURL(file) });
    } catch {
      setCardError('The exhibition press could not print this image. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  }

  function closePrinter() {
    setPostcard(null);
  }

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    setActiveExhibit((current) => (current + direction + result.exhibits.length) % result.exhibits.length);
  }

  function showFullLabel() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    labelRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <main className="exhibition-view">
      <nav className="exhibition-nav">
        {onReset
          ? <button onClick={onReset}><ArrowLeft size={16} /> New museum</button>
          : <Link className="new-museum-link" href="/"><ArrowLeft size={16} /> Make yours</Link>}
        <div className="exhibition-brand"><Aperture size={17} /> One Minute Museum</div>
        <div className="exhibition-actions">
          <Button variant="ghost" onClick={printCard} disabled={isPrinting}>{isPrinting ? <LoaderCircle className="button-spinner" /> : <Printer />} {isPrinting ? 'Composing' : 'Print card'}</Button>
          <Button onClick={shareMuseum}>{shared ? <Check /> : <Share2 />}{shared ? 'Copied' : 'Share'}</Button>
        </div>
      </nav>
      <section className="museum-room">
        <div className="room-header"><span>Unlisted collection</span><span>{architecture.label} / {architecture.world}</span></div>
        <div className="diorama-stage">
          <div className="artwork-field">
            <LivingDiorama src={result.imageUrl} alt={`The miniature museum of ${result.title}`} focus={hasMappedExhibits ? { x: exhibit.x, y: exhibit.y } : { x: 50, y: 50 }} onModeChange={setDioramaMode} />
            <div className="stage-vignette" />
            {hasMappedExhibits && result.exhibits.map((item, index) => (
              <button
                key={item.number}
                className={activeExhibit === index ? 'hotspot active' : 'hotspot'}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                onClick={() => setActiveExhibit(index)}
                onKeyDown={selectFromKeyboard}
                aria-label={`Open exhibit ${item.number}: ${item.title}`}
                aria-pressed={activeExhibit === index}
              ><span>{item.number}</span></button>
            ))}
            <div className="diorama-hint"><MousePointer2 size={13} /><span>{hasMappedExhibits ? (dioramaMode === 'living' ? 'Move to look. Choose a marker.' : 'Choose a marker to explore.') : 'The room is ready. Read the labels below.'}</span></div>
          </div>
          <button type="button" className="mobile-exhibit-caption" onClick={showFullLabel} aria-label={`Read the full label for ${exhibit.title}`}>
            <span>Exhibit {exhibit.number}</span>
            <strong>{exhibit.title}</strong>
            <small>{exhibit.label}</small>
          </button>
        </div>
        <aside ref={labelRef} className="museum-label">
          <div className="label-number">EXHIBIT {exhibit.number} / 03</div>
          <h1>{result.title}</h1>
          <p className="museum-subtitle">{result.subtitle}</p>
          <div className="label-rule" />
          <h2>{exhibit.title}</h2>
          <p>{exhibit.label}</p>
          {cardError && <p className="card-error" role="alert">{cardError}</p>}
          {shareError && <p className="card-error" role="alert">{shareError}</p>}
          <div className="exhibit-pagination">
            {result.exhibits.map((item, index) => <button key={item.number} onClick={() => setActiveExhibit(index)} className={index === activeExhibit ? 'active' : ''} aria-label={`Show exhibit ${item.number}`} aria-pressed={index === activeExhibit}>{item.number}</button>)}
          </div>
          <details className="behind-exhibit">
            <summary><span><Cpu size={15} /> Behind the exhibit</span><small>{dioramaMode === 'living' ? 'Living 2.5D' : 'Performance still'}</small><ChevronDown size={14} /></summary>
            <p>{hasMappedExhibits ? 'OpenAI generates the room from your photograph, reads the finished render to place three exhibits, then hands it to an adaptive Three.js stage.' : 'OpenAI generated this room from your photograph. The visual curator could not safely map markers, so the room opens with its interpretive labels instead.'}</p>
            <div className="tech-pipeline" aria-label="Museum generation pipeline">
              <span>Photo</span><ArrowRight aria-hidden="true" /><span>Generated room</span><ArrowRight aria-hidden="true" /><span>{hasMappedExhibits ? 'Mapped exhibits' : 'Safe labels'}</span><ArrowRight aria-hidden="true" /><span>Living view</span>
            </div>
          </details>
        </aside>
      </section>
      {postcard && <PostcardPrinter file={postcard.file} previewUrl={postcard.previewUrl} onClose={closePrinter} />}
    </main>
  );
}

async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error('Copy was unavailable.');
  await navigator.clipboard.writeText(text);
}

async function buildPostcard(result: MuseumRecord, exhibitIndex: number): Promise<File> {
  const architecture = getArchitecture(result.lens);
  const exhibit = result.exhibits[exhibitIndex] ?? result.exhibits[0];
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = result.imageUrl;
  await image.decode();

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
  context.fillText('ARCHITECTURAL WORLD', 72, 1015);
  context.fillStyle = '#ea6549';
  context.font = '700 29px Arial';
  context.letterSpacing = '1px';
  context.fillText(`${architecture.label.toUpperCase()} / ${architecture.world.toUpperCase()}`, 72, 1064);
  context.letterSpacing = '0px';

  const titleSize = result.title.length > 48 ? 61 : result.title.length > 28 ? 74 : 90;
  context.fillStyle = '#f2efe7';
  context.font = `italic ${titleSize}px Georgia`;
  const afterTitle = drawWrappedText(context, result.title, 72, 1174, 936, titleSize * 1.03, 2);

  const quoteTop = Math.max(1405, afterTitle + 40);
  context.fillStyle = '#ea6549';
  context.fillRect(72, quoteTop - 31, 40, 4);
  context.fillStyle = '#8f897e';
  context.font = '700 19px Arial';
  context.letterSpacing = '3px';
  context.fillText(`EXHIBIT ${exhibit.number} / ${exhibit.title.toUpperCase()}`, 72, quoteTop + 15);
  context.letterSpacing = '0px';
  context.fillStyle = '#c7c0b3';
  context.font = '36px Georgia';
  drawWrappedText(context, `“${exhibit.label}”`, 72, quoteTop + 76, 900, 48, 5);

  context.strokeStyle = '#3e3a33';
  context.beginPath();
  context.moveTo(72, 1811);
  context.lineTo(1008, 1811);
  context.stroke();
  context.fillStyle = '#777269';
  context.font = '18px Arial';
  context.letterSpacing = '2px';
  context.fillText(`PRIVATE COLLECTION / ${result.id.slice(0, 8).toUpperCase()}`, 72, 1861);
  context.textAlign = 'right';
  context.fillText('1080 × 1920', 1008, 1861);
  context.textAlign = 'left';
  context.letterSpacing = '0px';

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('The postcard could not be encoded.')), 'image/png'));
  const filename = `${result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'museum'}-story.png`;
  return new File([blob], filename, { type: 'image/png' });
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
