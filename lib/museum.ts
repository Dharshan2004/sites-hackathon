export type MuseumExhibit = {
  number: string;
  title: string;
  label: string;
  x: number;
  y: number;
};

export type MuseumRecord = {
  id: string;
  title: string;
  subtitle: string;
  lens: string;
  exhibits: MuseumExhibit[];
  imageUrl: string;
  mapped?: boolean;
};

export const exampleMuseum: MuseumRecord = {
  id: 'example-art-deco-bicycle',
  title: 'After the rain',
  subtitle: 'A red bicycle holds the street still while the city catches its reflection.',
  lens: 'art-deco',
  imageUrl: '/examples/art-deco-museum.jpg',
  exhibits: [
    {
      number: '01',
      title: 'The wheel in waiting',
      label: 'A bicycle wheel turns movement into a piece of still, brass-framed geometry.',
      x: 22,
      y: 55,
    },
    {
      number: '02',
      title: 'The colour of the corner',
      label: 'Teal ceramic tiles preserve the cafe facade as a material memory.',
      x: 78,
      y: 55,
    },
    {
      number: '03',
      title: 'Rain keeps the light',
      label: 'Red and cyan reflections turn wet pavement into an electric afterimage.',
      x: 50,
      y: 71,
    },
  ],
};

export function fallbackMuseum(title: string, lens: string): Omit<MuseumRecord, 'id' | 'imageUrl'> {
  const legacyCopy = {
    poetic: {
      subtitle: 'A small archive of light, distance, and what almost went unnoticed.',
      labels: [
        ['The first thing the light remembered', 'A familiar detail becomes the entrance to the whole scene.'],
        ['Evidence of somebody being here', 'Ordinary objects hold the shape of a life just outside the frame.'],
        ['The part that refuses to disappear', 'A colour, texture, or gesture carries the moment forward.'],
      ],
    },
    cinematic: {
      subtitle: 'One frame. Three clues. A story waiting just beyond the edges.',
      labels: [
        ['The establishing shot', 'Space, light, and scale quietly tell us where the story begins.'],
        ['The turning point', 'The eye is pulled toward the detail that changes the scene.'],
        ['After the credits', 'What remains suggests the story did not end with this photograph.'],
      ],
    },
    future: {
      subtitle: 'Recovered from the present and catalogued for visitors from tomorrow.',
      labels: [
        ['Domestic artefact, early digital era', 'Future historians may mistake the everyday for something ceremonial.'],
        ['A ritual of attention', 'The photograph proves that this detail once mattered enough to preserve.'],
        ['Unresolved object', 'Its purpose is uncertain; its emotional value appears unusually high.'],
      ],
    },
  }[lens];

  const architecturalSubtitles: Record<string, string> = {
    gothic: 'A private memory held beneath stone, coloured light, and impossible height.',
    'art-deco': 'A familiar moment recast in polished geometry, ceremony, and light.',
    'art-nouveau': 'One photograph unfolds through botanical lines, glass, and quiet movement.',
    brutalism: 'A small human moment finds scale inside concrete, shadow, and monumental form.',
    bauhaus: 'The scene is distilled into colour, function, and a precise visual rhythm.',
    moorish: 'A moment expands through patterned light, carved surfaces, and repeating space.',
    'ancient-egyptian': 'The everyday becomes ceremonial along an axis of sandstone, gold, and sun.',
    solarpunk: 'A memory from today is preserved inside a greener, more generous tomorrow.',
  };

  const copy = legacyCopy ?? {
    subtitle: architecturalSubtitles[lens] ?? 'A private moment, temporarily on exhibition.',
    labels: [
      ['The anchor', 'The central subject holds the room together and gives every other detail its meaning.'],
      ['A material memory', 'Colour and texture leave the photograph to become an object of their own.'],
      ['Light left behind', 'The atmosphere of the original moment returns as the final installation.'],
    ],
  };

  return {
    title,
    subtitle: copy.subtitle,
    lens,
    exhibits: copy.labels.map(([exhibitTitle, label], index) => ({
      number: String(index + 1).padStart(2, '0'),
      title: exhibitTitle,
      label,
      x: [28, 68, 50][index],
      y: [37, 48, 72][index],
    })),
  };
}
