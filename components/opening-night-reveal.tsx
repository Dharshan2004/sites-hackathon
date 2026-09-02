'use client';

import { Aperture } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { getArchitecture, type ArchitectureId } from '@/lib/architectures';

export function OpeningNightReveal({ architecture, children, onComplete }: { architecture: ArchitectureId; children: ReactNode; onComplete: () => void }) {
  const world = getArchitecture(architecture);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(onComplete, reducedMotion ? 100 : 2100);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="opening-night">
      <div className="opening-night-scene" inert aria-hidden="true">{children}</div>
      <div className="reveal-house" aria-live="polite">
        <div className="reveal-panel reveal-panel-left"><span /></div>
        <div className="reveal-panel reveal-panel-right"><span /></div>
        <div className="reveal-invitation">
          <Aperture size={24} />
          <span>Opening night</span>
          <strong>{world.world}</strong>
          <small>The doors are opening</small>
        </div>
      </div>
    </div>
  );
}
