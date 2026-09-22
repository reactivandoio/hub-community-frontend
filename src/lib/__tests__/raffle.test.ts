import { describe, it, expect } from 'vitest';
import { raffleNamesFromSignups, raffleUrl } from '../raffle';

describe('raffleNamesFromSignups', () => {
  it('keeps only the people who checked in', () => {
    const names = raffleNamesFromSignups([
      { id: '1', name: 'Ana Souza', email: 'ana@x.io', checked_in: true },
      { id: '2', name: 'Bia Lima', email: 'bia@x.io', checked_in: false },
      { id: '3', name: 'Caio Reis', email: null, checked_in: null },
    ]);

    expect(names).toEqual(['Ana Souza']);
  });

  it('trims names and drops the empty ones', () => {
    const names = raffleNamesFromSignups([
      { id: '1', name: '  Ana Souza ', email: 'ana@x.io', checked_in: true },
      { id: '2', name: '   ', email: 'bia@x.io', checked_in: true },
    ]);

    expect(names).toEqual(['Ana Souza']);
  });

  it('counts a person signed up twice with the same e-mail only once', () => {
    const names = raffleNamesFromSignups([
      { id: '1', name: 'Ana Souza', email: 'Ana@X.io', checked_in: true },
      { id: '2', name: 'Ana S.', email: 'ana@x.io ', checked_in: true },
    ]);

    expect(names).toEqual(['Ana Souza']);
  });

  it('keeps two different people who share a name', () => {
    const names = raffleNamesFromSignups([
      { id: '1', name: 'Ana Souza', email: 'ana1@x.io', checked_in: true },
      { id: '2', name: 'Ana Souza', email: null, checked_in: true },
    ]);

    expect(names).toEqual(['Ana Souza', 'Ana Souza']);
  });
});

describe('raffleUrl', () => {
  it('points the raffle at the event', () => {
    expect(raffleUrl('meetup-go')).toBe('/sorteio?event=meetup-go');
    expect(raffleUrl('a b')).toBe('/sorteio?event=a%20b');
  });
});
