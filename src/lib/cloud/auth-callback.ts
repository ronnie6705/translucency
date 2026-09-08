import type { SupabaseClient } from '@supabase/supabase-js';

export type CallbackInput =
  | { kind: 'error'; code: string }
  | { kind: 'code'; code: string; flowId?: string }
  | { kind: 'unsupported' }
  | { kind: 'missing' };
export type CallbackResult = { kind: 'error'; message: string } | { kind: 'signed-in' | 'recovery' };
const recoveryKey = 'rhythm-password-recovery-user';

export function parseAuthCallback(url: URL): CallbackInput {
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.slice(1));
  // Never display a provider-supplied description, which may contain sensitive data.
  if (['error', 'error_code', 'error_description'].some(key => query.has(key) || fragment.has(key))) {
    return { kind: 'error', code: query.get('error_code') || fragment.get('error_code') || query.get('error') || fragment.get('error') || 'unknown' };
  }
  if (query.get('code')) return { kind: 'code', code: query.get('code')!, ...(query.has('sb_flow_id') ? { flowId: query.get('sb_flow_id')! } : {}) };
  // Do not switch to implicit authentication or accept arbitrary tokens from a URL.
  if (['access_token', 'refresh_token', 'token_hash', 'token'].some(key => query.has(key) || fragment.has(key))) return { kind: 'unsupported' };
  return { kind: 'missing' };
}

export function callbackErrorMessage(error: { code?: string; name?: string; status?: number }): string {
  if (['otp_expired', 'flow_state_expired', 'flow_state_not_found'].includes(error.code ?? '')) return 'This email link has expired or has already been used. Once email sending is available again, request one new link and open the newest email in the browser where you requested it.';
  if (error.name === 'AuthPKCECodeVerifierMissingError' || ['bad_code_verifier', 'pkce_verifier_not_found', 'pkce_verifier_mismatch'].includes(error.code ?? '')) return 'This browser cannot match the link to its sign-in request. Open the newest email in the same browser and device where you requested it. If browser data was cleared or you requested another link, wait for email sending to reset before requesting a fresh one.';
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) return 'Authentication is temporarily rate-limited. Wait before trying again. This page has not requested another email.';
  if (error.name === 'AuthRetryableFetchError' || error.name === 'TypeError' || (error.status ?? 0) >= 500) return 'The sign-in service could not be reached. Check your connection, then reopen the newest email link in this browser. No new email has been requested.';
  return 'The sign-in service could not verify this link. Open the newest email in the browser where you requested it. If it still fails, wait for email sending to reset before requesting a new link.';
}

export function clearPasswordRecovery() {
  try { sessionStorage.removeItem(recoveryKey); } catch { /* Private browser storage may be unavailable. */ }
}

export async function finishAuthCallback(client: SupabaseClient | null, input: CallbackInput): Promise<CallbackResult> {
  if (!client) return { kind: 'error', message: 'Account connection is not configured for this deployment. Please contact the app owner; requesting another email will not fix this.' };
  if (input.kind === 'error') return { kind: 'error', message: callbackErrorMessage({code:input.code}) };
  if (input.kind === 'unsupported') return { kind: 'error', message: 'This link uses a sign-in format this app does not accept. Return to sign in and request a fresh link once email sending is available. Open it in the same browser.' };
  try {
    if (input.kind === 'missing') {
      const { data, error } = await client.auth.getSession();
      if (error) return { kind: 'error', message: callbackErrorMessage(error) };
      if (data.session) {
        // This is only a UI continuation hint, never proof of authentication.
        // A Supabase session is still required, and writes remain protected by RLS.
        try { if (sessionStorage.getItem(recoveryKey) === data.session.user.id) return { kind: 'recovery' }; } catch { /* Fall through to the signed-in workspace. */ }
        return { kind: 'signed-in' };
      }
      return { kind: 'error', message: 'This page has no sign-in code. Open the button in your newest email rather than reopening this confirmation page. If the link was already used or expired, request a new one only after email sending is available again.' };
    }
    let recovery = false;
    const { data: { subscription } } = client.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') recovery = true; });
    try {
      // Save and explicitly pass the flow ID before the page removes URL credentials.
      const { data, error } = await client.auth.exchangeCodeForSession(input.code, input.flowId !== undefined ? { flowId: input.flowId } : undefined);
      if (error) return { kind: 'error', message: callbackErrorMessage(error) };
      if (!data.session) return { kind: 'error', message: callbackErrorMessage({}) };
      if (recovery) {
        try { sessionStorage.setItem(recoveryKey, data.session.user.id); } catch { /* Recovery still works without refresh persistence. */ }
        return { kind: 'recovery' };
      }
      clearPasswordRecovery();
      return { kind: 'signed-in' };
    } finally { subscription.unsubscribe(); }
  } catch (error) { return { kind: 'error', message: callbackErrorMessage(error as Error) }; }
}
