'use client';
import { useId, useState, type ReactNode } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Waves } from 'lucide-react';
import { cloudClient } from '@/lib/cloud/client';
import { authErrorMessage, rememberReturnPage } from '@/lib/cloud/auth-ui';

type Mode = 'signin' | 'signup' | 'reset' | 'link';
export function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="auth-screen">
    <div className="auth-brand"><Waves size={27} aria-hidden="true" /><span>rhythm<span className="auth-brand-caption">WITH TRANSLUCENCY</span></span></div>
    <section className="auth-card" aria-label="Your account">{children}</section>
    <p className="auth-footer">A little structure. A little space. All yours.</p>
  </main>;
}
export function PasswordField({ label = 'Password', value, onChange, newPassword = false, disabled = false }: {
  label?: string; value: string; onChange: (value: string) => void; newPassword?: boolean; disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return <div className="auth-field"><label htmlFor={id}>{label}</label><span className="auth-password">
    <input id={id} type={visible ? 'text' : 'password'} autoComplete={newPassword ? 'new-password' : 'current-password'} required minLength={newPassword ? 8 : undefined} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} />
    <button type="button" className="auth-reveal" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)} disabled={disabled}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
  </span></div>;
}
export function PasswordUpdateForm({ onComplete }: { onComplete?: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  return <form className="auth-form" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const client = cloudClient();
      if (!client) throw new Error('Account connection is unavailable.');
      const result = await client.auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword(''); setConfirmation('');
      setMessage('Password saved. You can now sign in without requesting an email.');
      onComplete?.();
    } catch (e) { setError(authErrorMessage(e as Error)); }
    finally { setBusy(false); }
  }}>
    <PasswordField label="New password" value={password} onChange={setPassword} newPassword disabled={busy} />
    <PasswordField label="Confirm password" value={confirmation} onChange={setConfirmation} newPassword disabled={busy} />
    <p className="auth-hint">Use at least 8 characters. A unique, longer password is best.</p>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {message && <p className="auth-message" role="status">{message}</p>}
    <button className="button auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
  </form>;
}
export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const configured = !!cloudClient();
  function switchMode(next: Mode) { setMode(next); setPassword(''); setError(''); setMessage(''); setConsent(false); }
  const title = { signin: 'Welcome to your space.', signup: 'Make space for yourself.', reset: 'A fresh start.', link: 'A link to your space.' }[mode];
  const label = { signin: 'Sign in', signup: 'Create account', reset: 'Send password reset link', link: 'Send sign-in link' }[mode];
  return <AuthFrame>
    <p className="auth-eyebrow">ONE ACCOUNT. BOTH SPACES.</p>
    <h1>{title}</h1>
    <p className="auth-intro">{mode === 'signin' ? 'Your plans, reflections, and a little room to breathe. Sign in to pick up where you left off.' : mode === 'signup' ? 'Bring your Rhythm plans and Translucency reflections together.' : mode === 'reset' ? 'Forgot your password, or only used email links before? We’ll send a link to set a password. Open it in this browser.' : 'We’ll email a sign-in link. Open it in this browser to continue.'}</p>
    {!configured ? <p className="auth-error" role="alert">Accounts are not configured for this deployment. Your stored data has not been changed. Please contact the app owner.</p> : <>
      <form className="auth-form" onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError(''); setMessage('');
        try {
          const client = cloudClient()!;
          rememberReturnPage();
          const redirectTo = `${location.origin}/auth/confirm`;
          if (mode === 'signin') {
            const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
            if (error) throw error;
          } else if (mode === 'signup') {
            const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } });
            if (error) throw error;
            setPassword('');
            if (!data.session) setMessage('Check your inbox to confirm your email. Open the link in this browser. If you already have an account, sign in or reset your password.');
          } else if (mode === 'reset') {
            const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
            if (error) throw error;
            setMessage('If an account exists for this email, a password reset link has been requested. Check your inbox and open it in this browser.');
          } else {
            const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
            if (error) throw error;
            setMessage('Check your inbox for a sign-in link. Open it in this browser to finish signing in.');
          }
        } catch (e) { setError(authErrorMessage(e as Error)); }
        finally { setBusy(false); }
      }}>
        <label className="auth-field">Email<input type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
        {(mode === 'signin' || mode === 'signup') && <PasswordField value={password} onChange={setPassword} newPassword={mode === 'signup'} disabled={busy} />}
        {mode === 'signup' && <><p className="auth-hint">Use at least 8 characters.</p><label className="account-consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} />I understand account records are stored in the cloud and cached on this browser for offline use.</label></>}
        {mode === 'signin' && <button className="auth-text-button auth-forgot" type="button" disabled={busy} onClick={() => switchMode('reset')}>Forgot or need a password?</button>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <button className="button auth-submit" disabled={busy || (mode === 'signup' && !consent)}>{busy ? 'Please wait…' : label}<ArrowRight size={17} aria-hidden="true" /></button>
      </form>
      <div className="auth-switch">{mode === 'signin' ? <><span>New here?</span><button className="auth-text-button" disabled={busy} onClick={() => switchMode('signup')}>Create an account</button></> : <button className="auth-text-button" disabled={busy} onClick={() => switchMode('signin')}>Back to sign in</button>}</div>
      {mode === 'signin' && <button className="auth-text-button auth-link-option" disabled={busy} onClick={() => switchMode('link')}>Use an email link instead</button>}
    </>}
    <div className="auth-privacy"><LockKeyhole size={15} aria-hidden="true" /><p>Your account records sync across devices. Use a trusted browser: it keeps an offline copy. Existing device-only records aren’t uploaded unless you choose to import them.</p></div>
  </AuthFrame>;
}
