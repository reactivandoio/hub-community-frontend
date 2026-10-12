'use client';

import { useLazyQuery, useMutation } from '@apollo/client';
import {
  Check,
  Loader2,
  Search,
  UserCheck,
  Users,
  Smartphone,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HalfPriceBadge } from '@/components/half-price-badge';
import { useEventSignupsQuery } from '@/hooks/use-half-price-field';
import { CHECKIN_SIGNUP, EVENT_SIGNUPS } from '@/lib/queries';
import {
  CheckinSignupResponse,
  EventSignup,
  EventSignupsResponse,
} from '@/lib/types';

export default function CheckinPage() {
  const params = useParams();
  const eventSlug = params?.eventSlug as string;

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [signups, setSignups] = useState<EventSignup[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // GraphQL operations
  const signupsQuery = useEventSignupsQuery();
  const [fetchSignups, { loading: loadingSignups }] = useLazyQuery<EventSignupsResponse>(
    signupsQuery ?? EVENT_SIGNUPS,
    {
      fetchPolicy: 'network-only',
      onCompleted: (data) => {
        setSignups(data?.eventSignups || []);
        // Track already checked-in IDs
        const alreadyCheckedIn = new Set(
          (data?.eventSignups || [])
            .filter((s) => s.checked_in)
            .map((s) => s.id)
        );
        setCheckedInIds(prev => new Set([...prev, ...alreadyCheckedIn]));
      },
    }
  );

  const [checkinMutation, { loading: loadingCheckin }] = useMutation<CheckinSignupResponse>(
    CHECKIN_SIGNUP
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch signups when debounced search changes (min 2 chars)
  useEffect(() => {
    if (!signupsQuery) return;
    if (debouncedSearch.trim().length >= 2) {
      setHasSearched(true);
      fetchSignups({
        variables: { eventSlug, search: debouncedSearch.trim() },
      });
    } else {
      setSignups([]);
      if (debouncedSearch.trim().length > 0) {
        setHasSearched(false);
      }
    }
  }, [debouncedSearch, eventSlug, fetchSignups, signupsQuery]);

  // Handle check-in
  const handleCheckin = useCallback(
    async (signup: EventSignup) => {
      setCheckingInId(signup.id);
      setSuccessMessage(null);

      try {
        const { data } = await checkinMutation({
          variables: { eventSlug, signupId: signup.id },
        });

        if (data?.checkinSignup?.success) {
          setCheckedInIds((prev) => new Set([...prev, signup.id]));
          setSuccessMessage(`✅ ${signup.name} — check-in realizado!`);

          // Auto-dismiss success after 5s
          setTimeout(() => setSuccessMessage(null), 5000);
        } else {
          alert(data?.checkinSignup?.message || 'Erro ao fazer check-in.');
        }
      } catch (err: any) {
        alert(`Erro: ${err.message}`);
      } finally {
        setCheckingInId(null);
      }
    },
    [checkinMutation, eventSlug]
  );

  const isCheckedIn = (id: string) => checkedInIds.has(id);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Credenciamento</h1>
              <p className="text-xs text-muted-foreground">
                Busque seu nome para fazer check-in
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-md animate-in fade-in slide-in-from-top-2">
          <div className="bg-emerald-500/95 backdrop-blur text-white rounded-2xl px-5 py-4 shadow-2xl shadow-emerald-500/25 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Digite seu nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-4 h-14 text-base rounded-2xl border-border/50 bg-card 
                       shadow-sm focus-visible:ring-primary/30 focus-visible:ring-offset-0"
            autoFocus
            autoComplete="off"
          />
          {loadingSignups && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-spin" />
          )}
        </div>

        {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Digite pelo menos 2 caracteres para buscar
          </p>
        )}
      </div>

      {/* Results */}
      <div className="max-w-lg mx-auto px-4 pb-12">
        {signups.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {signups.length} resultado{signups.length !== 1 ? 's' : ''}
              </span>
            </div>

            {signups.map((signup) => {
              const checked = isCheckedIn(signup.id);

              return (
                <div
                  key={signup.id}
                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                    checked
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30'
                      : 'bg-card border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5'
                  }`}
                >
                  <div className="p-4 flex items-center gap-4">
                    {/* Avatar/Status */}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                        checked
                          ? 'bg-emerald-500/15 dark:bg-emerald-500/20'
                          : 'bg-muted/50'
                      }`}
                    >
                      {checked ? (
                        <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground uppercase">
                          {signup.name.charAt(0)}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold truncate ${
                          checked ? 'text-emerald-700 dark:text-emerald-300' : ''
                        }`}
                      >
                        {signup.name}
                      </p>
                      {signup.product_name && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {signup.product_name}
                        </p>
                      )}
                      {signup.half_price && <HalfPriceBadge className="mt-1" />}
                    </div>

                    {/* Action */}
                    {checked ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Check className="w-4 h-4" />
                        <span className="text-xs font-semibold">Check-in feito</span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleCheckin(signup)}
                        disabled={loadingCheckin && checkingInId === signup.id}
                        className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 
                                   transition-all active:scale-95 px-5 h-10"
                      >
                        {loadingCheckin && checkingInId === signup.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Check-in'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {hasSearched && !loadingSignups && signups.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Nenhuma inscrição encontrada
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Verifique o nome digitado ou procure pelo organizador
            </p>
          </div>
        )}

        {/* Initial state */}
        {!hasSearched && signups.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-6">
              <Search className="w-9 h-9 text-primary/40" />
            </div>
            <p className="text-base font-medium text-muted-foreground">
              Digite seu nome acima
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              para encontrar sua inscrição e fazer check-in
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
