'use client';

import Image from 'next/image';
import { Check, Download, Share2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export function PostcardPrinter({ file, previewUrl, exhibitTitle, onClose }: { file: File; previewUrl: string; exhibitTitle: string; onClose: () => void }) {
  const [printed, setPrinted] = useState(false);
  const [shared, setShared] = useState(false);
  const [shareError, setShareError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    const dialog = dialogRef.current;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      setPrinted(true);
    }, reducedMotion ? 80 : 1150);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      if (dialog?.open) dialog.close();
      returnFocus?.focus({ preventScroll: true });
    };
  }, []);

  async function shareImage() {
    if (!canShareFile) { download(); return; }
    setShareError('');
    try {
      await navigator.share({ files: [file], title: 'My One Minute Museum', text: 'A moment, now on exhibition.' });
      setShared(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      download();
      setShareError('Sharing was unavailable, so the card was saved instead.');
    }
  }

  return (
    <dialog ref={dialogRef} className="printer-overlay" aria-labelledby="printer-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <button type="button" className="printer-backdrop" onClick={onClose} aria-label="Close postcard printer" />
      <section className={printed ? 'postcard-printer is-printed' : 'postcard-printer'}>
        <button type="button" className="printer-close" onClick={onClose} aria-label="Close" autoFocus><X size={18} /></button>
        <div className="printer-copy">
          <span>Exhibition press</span>
          <h2 id="printer-title">{printed ? 'Your Story card is ready.' : 'Printing your museum card.'}</h2>
          <p>{printed ? `Your 1080 × 1920 card features “${exhibitTitle}” and includes a QR doorway back to the interactive museum.` : 'Ink, paper and one tiny opening-night souvenir.'}</p>
          <output className="sr-only" aria-live="polite">{printed ? 'Your Story card is ready to download or share.' : 'Your Story card is printing.'}</output>
          {shareError && <p className="printer-error" role="alert">{shareError}</p>}
        </div>
        <div className="printer-machine" aria-hidden="true">
          <div className="printer-light" />
          <div className="printer-slot" />
          <div className="postcard-sheet"><Image src={previewUrl} alt="" fill sizes="260px" unoptimized /></div>
          <div className="printer-footer"><span>ONE MINUTE MUSEUM</span><i /></div>
        </div>
        <div className="printer-actions">
          <Button type="button" variant="ghost" onClick={download} disabled={!printed}><Download /> Download card</Button>
          <Button type="button" onClick={shareImage} disabled={!printed}>{shared ? <Check /> : <Share2 />}{shared ? 'Shared' : canShareFile ? 'Share image' : 'Save image'}</Button>
        </div>
      </section>
    </dialog>
  );
}
