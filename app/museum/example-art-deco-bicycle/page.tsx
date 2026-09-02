import { MuseumExhibition } from '@/components/museum-exhibition';
import { exampleMuseum } from '@/lib/museum';

export default function ExampleMuseumPage() {
  return <MuseumExhibition result={exampleMuseum} />;
}
