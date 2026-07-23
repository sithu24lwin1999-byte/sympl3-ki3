import { describe, expect, it } from 'vitest';
import { authErrorMessage, dataErrorMessage, sanitizeAuditDetail } from '../security';

describe('safe security messages and audit details', () => {
  it('does not expose raw authentication errors', () => {
    expect(authErrorMessage({ code: 'auth/invalid-credential', message: 'internal detail' })).toBe('The email or password is incorrect, or this account cannot sign in.');
    expect(authErrorMessage({ code: 'auth/too-many-requests' })).toContain('Too many attempts');
  });

  it('maps database permission errors to safe text', () => {
    expect(dataErrorMessage({ code: 'permission-denied', message: '/shops/secret' })).not.toContain('/shops/secret');
  });

  it('redacts email addresses from audit descriptions', () => {
    expect(sanitizeAuditDetail('Created Aye (ayeaye@example.com)')).toBe('Created Aye (aye***@example.com)');
  });
});
