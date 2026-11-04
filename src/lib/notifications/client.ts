import { cloudClient } from '@/lib/cloud/client';

export const notificationOwnerKey = 'rhythm:notification-owner';

export async function saveSubscription(subscription: PushSubscription, method: 'POST' | 'DELETE') {
  const session = await cloudClient()?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('Sign in to manage notifications.');
  const response = await fetch('/api/notifications', {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Could not save notification settings. Please retry.');
  }
}

export async function disableTaskNotifications() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    // Revoke the device capability even if the server is unavailable at sign-out.
    if (!await subscription.unsubscribe()) throw new Error('Could not disable device notifications. Please retry.');
    await saveSubscription(subscription, 'DELETE').catch(() => {});
  }
  localStorage.removeItem(notificationOwnerKey);
}
