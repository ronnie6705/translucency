'use client';
import { useEffect, useRef, useState } from 'react';
import { cloudClient } from '@/lib/cloud/client';
import { authReturnPath } from '@/lib/cloud/auth-ui';
import { AuthFrame, PasswordUpdateForm } from '@/components/login-screen';
import { clearPasswordRecovery, finishAuthCallback, parseAuthCallback, type CallbackResult } from '@/lib/cloud/auth-callback';

export default function ConfirmSignIn() {
  const [message,setMessage] = useState('Finishing your sign-in…');
  const [recovery,setRecovery] = useState(false);
  const [failed,setFailed] = useState(false);
  const [returnPath,setReturnPath] = useState('/');
  const pending = useRef<Promise<CallbackResult> | null>(null);
  useEffect(() => {
    let cancelled = false;
    setReturnPath(authReturnPath());
    if (!pending.current) {
      const input = parseAuthCallback(new URL(location.href));
      // Capture once before scrubbing: Strict Mode must not re-read the cleaned URL.
      history.replaceState(null, '', '/auth/confirm');
      pending.current = finishAuthCallback(cloudClient(), input);
    }
    void pending.current.then(result => {
      if (cancelled) return;
      if (result.kind === 'error') { setFailed(true); setMessage(result.message); }
      else if (result.kind === 'recovery') { setRecovery(true); setMessage('Choose a password for your Rhythm account. This is separate from your Google or Supabase dashboard password.'); }
      else location.replace(authReturnPath());
    });
    return () => { cancelled = true; };
  }, []);
  return <AuthFrame><h1>{recovery ? 'Set your password.' : failed ? 'Let’s get you back in.' : 'Your space'}</h1><p className="auth-intro" role={failed ? 'alert' : 'status'}>{message}</p>{recovery ? <PasswordUpdateForm onComplete={() => { clearPasswordRecovery(); location.replace(authReturnPath()); }} /> : failed && <><p className="auth-hint">No email was sent by opening this page. Don’t share your email link or authentication codes.</p><a className="auth-text-button" href={returnPath}>Return to sign in</a></>}</AuthFrame>;
}
