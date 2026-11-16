'use client';

import { useMutation } from '@apollo/client';
import { CalendarClock, Pause, Play, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AdminEmpty } from '@/components/admin/admin-page';
import { GuardedLink } from '@/components/admin/unsaved-guard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminUserHref } from '@/lib/admin-user';
import { formatDateTime } from '@/lib/age-review';
import { STATUS_LABELS, campaignTitle } from '@/lib/email-campaign';
import { finishLabel, formatQueueDay, percentOf, todaySaoPaulo, usageLines } from '@/lib/email-queue';
import { UPDATE_EMAIL_CAMPAIGN_STATUS } from '@/lib/queries';
import type { AdminEmailQueue, AdminQueuedCampaign, EmailCampaignStatus } from '@/lib/types';

type Action = 'pause' | 'resume' | 'cancel';

function CampaignActions({ campaign, onChanged }: { campaign: AdminQueuedCampaign; onChanged: () => void }) {
  const [update, { loading }] = useMutation(UPDATE_EMAIL_CAMPAIGN_STATUS);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const act = async (action: Action) => {
    try {
      await update({ variables: { eventSlug: campaign.event_slug, id: campaign.id, action } });
      onChanged();
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível mudar a campanha.');
    }
  };
  const label = `${campaignTitle(campaign.type)} de ${campaign.event_title || campaign.event_slug || 'evento'}`;
  return (
    <div className="flex justify-end gap-1">
      {campaign.status === 'sending' && (
        <Button size="sm" variant="ghost" disabled={loading} onClick={() => act('pause')} aria-label={`Pausar ${label}`}>
          <Pause className="h-4 w-4" />
        </Button>
      )}
      {campaign.status === 'paused' && (
        <Button size="sm" variant="ghost" disabled={loading} onClick={() => act('resume')} aria-label={`Retomar ${label}`}>
          <Play className="h-4 w-4" />
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={loading} onClick={() => setConfirmCancel(true)} aria-label={`Cancelar ${label}`}>
        <X className="h-4 w-4" />
      </Button>
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              {label}: os {campaign.remaining.toLocaleString('pt-BR')} e-mails que faltam não serão enviados.
              Quem já recebeu não é afetado. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmCancel(false); void act('cancel'); }}>Cancelar campanha</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  return (
    <div className="space-y-1">
      <div className="text-sm">{label}</div>
      {limit ? <Progress value={percentOf(used, limit)} className="h-2" aria-label={label} /> : null}
    </div>
  );
}

/** REA-59: the body of /admin/emails. */
export function EmailQueueView({ queue, onChanged, now = new Date() }: { queue: AdminEmailQueue; onChanged: () => void; now?: Date }) {
  const today = todaySaoPaulo(now);
  const usage = usageLines(queue.usage);
  const titleOf = new Map(queue.campaigns.map((c) => [c.id, `${campaignTitle(c.type)} · ${c.event_title || c.event_slug || ''}`]));
  const dob = queue.dob_requests;

  return (
    <div className="space-y-6">
      {!queue.sending_enabled && (
        <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          O envio de campanhas está desligado neste servidor: nada da fila sai até ser ligado.
        </p>
      )}
      {queue.redirect_to && (
        <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          Modo de teste: todo e-mail de campanha vai para {queue.redirect_to}.
        </p>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Uso de e-mails</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Meter label={usage.today} used={queue.usage.sent_today} limit={queue.usage.daily_limit} />
          <Meter label={usage.month} used={queue.usage.sent_this_month} limit={queue.usage.monthly_limit} />
          <p className="text-sm text-muted-foreground sm:col-span-2">{usage.campaigns}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Campanhas na fila</CardTitle></CardHeader>
        <CardContent>
          {queue.campaigns.length === 0 ? (
            <AdminEmpty>Nenhuma campanha na fila.</AdminEmpty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Enviados</TableHead>
                    <TableHead className="text-right">Restantes</TableHead>
                    <TableHead>Previsão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        {campaign.event_slug ? (
                          <GuardedLink href={`/admin/events/${encodeURIComponent(campaign.event_slug)}/email`} className="font-medium text-primary hover:underline">
                            {campaign.event_title || campaign.event_slug}
                          </GuardedLink>
                        ) : (campaign.event_title || '—')}
                        <div className="max-w-xs truncate text-xs text-muted-foreground">{campaign.subject}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{campaignTitle(campaign.type)}</TableCell>
                      <TableCell>
                        <Badge variant={campaign.status === 'sending' ? 'default' : 'secondary'}>
                          {STATUS_LABELS[campaign.status as EmailCampaignStatus] || campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {campaign.total.toLocaleString('pt-BR')}{campaign.type === 'invite' ? '*' : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {campaign.sent.toLocaleString('pt-BR')}
                        {campaign.failed ? <div className="text-xs text-destructive">{campaign.failed} com falha</div> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{campaign.remaining.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {finishLabel(campaign, { enabled: queue.sending_enabled, todayYmd: today })}
                      </TableCell>
                      <TableCell><CampaignActions campaign={campaign} onChanged={onChanged} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {queue.campaigns.some((c) => c.type === 'invite') ? (
                <p className="mt-2 text-xs text-muted-foreground">* Convite para a base: total aproximado; quem já está inscrito sai na hora do envio.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" />Previsão de envio por dia</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.schedule.length === 0 ? (
            <AdminEmpty>Nada agendado para os próximos dias.</AdminEmpty>
          ) : (
            <ul className="space-y-2 text-sm">
              {queue.schedule.map((day) => (
                <li key={day.date} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="w-28 font-medium">{formatQueueDay(day.date, today)}</span>
                  <span className="tabular-nums">{day.count.toLocaleString('pt-BR')} e-mails</span>
                  <span className="text-muted-foreground">
                    {day.campaigns.map((part) => `${titleOf.get(part.id) || part.id} (${part.count})`).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {queue.schedule_truncated ? (
            <p className="mt-2 text-xs text-muted-foreground">A previsão mostra 120 dias; ainda sobra envio depois disso.</p>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            Previsão pelo limite do dia (menos a reserva) e pelo que sobra do mês. Campanhas pausadas não entram.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Pedidos de data de nascimento no prazo
            {dob ? <span className="ml-2 text-sm font-normal text-muted-foreground">{dob.total}</span> : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!dob ? (
            <AdminEmpty>Não foi possível carregar agora.</AdminEmpty>
          ) : dob.items.length === 0 ? (
            <AdminEmpty>Nenhum pedido esperando resposta.</AdminEmpty>
          ) : (
            <ul className="space-y-1 text-sm">
              {dob.items.map((user) => (
                <li key={user.id} className="flex flex-wrap gap-x-2">
                  <GuardedLink href={adminUserHref(user.id)} className="font-medium text-primary hover:underline">
                    {user.name || user.username || user.email}
                  </GuardedLink>
                  <span className="text-muted-foreground">
                    pedido em {formatDateTime(user.requestedAt)} · desativa em {formatDateTime(user.deadline)} se não responder
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
