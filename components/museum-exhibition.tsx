'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Aperture, ArrowLeft, Check, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MuseumRecord } from '@/lib/museum';
import { LivingDiorama } from '@/components/living-diorama';

export function MuseumExhibition({ result, onReset }: { result: MuseumRecord; onReset?: () => void }) {
  const [activeExhibit, setActiveExhibit] = useState(0);
  const [shared, setShared] = useState(false);
  const exhibit = result.exhibits[activeExhibit];

  async function shareMuseum() {
    const url = `${window.location.origin}/museum/${result.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: result.title, text: 'Visit my One Minute Museum', url }); return; } catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(url);
    setShared(true); window.setTimeout(() => setShared(false), 1800);
  }

  async function downloadCard() {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.src = result.imageUrl;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
    const context = canvas.getContext('2d'); if (!context) return;
    context.fillStyle = '#171713'; context.fillRect(0, 0, 1080, 1920);
    const scale = Math.max(1080 / image.width, 1210 / image.height);
    const width = image.width * scale; const height = image.height * scale;
    context.drawImage(image, (1080 - width) / 2, 190 + (1210 - height) / 2, width, height);
    const gradient = context.createLinearGradient(0, 1180, 0, 1920);
    gradient.addColorStop(0, 'rgba(23,23,19,0)'); gradient.addColorStop(.28, '#171713');
    context.fillStyle = gradient; context.fillRect(0, 1040, 1080, 880);
    context.fillStyle = '#ea6549'; context.fillRect(76, 78, 58, 6);
    context.fillStyle = '#f2efe7'; context.font = '32px Arial'; context.fillText('ONE MINUTE MUSEUM', 76, 137);
    context.font = 'italic 84px Georgia'; wrapText(context, result.title, 76, 1440, 920, 96);
    context.fillStyle = '#b9b3a7'; context.font = '32px Georgia'; wrapText(context, result.subtitle, 76, 1675, 900, 46);
    context.fillStyle = '#777269'; context.font = '22px Arial'; context.fillText(`UNLISTED COLLECTION  /  ${result.id.slice(0, 8).toUpperCase()}`, 76, 1840);
    const link = document.createElement('a');
    link.download = `${result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'museum'}-story.png`;
    link.href = canvas.toDataURL('image/png'); link.click();
  }

  return (
    <main className="exhibition-view">
      <nav className="exhibition-nav">
        {onReset ? <button onClick={onReset}><ArrowLeft size={16} /> New museum</button> : <Link className="new-museum-link" href="/"><ArrowLeft size={16} /> Make yours</Link>}
        <div className="exhibition-brand"><Aperture size={17} /> One Minute Museum</div>
        <div className="exhibition-actions">
          <Button variant="ghost" onClick={downloadCard}><Download /> Card</Button>
          <Button onClick={shareMuseum}>{shared ? <Check /> : <Share2 />}{shared ? 'Copied' : 'Share'}</Button>
        </div>
      </nav>
      <section className="museum-room">
        <div className="room-header"><span>Unlisted collection / {result.id.slice(0, 8)}</span><span>{result.lens} lens</span></div>
        <div className="diorama-stage">
          <LivingDiorama src={result.imageUrl} alt={`The miniature museum of ${result.title}`} focus={{ x: exhibit.x, y: exhibit.y }} />
          <div className="stage-vignette" />
          {result.exhibits.map((item, index) => (
            <button key={item.number} className={activeExhibit === index ? 'hotspot active' : 'hotspot'} style={{ left: `${item.x}%`, top: `${item.y}%` }} onClick={() => setActiveExhibit(index)} aria-label={`Open exhibit ${item.number}: ${item.title}`}><span>{item.number}</span></button>
          ))}
        </div>
        <aside className="museum-label">
          <div className="label-number">EXHIBIT {exhibit.number} / 03</div>
          <h1>{result.title}</h1><div className="label-rule" /><h2>{exhibit.title}</h2><p>{exhibit.label}</p>
          <div className="exhibit-pagination">{result.exhibits.map((item, index) => <button key={item.number} onClick={() => setActiveExhibit(index)} className={index === activeExhibit ? 'active' : ''}>{item.number}</button>)}</div>
        </aside>
      </section>
    </main>
  );
}

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number) {
  const words = text.split(' '); let line = ''; let cursor = y;
  for (const word of words) { const test = `${line}${word} `; if (context.measureText(test).width > width && line) { context.fillText(line, x, cursor); line = `${word} `; cursor += lineHeight; } else line = test; }
  context.fillText(line, x, cursor);
}
