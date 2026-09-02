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
};

export function fallbackMuseum(title: string, lens: string): Omit<MuseumRecord, 'id' | 'imageUrl'> {
  const copy = {
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
  }[lens] ?? {
    subtitle: 'A private moment, temporarily on exhibition.',
    labels: [['The detail', 'A detail from the scene.'], ['The trace', 'A trace of the moment.'], ['The echo', 'What the scene leaves behind.']],
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
