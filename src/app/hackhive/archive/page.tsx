import HackHiveMuseum from '@/components/museum/HackHiveMuseum';
import { getArchiveCollections } from '@/data/hackhive';

export const metadata = {
  title: 'HackHive Museum',
  description: 'Museum archive of HackHive projects, year by year.',
};

export default function HackHiveArchivePage() {
  return (
    <main className="pt-16">
      <HackHiveMuseum collections={getArchiveCollections()} />
    </main>
  );
}
