export type ArchitectureId =
  | 'gothic'
  | 'art-deco'
  | 'art-nouveau'
  | 'brutalism'
  | 'bauhaus'
  | 'moorish'
  | 'ancient-egyptian'
  | 'solarpunk';

export type Architecture = {
  id: ArchitectureId;
  label: string;
  world: string;
  blueprint: {
    structure: string;
    material: string;
    light: string;
  };
  facts: readonly string[];
};

export const ARCHITECTURES: readonly Architecture[] = [
  {
    id: 'gothic',
    label: 'Gothic',
    world: 'Cathedral of Shadows',
    blueprint: { structure: 'Pointed vault', material: 'Dark stone and glass', light: 'Stained colour shafts' },
    facts: [
      'Pointed arches direct weight into columns, leaving more wall space for stained glass.',
      'Flying buttresses carry roof forces outside, allowing Gothic interiors to rise dramatically.',
      'Gothic light was designed to feel symbolic, coloured and almost material.',
    ],
  },
  {
    id: 'art-deco',
    label: 'Art Deco',
    world: 'Golden Metropolis',
    blueprint: { structure: 'Stepped symmetry', material: 'Black stone and brass', light: 'Sunburst glow' },
    facts: [
      'Art Deco paired ancient motifs with machine-age materials and precise geometry.',
      'Stepped silhouettes, chevrons and sunbursts made buildings feel fast and optimistic.',
      'Symmetry gives an Art Deco room ceremony before a single object enters it.',
    ],
  },
  {
    id: 'art-nouveau',
    label: 'Art Nouveau',
    world: 'Garden of Lines',
    blueprint: { structure: 'Whiplash curve', material: 'Iron, glass and oak', light: 'Leaf-filtered warmth' },
    facts: [
      'Art Nouveau joined architecture, furniture and ornament into one continuous artwork.',
      'Its famous whiplash line borrowed motion from stems, vines and curling hair.',
      'New ironwork let plant-like forms become structure as well as decoration.',
    ],
  },
  {
    id: 'brutalism',
    label: 'Brutalism',
    world: 'Concrete Giant',
    blueprint: { structure: 'Monumental block', material: 'Board-marked concrete', light: 'Hard clerestory beam' },
    facts: [
      'The name is linked to béton brut, the French term for raw concrete.',
      'Brutalist buildings make circulation, structure and material deliberately legible.',
      'Deep openings turn daylight into a strong graphic element against heavy walls.',
    ],
  },
  {
    id: 'bauhaus',
    label: 'Bauhaus',
    world: 'Primary Playground',
    blueprint: { structure: 'Functional grid', material: 'Steel, glass and plaster', light: 'Even studio daylight' },
    facts: [
      'The Bauhaus united art, craft and industry rather than treating them as separate disciplines.',
      'Circles, squares and primary colours became a visual grammar, not just decoration.',
      'Its rooms favour clear function, repeatable parts and honest construction.',
    ],
  },
  {
    id: 'moorish',
    label: 'Moorish',
    world: 'Infinite Palace',
    blueprint: { structure: 'Horseshoe arcade', material: 'Carved plaster and tile', light: 'Patterned courtyard light' },
    facts: [
      'Repeating geometry can imply a pattern continuing beyond the edge of the room.',
      'Horseshoe arches, muqarnas and tilework layer rhythm at several scales.',
      'Courtyards combine shade, water and reflected light into a passive climate system.',
    ],
  },
  {
    id: 'ancient-egyptian',
    label: 'Ancient Egyptian',
    world: 'Temple of the Sun',
    blueprint: { structure: 'Processional axis', material: 'Sandstone and gold', light: 'Solar threshold' },
    facts: [
      'Temple plans often move from bright public courts toward darker sacred chambers.',
      'Columns borrowed the profiles of papyrus, lotus and palm plants translated into stone.',
      'A strong central axis made arrival feel like a carefully staged procession.',
    ],
  },
  {
    id: 'solarpunk',
    label: 'Neo-futurism',
    world: 'Tomorrow Is Growing',
    blueprint: { structure: 'Biomorphic sweep', material: 'White shell and living canopy', light: 'Diffuse solar bloom' },
    facts: [
      'Neo-futurist forms use digital modelling to make structure and movement read as one gesture.',
      'Solarpunk imagines renewable systems and abundant plant life as visible civic architecture.',
      'Passive shade, planted skins and shared energy turn performance into part of the aesthetic.',
    ],
  },
] as const;

export function getArchitecture(id: string): Architecture {
  return ARCHITECTURES.find((item) => item.id === id) ?? ARCHITECTURES[1];
}
