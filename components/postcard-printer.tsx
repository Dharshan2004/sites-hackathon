'use client';

import Image from 'next/image';
import { Check, Download, Share2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export function PostcardPrinter({ file, previewUrl, onClose }: { file: File; previewUrl: string; onClose: () => void }) {
  const [printed, setPrinted] = useState(false);
  const [shared, setShared] = useState(false);
  const didPrint = useRef(false);
  const canShareFile = typeof navigator !== 'undefined'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });

  const download = useCallback(() => {
    const link = document.createElement('a');
    link.download = file.name;
    link.href = previewUrl;
    link.click();
  }, [file.name, previewUrl]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      if (didPrint.current) return;
      didPrint.current = true;
      download();
      setPrinted(true);
    }, reducedMotion ? 80 : 2050);
    return () => window.clearTimeout(timer);
  }, [download]);

  async function shareImage() {
    if (!canShareFile) { download(); return; }
    try {
      await navigator.share({ files: [file], title: 'My One Minute Museum', text: 'A moment, now on exhibition.' });
      setShared(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }

  return (
    <dialog className="printer-overlay" open aria-modal="true" aria-labelledby="printer-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <button type="button" className="printer-backdrop" onClick={onClose} aria-label="Close postcard printer" />
      <section className={printed ? 'postcard-printer is-printed' : 'postcard-printer'}>
        <button type="button" className="printer-close" onClick={onClose} aria-label="Close" autoFocus><X size={18} /></button>
        <div className="printer-copy">
          <span>Exhibition press</span>
          <h2 id="printer-title">{printed ? 'Your card is ready.' : 'Printing your museum card.'}</h2>
          <p>{printed ? 'The full museum is saved at 1080 × 1920, ready for Stories.' : 'Ink, paper and one tiny opening-night souvenir.'}</p>
        </div>
        <div className="printer-machine" aria-hidden="true">
          <div className="printer-light" />
          <div className="printer-slot" />
          <div className="postcard-sheet"><Image src={previewUrl} alt="" fill sizes="260px" unoptimized /></div>
          <div className="printer-footer"><span>ONE MINUTE MUSEUM</span><i /></div>
        </div>
        <div className="printer-actions">
          <Button type="button" variant="ghost" onClick={download} disabled={!printed}><Download /> Download again</Button>
          <Button type="button" onClick={shareImage} disabled={!printed}>{shared ? <Check /> : <Share2 />}{shared ? 'Shared' : canShareFile ? 'Share image' : 'Save image'}</Button>
        </div>
      </section>
    </dialog>
  );
}
