'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { cloudClient } from '@/lib/cloud/client';
import { accountBackup, activeAccount, hasPendingChanges, readAccount, setActiveAccount, syncAccount, useCloudVersion, writeAccount } from '@/lib/cloud/storage';
import type { Module } from '@/lib/cloud/model';
import { loadGuestData } from '@/lib/storage';
import { emptyData } from '@/lib/seed';
import { emptyLibrary, loadGuestLibrary, mergeLibraries } from '@/modules/rhythm/library';
import type { AppData } from '@/lib/types';
import { LoginScreen, PasswordUpdateForm } from '@/components/login-screen';

interface AccountContextValue { user: User | null; status: string; conflicts: Module[]; sync: () => Promise<void> }
const AccountContext = createContext<AccountContextValue>({user:null,status:'Device only',conflicts:[],sync:async () => {}});
export function AccountProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Device only');
  const [conflicts, setConflicts] = useState<Module[]>([]);
  const syncing = useRef(false);
  useEffect(() => {
    const client = cloudClient();
    if (!client) { setActiveAccount(null); setReady(true); return; }
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setActiveAccount(session?.user.id ?? null);
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  const sync = async () => {
    if (!user || syncing.current) return;
    const id = user.id;
    syncing.current = true;
    setStatus('Syncing…');
    try {
      const found = await syncAccount(id);
      if (activeAccount() !== id) return;
      setConflicts(found);
      setStatus(found.length ? 'Changes need your review' : 'Synced with your account');
    } catch (e) {
      if (activeAccount() === id) setStatus(e instanceof Error ? e.message : 'Cloud sync is unavailable.');
    } finally { syncing.current = false; }
  };
  useEffect(() => {
    setConflicts([]);
    if (!user) { setStatus('Device only'); return; }
    let stopped = false;
    const run = () => { if (!stopped) void sync(); };
    // Initialize both account documents before starting background sync.
    void Promise.all([readAccount(user.id, 'rhythm', emptyLibrary), readAccount(user.id, 'translucency', emptyData)])
      .then(run).catch(() => { if (!stopped) setStatus('Connect to the internet to open this account on this device.'); });
    const timer = setInterval(run, 30000);
    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    window.addEventListener('cloud-data', run);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('online', run); window.removeEventListener('focus', run); window.removeEventListener('cloud-data', run); };
  }, [user?.id]); // Sync only changes identity when the account changes.
  if (!ready) return <main className="platform-loading"><p role="status">Opening your space…</p></main>;
  if (!user) return <LoginScreen />;
  return <AccountContext.Provider value={{user,status,conflicts,sync}}><div key={user.id}>{children}</div></AccountContext.Provider>;
}
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function AccountControls() {
  const {user,status,conflicts,sync} = useContext(AccountContext);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  async function perform(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  if (!user) return null;
  return <details className="account-panel">
    <summary><span>{user.email}</span><span>{status}</span></summary>
    <div className="account-content">
      <h2>One account. Both spaces.</h2>
        <p>Signed in as {user.email}. Saved changes sync when connected. This browser retains an offline copy; use a trusted device. This is not end-to-end encryption.</p>
        <p role="status">{status}</p>
        <div className="account-actions">
          <button className="button" disabled={busy} onClick={() => void perform(sync)}>Sync now</button>
          <button className="button secondary" disabled={busy} onClick={() => void perform(async () => download(await accountBackup(user.id), 'rhythm-account-backup.json'))}>Export device account copy</button>
          <button className="button secondary" disabled={busy} onClick={() => void perform(async () => {
            if (await hasPendingChanges(user.id) && !confirm('Some changes have not synced. They will remain in this browser for this account. Sign out anyway?')) return;
            const {error} = await cloudClient()!.auth.signOut({scope:'local'}); if (error) throw error;
          })}>Sign out</button>
        </div>
        <details><summary>Set or change your password</summary><p>Use a password to sign in on another browser without requesting an email each time.</p><PasswordUpdateForm /></details>
        {conflicts.map(module => <section key={module} className="account-conflict"><h3>{module === 'rhythm' ? 'Rhythm' : 'Translucency'} changed on another device</h3><p>Neither version has been overwritten. Export your device copy before choosing the cloud version. You can use the backup to recover any conflicting edits.</p><button className="button secondary" disabled={busy} onClick={() => void perform(async () => {
          if (!confirm('Replace this module’s device copy with the cloud version? Export your device account copy first if you need to keep these edits.')) return;
          await useCloudVersion(user.id, module); await sync();
        })}>Use cloud version</button></section>)}
        <details><summary>Import this browser’s device-only data</summary><p>This uploads your guest reflections and planning records into this account. Matching record IDs keep the account version. Your guest copy remains untouched. Data from localhost must first be exported there.</p>
          <button className="button secondary" disabled={busy || conflicts.length > 0} onClick={() => void perform(async () => {
            if (!confirm('Upload this browser’s guest check-ins, reflections, profile and Rhythm plans to your signed-in Supabase account?')) return;
            const [guest, rhythm] = await Promise.all([loadGuestData(), loadGuestLibrary()]);
            await writeAccount<AppData>(user.id, 'translucency', current => {
              const merge = <T extends {id:string;demo?:boolean}>(a:T[], b:T[]) => [...a,...b.filter(x => !x.demo && !a.some(y => y.id === x.id))];
              return {...current,profile:current.profile.onboarded ? current.profile : guest.profile,checkIns:merge(current.checkIns,guest.checkIns),roles:merge(current.roles,guest.roles),sessions:merge(current.sessions,guest.sessions),influences:merge(current.influences,guest.influences)};
            });
            await writeAccount(user.id, 'rhythm', current => mergeLibraries(current as ReturnType<typeof emptyLibrary>, rhythm));
            window.dispatchEvent(new Event('cloud-refreshed')); await sync(); setMessage('Guest data copied into your account workspace. Check the sync status above.');
          })}>Import guest data into my account</button>
        </details>
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}
