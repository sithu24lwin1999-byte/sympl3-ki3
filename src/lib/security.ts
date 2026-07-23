type ErrorWithCode = { code?: unknown };

export function authErrorMessage(issue: unknown) {
  const code = typeof issue === 'object' && issue !== null ? String((issue as ErrorWithCode).code || '') : '';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a few minutes, then try again.';
  if (code.includes('network-request-failed')) return 'Unable to reach the authentication service. Check your connection and try again.';
  if (code.includes('user-disabled')) return 'This account has been disabled. Contact an administrator.';
  if (code.includes('weak-password')) return 'Use a stronger password with at least 8 characters.';
  if (code.includes('email-already-in-use')) return 'That email address is already assigned to an account.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('requires-recent-login')) return 'For security, sign out and sign in again before changing this account.';
  if (code.includes('unauthorized-domain')) return 'This website domain is not authorized in Firebase Authentication.';
  return 'The email or password is incorrect, or this account cannot sign in.';
}

export function dataErrorMessage(issue: unknown) {
  const code = typeof issue === 'object' && issue !== null ? String((issue as ErrorWithCode).code || '') : '';
  if (code.includes('permission-denied')) return 'You do not have permission to access this data.';
  if (code.includes('unavailable') || code.includes('network')) return 'The data service is temporarily unavailable. Check your connection.';
  return 'Unable to load this data safely. Please try again.';
}

export function sanitizeAuditDetail(value: string) {
  return value
    .replace(/\b([A-Z0-9._%+-]{1,3})[A-Z0-9._%+-]*@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi, '$1***@$2')
    .slice(0, 500);
}
