import type { Metadata } from 'next';

import { ShareArtPage } from '@/components/share-art/share-art-page';

export const metadata: Metadata = {
  title: 'Gerar arte "me inscrevi" | Hub Community',
  robots: { index: false, follow: false },
};

interface ShareArtRouteProps {
  params: Promise<{ id: string }>;
}

export default async function ShareArtRoute({ params }: ShareArtRouteProps) {
  const { id } = await params;
  return <ShareArtPage slugOrId={id} />;
}
