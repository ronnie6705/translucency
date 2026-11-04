'use client';
import { useEffect, useState } from 'react';
import { activeAccount } from '@/lib/cloud/storage';
import { disableTaskNotifications, notificationOwnerKey, saveSubscription } from '@/lib/notifications/client';

export function TaskNotificationSettings() {
  const [key, setKey] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Checking notification support…');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
          throw new Error('This browser does not support task notifications. On iPhone, add Rhythm to your Home Screen, then open it there.');
        }
        const response = await fetch('/api/notifications');
        if (!response.ok) throw new Error('Could not check notification setup. Please reload and try again.');
        const config = await response.json();
        if (!config.configured) throw new Error('Task notifications need server setup before they can be enabled.');
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        const own = localStorage.getItem(notificationOwnerKey) === activeAccount();
        if (subscription && own && Notification.permission === 'granted') await saveSubscription(subscription, 'POST');
        if (!cancelled) {
          setKey(config.publicKey);
          setEnabled(Boolean(subscription && own && Notification.permission === 'granted'));
          setMessage(Notification.permission === 'denied' ? 'Notifications are blocked. Allow them in your browser or device settings, then reload Rhythm.' : '');
        }
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not check notifications.'); }
      finally { if (!cancelled) setBusy(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function toggle() {
    setBusy(true); setMessage('');
    try {
      if (enabled) {
        await disableTaskNotifications(); setEnabled(false); setMessage('Task notifications are off on this device.');
      } else {
        // Permission must be requested directly from this click, especially on iOS.
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Notifications were not allowed. You can change this in browser settings.');
        await navigator.serviceWorker.register('/sw.js');
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const bytes = Uint8Array.from(atob(key!.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
          subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
        }
        await saveSubscription(subscription, 'POST');
        localStorage.setItem(notificationOwnerKey, activeAccount()!);
        setEnabled(true); setMessage('Enabled. You’ll receive an alert when each new task starts.');
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update notifications.'); }
    finally { setBusy(false); }
  }

  return <section className="form-section">
    <h2>Task notifications</h2>
    <p>Get one alert per task on this device while a live timer is running, even when Rhythm is closed. Enable this separately on your phone and laptop.</p>
    <p>Notifications follow your synced schedule. Connect to the internet after changing or stopping a timer. Device settings may delay or silence alerts.</p>
    <p>On iPhone, add Rhythm to your Home Screen and enable notifications from there.</p>
    <button className="button secondary" disabled={busy || !key} onClick={() => void toggle()}>{busy ? 'Checking…' : enabled ? 'Disable task notifications on this device' : 'Enable task notifications on this device'}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
