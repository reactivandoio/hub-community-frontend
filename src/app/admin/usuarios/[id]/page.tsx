'use client';

import { useQuery } from '@apollo/client';
import { useParams, useRouter } from 'next/navigation';

import { AdminPage, AdminPageError, AdminPageHeader, AdminPageLoading } from '@/components/admin/admin-page';
import { UserEmailsTab } from '@/components/admin/user-profile/user-emails-tab';
import { UserProfileView } from '@/components/admin/user-profile/user-profile-view';
import { FadeIn } from '@/components/animations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ADMIN_USER_PROFILE } from '@/lib/queries';
import type { AdminUserProfile } from '@/lib/types';

/**
 * REA-52: everything about one user, admin only (ADMIN_ONLY_PATHS covers /admin/usuarios; the BFF
 * checks it again). Opened from /admin/usuarios and /admin/usuarios/idade.
 */
export default function AdminUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = String(params?.id || '');
  const { data, loading, error } = useQuery<{ adminUserProfile: AdminUserProfile | null }>(ADMIN_USER_PROFILE, {
    variables: { userId },
    skip: !userId,
    fetchPolicy: 'network-only',
  });
  const profile = data?.adminUserProfile;
  const back = { label: 'Voltar para a lista', onClick: () => router.push('/admin/usuarios') };

  if (loading && !profile) return <AdminPageLoading label="Carregando usuário" />;
  if (error) return <AdminPageError message={error.message} action={back} />;
  if (!profile) return <AdminPageError title="Usuário não encontrado" action={back} />;

  return (
    <FadeIn>
      <AdminPage>
        <AdminPageHeader title={profile.name || profile.username || profile.email || 'Usuário'} description={profile.email} />
        <Tabs defaultValue="perfil" className="space-y-4">
          <TabsList>
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="emails">
              E-mails{typeof profile.email_count === 'number' ? ` (${profile.email_count})` : ''}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="perfil">
            <UserProfileView profile={profile} />
          </TabsContent>
          <TabsContent value="emails">
            <UserEmailsTab userId={userId} />
          </TabsContent>
        </Tabs>
      </AdminPage>
    </FadeIn>
  );
}
