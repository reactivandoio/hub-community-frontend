'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { TermhubSettingsPanel } from '@/components/admin/ai/termhub-settings';
import { AdminPage, AdminPageHeader, AdminPageLoading } from '@/components/admin/admin-page';
import { FadeIn } from '@/components/animations';

// REA-51: each admin user's own termhub token, used by "Gerar texto com IA" in the e-mail marketing.
function AiSettings() {
  const returnTo = useSearchParams()?.get('voltar');
  return (
    <FadeIn direction="up" duration={0.3}>
      <AdminPage>
        <AdminPageHeader
          title="IA (termhub)"
          description="Seu token pessoal do termhub para gerar textos do e-mail marketing com IA. Cada pessoa do admin usa o próprio."
        />
        <TermhubSettingsPanel returnTo={returnTo} />
      </AdminPage>
    </FadeIn>
  );
}

export default function AiSettingsPage() {
  return (
    <Suspense fallback={<AdminPageLoading label="Carregando configuração de IA" />}>
      <AiSettings />
    </Suspense>
  );
}
