import { describe, it, expect } from 'vitest';
import { AuthService } from './auth';

describe('AuthService', () => {
  const auth = new AuthService();

  it('creates a guest with a valid offline UUID', () => {
    const account = auth.createGuest('TestPlayer');
    expect(account.name).toBe('TestPlayer');
    expect(account.type).toBe('offline');
    expect(account.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(account.accessToken).toBeTruthy();
  });

  it('rejects empty guest names', () => {
    expect(() => auth.createGuest('')).toThrow('Name cannot be empty');
  });

  it('rejects invalid characters in guest names', () => {
    expect(() => auth.createGuest('Bad!Name')).toThrow();
  });

  it('rejects names longer than 16 chars', () => {
    expect(() => auth.createGuest('a'.repeat(17))).toThrow();
  });

  it('creates deterministic offline UUIDs for the same name', () => {
    const a = auth.createGuest('Steve');
    const b = auth.createGuest('Steve');
    expect(a.uuid).toBe(b.uuid);
  });

  it('creates different UUIDs for different names', () => {
    const a = auth.createGuest('Steve');
    const b = auth.createGuest('Alex');
    expect(a.uuid).not.toBe(b.uuid);
  });

  it('produces the same UUID as vanilla offline mode (case-insensitive)', () => {
    const upper = auth.createGuest('Steve');
    const lower = auth.createGuest('steve');
    // Vanilla always lowercases before hashing, so both should match
    expect(upper.uuid).toBe(lower.uuid);
  });
});
