'use client';

import { DraftingCompass, Lightbulb, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getArchitecture, type ArchitectureId } from '@/lib/architectures';

export type WorkshopPhase = 'preparing' | 'rendering' | 'mapping';

export function BlueprintWorkshop({ architecture, progress, phase, startedAt }: { architecture: ArchitectureId; progress: string; phase: WorkshopPhase; startedAt: number }) {
  const world = getArchitecture(architecture);
  const [factIndex, setFactIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setFactIndex((current) => (current + 1) % world.facts.length), 5600);
    return () => window.clearInterval(timer);
  }, [world.facts.length]);

  useEffect(() => {
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <section className="blueprint-workshop" data-architecture={world.id} aria-label="Museum construction progress">
      <div className="blueprint-heading">
        <span><DraftingCompass size={15} /> Live architectural study</span>
        <span className="blueprint-pulse" aria-hidden="true">{formatElapsed(elapsed)}</span>
      </div>

      <div className="blueprint-sheet" aria-hidden="true">
        <div className="blueprint-grid" />
        <div className="blueprint-measure blueprint-measure-x">18.4 M</div>
        <div className="blueprint-measure blueprint-measure-y">SECTION A</div>
        <div className="blueprint-plan">
          <span className="plan-wall wall-one" />
          <span className="plan-wall wall-two" />
          <span className="plan-wall wall-three" />
          <span className="plan-wall wall-four" />
          <span className="plan-core" />
          <span className="plan-light" />
        </div>
        <ScanLine className="blueprint-scan" size={22} />
        <div className="blueprint-title"><small>ROOM STUDY</small><strong>{world.world}</strong></div>
      </div>

      <div className="blueprint-readout">
        <div className="construction-list" aria-hidden="true">
          <span><i />Structure <b>{world.blueprint.structure}</b></span>
          <span><i />Material <b>{world.blueprint.material}</b></span>
          <span><i />Light <b>{world.blueprint.light}</b></span>
        </div>
        <div className="workshop-status">
          <ol className="workshop-phases" aria-label="Construction stages">
            <li className={phase === 'preparing' ? 'active' : 'complete'} aria-current={phase === 'preparing' ? 'step' : undefined}>Optimize photo</li>
            <li className={phase === 'rendering' ? 'active' : phase === 'mapping' ? 'complete' : ''} aria-current={phase === 'rendering' ? 'step' : undefined}>Generate room</li>
            <li className={phase === 'mapping' ? 'active' : ''} aria-current={phase === 'mapping' ? 'step' : undefined}>Map 3 exhibits</li>
          </ol>
          <output className="workshop-progress" aria-live="polite">{progress}</output>
          <div className="workshop-reassurance"><span>Your job is saved on this device while it builds.</span><Link href="/museum/example-art-deco-bicycle" target="_blank" rel="noopener" aria-label="Tour the example while this builds (opens in a new tab)">Tour the example while this builds</Link></div>
        </div>
        <div className="architecture-fact">
          <Lightbulb size={15} />
          <p key={`${world.id}-${factIndex}`}><span>ARCHITECT&apos;S NOTE</span>{world.facts[factIndex]}</p>
        </div>
      </div>
    </section>
  );
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remainder} elapsed`;
}
