import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareArtPage } from '@/components/share-art/share-art-page';

// REA-45: who reaches the generator on /events/<slug>/arte.
const requestLogin = vi.fn();
let auth: { user: any; isAuthenticated: boolean; isHydrated: boolean };
let event: Record<string, unknown>;
let signedUp = false;
const skipped: Record<string, boolean> = {};
let lastGenerator: any = null;
let myRole: { role: string; source: string } | null = null;

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/login-prompt-context', () => ({
  useLoginPrompt: () => ({ requestLogin }),
}));
vi.mock('@/components/share-art/share-art-generator', () => ({
  ShareArtGenerator: (props: any) => {
    lastGenerator = props;
    return <div data-testid="generator" />;
  },
}));
// Matched by operation name (importing @/lib/queries in the factory deadlocks).
vi.mock('@apollo/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  // GET_SHARE_ART_CONFIG starts with its fragment: look for the operation.
  const name = (doc: any) =>
    doc?.definitions?.find((d: any) => d.kind === 'OperationDefinition')?.name?.value;
  return {
    ...actual,
    useQuery: (doc: any, options: any = {}) => {
      const op = name(doc);
      skipped[op] = Boolean(options.skip);
      if (options.skip) return { data: undefined, loading: false };
      if (op === 'GetEventBySlugOrId') return { data: { eventBySlugOrId: event }, loading: false };
      if (op === 'IsUserSignedUp') return { data: { isUserSignedUp: { is_signed_up: signedUp } }, loading: false };
      if (op === 'GetShareArtConfig') return { data: { shareArtConfig: null }, loading: false };
      if (op === 'MyShareArtRole') return { data: { myShareArtRole: myRole }, loading: false };
      return { data: undefined, loading: false };
    },
  };
});

const ANA = { name: 'Ana', email: 'ana@x.io' };
const anonymous = () => ({ user: null, isAuthenticated: false, isHydrated: true });
const loggedIn = () => ({ user: ANA, isAuthenticated: true, isHydrated: true });

beforeEach(() => {
  vi.clearAllMocks();
  auth = anonymous();
  event = { id: 'ev1', slug: 'meetup', title: 'Meetup', images: [] };
  signedUp = false;
  lastGenerator = null;
  myRole = null;
  for (const key of Object.keys(skipped)) delete skipped[key];
});

describe('ShareArtPage — art closed (default, as before REA-45)', () => {
  it('asks a visitor without an account to log in', () => {
    render(<ShareArtPage slugOrId="meetup" />);
    expect(screen.getByText('Entre para gerar sua arte')).toBeInTheDocument();
    expect(requestLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('generator')).not.toBeInTheDocument();
    expect(skipped.GetShareArtConfig).toBe(true);
  });

  it('sends a logged-in person who is not signed up to the event', () => {
    auth = loggedIn();
    render(<ShareArtPage slugOrId="meetup" />);
    expect(screen.getByText('Você ainda não está inscrito')).toBeInTheDocument();
    expect(screen.queryByTestId('generator')).not.toBeInTheDocument();
  });

  it('opens the generator for a signup', () => {
    auth = loggedIn();
    signedUp = true;
    render(<ShareArtPage slugOrId="meetup" />);
    expect(screen.getByTestId('generator')).toBeInTheDocument();
    expect(lastGenerator).toMatchObject({ signedUp: true, defaultName: 'Ana' });
    expect(screen.getByRole('heading', { name: 'Sua arte "me inscrevi"' })).toBeInTheDocument();
  });
});

describe('ShareArtPage — art open to everyone (share_art_open)', () => {
  beforeEach(() => {
    event.share_art_open = true;
  });

  it('opens the generator without an account and without the login prompt', () => {
    render(<ShareArtPage slugOrId="meetup" />);
    expect(screen.getByTestId('generator')).toBeInTheDocument();
    expect(requestLogin).not.toHaveBeenCalled();
    expect(lastGenerator).toMatchObject({ signedUp: false, defaultName: '' });
    // The organizer's custom art is used too.
    expect(skipped.GetShareArtConfig).toBe(false);
    expect(screen.getByRole('heading', { name: 'Sua arte "eu vou"' })).toBeInTheDocument();
    expect(screen.getByTestId('share-art-not-signed-up')).toHaveTextContent('Ainda não se inscreveu em Meetup?');
    expect(screen.getByRole('link', { name: 'Ver evento' })).toHaveAttribute('href', '/events/meetup');
  });

  it('opens it for a logged-in person who is not signed up, with their name', () => {
    auth = loggedIn();
    render(<ShareArtPage slugOrId="meetup" />);
    expect(lastGenerator).toMatchObject({ signedUp: false, defaultName: 'Ana' });
    expect(screen.getByTestId('share-art-not-signed-up')).toBeInTheDocument();
  });

  it('keeps "me inscrevi" and no invitation for a signup', () => {
    auth = loggedIn();
    signedUp = true;
    render(<ShareArtPage slugOrId="meetup" />);
    expect(lastGenerator).toMatchObject({ signedUp: true });
    expect(screen.queryByTestId('share-art-not-signed-up')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sua arte "me inscrevi"' })).toBeInTheDocument();
  });
});

// REA-47: the role on the organizer's art comes from the BFF, only for a logged-in person.
describe('ShareArtPage — the role of the person (REA-47)', () => {
  it('asks the BFF for the role of a logged-in signup and passes it on', () => {
    auth = loggedIn();
    signedUp = true;
    myRole = { role: 'Mentora', source: 'PRODUCT' };
    render(<ShareArtPage slugOrId="meetup" />);
    expect(skipped.MyShareArtRole).toBe(false);
    expect(lastGenerator).toMatchObject({ personRole: 'Mentora' });
  });

  it('does not ask without an account (the art is open): no role', () => {
    event.share_art_open = true;
    render(<ShareArtPage slugOrId="meetup" />);
    expect(skipped.MyShareArtRole).toBe(true);
    expect(lastGenerator).toMatchObject({ personRole: null });
  });

  it('gives the organizer their role even without a signup, when the art is open', () => {
    event.share_art_open = true;
    auth = loggedIn();
    myRole = { role: 'Organizador', source: 'ORGANIZER' };
    render(<ShareArtPage slugOrId="meetup" />);
    expect(lastGenerator).toMatchObject({ signedUp: false, personRole: 'Organizador' });
  });
});
