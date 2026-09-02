'use client';

import { DraftingCompass, Lightbulb, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getArchitecture, type ArchitectureId } from '@/lib/architectures';

export function BlueprintWorkshop({ architecture, progress }: { architecture: ArchitectureId; progress: string }) {
  const world = getArchitecture(architecture);
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setFactIndex((current) => (current + 1) % world.facts.length), 5600);
    return () => window.clearInterval(timer);
  }, [world.facts.length]);

  return (
    <output className="blueprint-workshop" data-architecture={world.id} aria-live="polite">
      <div className="blueprint-heading">
        <span><DraftingCompass size={15} /> Live architectural study</span>
        <span className="blueprint-pulse">OpenAI is building</span>
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
        <p className="workshop-progress">{progress}</p>
        <div className="architecture-fact">
          <Lightbulb size={15} />
          <p key={`${world.id}-${factIndex}`}><span>ARCHITECT&apos;S NOTE</span>{world.facts[factIndex]}</p>
        </div>
      </div>
    </output>
  );
}
