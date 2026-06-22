'use client';

import { useQuery } from '@apollo/client';
import { ArrowRight, Calendar, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import { StaggerContainer, StaggerItem } from '@/components/animations';
import { Badge } from '@/components/ui/badge';
import { useFilters } from '@/contexts/filter-context';
import { GET_COMMUNITIES } from '@/lib/queries';
import { CommunitiesResponse, Community, Tag } from '@/lib/types';

import { adjustToBrazilTimezone, getNextFutureEvents } from '../utils/event';

export function CommunityGrid({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const { debouncedSearchTerm } = useFilters();

  const { data, error } = useQuery<CommunitiesResponse>(GET_COMMUNITIES, {
    variables: {
      filters: debouncedSearchTerm ? { title: { contains: 'over' } } : {},
    },
    fetchPolicy: 'network-only',
  });

  const communities = data?.communities?.data || [];

  // Call the onCountChange callback if provided
  React.useEffect(() => {
    if (onCountChange) {
      onCountChange(communities.length);
    }
  }, [onCountChange, communities.length]);

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-8 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Erro de Conexão
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            Não foi possível conectar ao servidor. Verifique se o
            servidor está rodando.
          </p>
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground transition-colors">Detalhes do erro</summary>
            <pre className="mt-2 text-xs bg-muted p-3 rounded-xl overflow-auto text-left">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-lg font-medium">
          {debouncedSearchTerm
            ? 'Nenhuma comunidade encontrada'
            : 'Nenhuma comunidade disponível'}
        </p>
        {debouncedSearchTerm && (
          <p className="text-muted-foreground/60 text-sm mt-1">
            Tente buscar com outros termos
          </p>
        )}
      </div>
    );
  }

  return (
    <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {communities?.map((community: Community) => {
        const imageSrc = community.images?.[0] || '/placeholder.svg';
        const communityNextEvents = getNextFutureEvents(community.events || []);

        return (
          <StaggerItem key={community.id}>
            <Link href={`/communities/${community.slug}`} className="block group h-full">
              <div className="relative flex flex-col h-full rounded-2xl border border-border/50 bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                {/* Image with overlay gradient */}
                <div className="relative h-44 overflow-hidden bg-muted">
                  <Image
                    src={imageSrc}
                    alt={
                      typeof community.title === 'string'
                        ? community.title
                        : 'Community'
                    }
                    width={400}
                    height={176}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    unoptimized
                    suppressHydrationWarning
                  />
                  {/* Subtle bottom gradient for image-to-content transition */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                  {/* Members badge overlaid on image */}
                  <div className="absolute bottom-3 left-3">
                    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-full">
                      <Users className="h-3 w-3" />
                      {typeof community.members_quantity === 'number'
                        ? `${community.members_quantity} membros`
                        : '0 membros'}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-4">
                  <h3 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
                    {typeof community.title === 'string'
                      ? community.title
                      : 'Título não disponível'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                    {typeof community.short_description === 'string'
                      ? community.short_description
                      : 'Descrição não disponível'}
                  </p>

                  {/* Tags */}
                  {community.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {community.tags.slice(0, 3).map((tag: Tag) => (
                        <Badge key={tag.id} variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full font-medium">
                          {typeof tag.value === 'string' ? tag.value : 'Tag'}
                        </Badge>
                      ))}
                      {community.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{community.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer with next event + arrow */}
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/40">
                    {!!communityNextEvents?.length ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>
                          Próximo:{' '}
                          {adjustToBrazilTimezone(
                            new Date(communityNextEvents[0].start_date)
                          ).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">
                        Sem eventos próximos
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                  </div>
                </div>
              </div>
            </Link>
          </StaggerItem>
        );
      })}
    </StaggerContainer>
  );
}
