import type { Speaker, SpeakerAccount } from './types';

/**
 * REA-53 — speakers and the accounts they are. Medium term the speaker entity goes away and the
 * talks point at accounts; linking every speaker is the first step.
 */

export type AccountFilter = 'all' | 'linked' | 'unlinked';

export interface SpeakerLinkSuggestion {
  /** EMAIL: the speaker's e-mail is the account's. NAME: a name only one account has. */
  reason: 'EMAIL' | 'NAME';
  speakerId: string;
  speakerName: string | null;
  talks: number;
  account: SpeakerAccount;
}

export interface SpeakerAccountReview {
  total: number;
  withAccount: number;
  withoutAccount: number;
  withoutAccountWithTalks: number;
  suggestions: SpeakerLinkSuggestion[];
}

export const filterByAccount = (speakers: Speaker[], filter: AccountFilter): Speaker[] => {
  if (filter === 'linked') return speakers.filter(s => Boolean(s.account));
  if (filter === 'unlinked') return speakers.filter(s => !s.account);
  return speakers;
};
