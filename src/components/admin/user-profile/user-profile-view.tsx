'use client';

import type { ReactNode } from 'react';

import { AdminEmpty } from '@/components/admin/admin-page';
import { GuardedLink } from '@/components/admin/unsaved-guard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ageReviewLabel, formatDateBR, formatDateTimeBR } from '@/lib/admin-user';
import { signupPaymentView } from '@/lib/paid-signups';
import type { AdminEventRef, AdminUserProfile } from '@/lib/types';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{children ?? '—'}</dd>
    </div>
  );
}

function EventLink({ event }: { event?: AdminEventRef | null }) {
  if (!event) return <span className="text-muted-foreground">—</span>;
  return (
    <GuardedLink href={`/admin/events/${encodeURIComponent(event.id)}`} className="text-primary hover:underline">
      {event.title || event.slug || event.id}
    </GuardedLink>
  );
}

function Section({ title, count, children }: { title: string; count?: number | null; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {title}
          {typeof count === 'number' ? <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const unavailable = <AdminEmpty>Não foi possível carregar agora. Tente recarregar a página.</AdminEmpty>;

/** REA-52: the "Perfil" tab of /admin/usuarios/<id>. */
export function UserProfileView({ profile }: { profile: AdminUserProfile }) {
  const situation = profile.blocked
    ? <Badge variant="destructive">Desativado</Badge>
    : <Badge variant="secondary">Ativo</Badge>;
  const age = ageReviewLabel(profile.age_review_status);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Cadastro">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <Field label="Nome">{profile.name || '—'}</Field>
            <Field label="E-mail">{profile.email || '—'}</Field>
            <Field label="Usuário">{profile.username || '—'}</Field>
            <Field label="WhatsApp">{profile.phone || '—'}</Field>
            <Field label="CPF">{profile.cpf_masked || '—'}</Field>
            <Field label="Nascimento">{formatDateBR(profile.date_of_birth)}</Field>
            <Field label="18 anos ou mais">
              {profile.adult_declaration ? `Declarou em ${formatDateTimeBR(profile.adult_declaration_at)}` : 'Não declarou'}
            </Field>
            <Field label="Novidades por e-mail">
              {profile.marketing_opt_in ? `Aceitou em ${formatDateTimeBR(profile.marketing_opt_in_at)}` : 'Não'}
            </Field>
            <Field label="Conta criada em">{formatDateTimeBR(profile.created_at)}</Field>
          </dl>
        </Section>

        <Section title="Acesso">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <Field label="Papel">{profile.role?.name || 'Usuário'}</Field>
            <Field label="Situação">{situation}</Field>
            <Field label="Cadastro concluído">
              {profile.registration_pending === null || profile.registration_pending === undefined
                ? '—'
                : profile.registration_pending ? 'Não (nunca entrou com código)' : 'Sim'}
            </Field>
            {age ? <Field label="Revisão de idade">{age}</Field> : null}
            <Field label="Comunidades que organiza">
              {profile.communities.length ? profile.communities.map((c) => c.title || c.id).join(', ') : '—'}
            </Field>
            <Field label="Eventos que gere">
              {profile.events.length
                ? profile.events.map((e, i) => (
                  <span key={e.id}>{i > 0 ? ', ' : ''}<EventLink event={e} /></span>
                ))
                : '—'}
            </Field>
          </dl>
        </Section>
      </div>

      <Section title="Inscrições" count={profile.signups?.length}>
        {!profile.signups ? unavailable : profile.signups.length === 0 ? (
          <AdminEmpty>Nenhuma inscrição com este e-mail.</AdminEmpty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Inscrição</TableHead>
                  <TableHead>Check-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.signups.map((signup) => {
                  const payment = signupPaymentView(signup);
                  return (
                    <TableRow key={signup.id}>
                      <TableCell><EventLink event={signup.event} /></TableCell>
                      <TableCell className="text-sm">{signup.product_name || '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {payment.status}{payment.paid ? ` · ${payment.paid}` : ''}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDateTimeBR(signup.created_at)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {signup.checked_in ? (signup.checked_in_at ? formatDateTimeBR(signup.checked_in_at) : 'Sim') : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Certificados" count={profile.certificates?.length}>
          {!profile.certificates ? unavailable : profile.certificates.length === 0 ? (
            <AdminEmpty>Nenhum certificado.</AdminEmpty>
          ) : (
            <ul className="space-y-2 text-sm">
              {profile.certificates.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-2">
                  <EventLink event={c.event} />
                  <span className="text-muted-foreground">{c.category || 'Participante'} · {c.code || '—'}</span>
                  <span className="text-muted-foreground">emitido em {formatDateTimeBR(c.issued_at)}</span>
                  {c.revoked_at ? <Badge variant="destructive">Revogado</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Presenças" count={profile.attendances?.length}>
          {!profile.attendances ? unavailable : profile.attendances.length === 0 ? (
            <AdminEmpty>Nenhuma presença assinada.</AdminEmpty>
          ) : (
            <ul className="space-y-2 text-sm">
              {profile.attendances.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2">
                  <EventLink event={a.event} />
                  <span className="text-muted-foreground">{formatDateTimeBR(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
