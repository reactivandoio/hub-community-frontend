import { describe, it, expect } from 'vitest';
import { ticketUrl } from '../ticket';

describe('ticketUrl', () => {
  it('builds the signup page URL with the ticket param', () => {
    expect(ticketUrl('meetup-2026', 'abc123', 'https://hubcommunity.io')).toBe(
      'https://hubcommunity.io/events/meetup-2026/signup?ticket=abc123'
    );
  });

  it('drops a trailing slash from the base and encodes the id', () => {
    expect(ticketUrl('ev', 'a b', 'https://x.io/')).toBe('https://x.io/events/ev/signup?ticket=a%20b');
  });
});
