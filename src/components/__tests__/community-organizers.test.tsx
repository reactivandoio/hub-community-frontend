import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { print } from 'graphql';

import { GET_COMMUNITY_BY_SLUG_OR_ID } from '@/lib/queries';
import type { Organizer } from '@/lib/types';
import { CommunityOrganizers, organizerAvatarUrl } from '../community-organizers';

// REA-54: on /communities/<slug> the organizer's photo never showed: the card drew only the
// initial, and the query did not even ask for the photo (it is the avatar of the user's speaker).
const PHOTO = 'https://manager.hubcommunity.io/uploads/IMG_2911_b6dad85786.JPG';
const organizer = (over: Partial<Organizer> = {}): Organizer => ({
  id: 'u1',
  username: 'pedrogoiania',
  name: 'Pedro Goiano',
  speaker: { name: 'Pedro Goiano', avatar: PHOTO },
  ...over,
});

describe('REA-54: foto do organizador da comunidade', () => {
  it('a query da página da comunidade pede a foto do organizador (speaker.avatar)', () => {
    const query = print(GET_COMMUNITY_BY_SLUG_OR_ID).replace(/\s+/g, ' ');
    expect(query).toMatch(/organizers \{[^}]*speaker \{[^}]*avatar/);
  });

  it('mostra a foto e o nome do organizador', () => {
    render(<CommunityOrganizers organizers={[organizer()]} />);
    const img = screen.getByRole('img', { name: 'Pedro Goiano' });
    expect(img.getAttribute('src')).toBe(PHOTO);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/users/pedrogoiania');
  });

  it('sem foto, ou se a foto não carrega, mostra a inicial', () => {
    const { rerender } = render(
      <CommunityOrganizers organizers={[organizer({ speaker: null })]} />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('P')).toBeTruthy();

    rerender(<CommunityOrganizers organizers={[organizer({ id: 'u2' })]} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('P')).toBeTruthy();
  });

  it('organizerAvatarUrl ignora valores vazios e aceita o avatar antigo', () => {
    expect(organizerAvatarUrl(organizer({ speaker: { avatar: '  ' } }))).toBeNull();
    expect(organizerAvatarUrl(organizer({ speaker: null, avatar: PHOTO }))).toBe(PHOTO);
  });
});
