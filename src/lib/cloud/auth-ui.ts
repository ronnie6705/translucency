const pages = new Set(['rhythm', 'rhythm-tasks', 'rhythm-timeblocks', 'home', 'check-in', 'water', 'drying', 'signals', 'roles', 'custom-roles', 'session', 'journey', 'insights', 'settings', 'privacy']);
const returnKey = 'rhythm-auth-return-page';
export function safeReturnPath(hash: string | null): string {
  const page = (hash ?? '').replace(/^#/, '');
  return `/#${pages.has(page) ? page : 'rhythm'}`;
}
export function rememberReturnPage() {
  try { localStorage.setItem(returnKey, location.hash); } catch { /* Storage can be unavailable. */ }
}
export function authReturnPath() {
  try { return safeReturnPath(localStorage.getItem(returnKey)); } catch { return '/#rhythm'; }
}
export function authErrorMessage(error: { message?: string; code?: string }) {
  if (error.code === 'over_email_send_rate_limit' || /email.*rate limit/i.test(error.message ?? '')) return 'Email sending is temporarily limited. If you already have a password, sign in with it. Otherwise, wait up to an hour before requesting another email.';
  if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message ?? '')) return 'The email or password is incorrect. If you previously used an email link, choose “Forgot or need a password?” to set one.';
  if (error.code === 'email_not_confirmed') return 'Please confirm your email using the link in your inbox before signing in.';
  return error.message || 'Unable to connect. Please check your connection and try again.';
}
