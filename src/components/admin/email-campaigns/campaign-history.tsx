'use client';

import { useMutation } from '@apollo/client';
import { Pause, Play, X } from 'lucide-react';
import { toast } from 'sonner';

import { AdminEmpty } from '@/components/admin/admin-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { STATUS_LABELS, campaignTitle, progressPercent } from '@/lib/email-campaign';
import { UPDATE_EMAIL_CAMPAIGN_STATUS } from '@/lib/queries';
import type { EmailCampaign } from '@/lib/types';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

interface CampaignHistoryProps {
  eventSlug: string;
  campaigns: EmailCampaign[];
  /** The invite campaign is admin only: an organizer sees it but cannot change it. */
  isAdmin: boolean;
}

export function CampaignHistory({ eventSlug, campaigns, isAdmin }: CampaignHistoryProps) {
  const [update, { loading }] = useMutation(UPDATE_EMAIL_CAMPAIGN_STATUS);

  const act = async (id: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      await update({ variables: { eventSlug, id, action } });
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível mudar a campanha.');
    }
  };

  if (campaigns.length === 0) return <AdminEmpty>Nenhum e-mail enviado para este evento ainda.</AdminEmpty>;

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>E-mail</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="min-w-40">Progresso</TableHead>
            <TableHead>Início</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => {
            const editable = isAdmin || campaign.type !== 'invite';
            return (
              <TableRow key={campaign.id}>
                <TableCell>
                  <div className="font-medium">{campaignTitle(campaign.type)}</div>
                  <div className="max-w-xs truncate text-xs text-muted-foreground">{campaign.subject}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={campaign.status === 'sending' ? 'default' : 'secondary'}>{STATUS_LABELS[campaign.status]}</Badge>
                </TableCell>
                <TableCell>
                  <Progress value={progressPercent(campaign)} className="h-2" />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {campaign.sent.toLocaleString('pt-BR')} de {campaign.total.toLocaleString('pt-BR')} enviados
                    {campaign.failed ? ` · ${campaign.failed} com falha` : ''}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(campaign.started_at)}
                  {campaign.created_by_email && (
                    <div className="text-xs text-muted-foreground">{campaign.created_by_email}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editable && (
                    <div className="flex justify-end gap-1">
                      {campaign.status === 'sending' && (
                        <Button size="sm" variant="ghost" disabled={loading} onClick={() => act(campaign.id, 'pause')} aria-label="Pausar">
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {campaign.status === 'paused' && (
                        <Button size="sm" variant="ghost" disabled={loading} onClick={() => act(campaign.id, 'resume')} aria-label="Retomar">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {(campaign.status === 'sending' || campaign.status === 'paused') && (
                        <Button size="sm" variant="ghost" disabled={loading} onClick={() => act(campaign.id, 'cancel')} aria-label="Cancelar">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
