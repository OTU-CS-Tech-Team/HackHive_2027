import HackHiveMuseum from '@/components/museum/HackHiveMuseum';
import { getArchiveCollections } from '@/data/hackhive';

export const metadata = {
  title: 'HackHive Museum',
  description: 'Explore the HackHive universe. Project constellations from 2026, 2025, and 2024.',
};

export default function HackHiveArchivePage() {
  return (
    <main className="pt-16">
      <HackHiveMuseum collections={getArchiveCollections()} />
    </main>
  );
}
