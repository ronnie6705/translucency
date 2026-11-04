# Task-start notifications

Settings → Task notifications enables browser push on the current device. Enable
each phone/laptop separately. iPhone requires Rhythm installed on the Home Screen
(iOS 16.4+). HTTPS and notification permission are required. Signing out revokes
the browser subscription. Task names appear in system notifications/lock screens.

## Server setup

1. Apply `supabase/migrations/202611040001_task_notifications.sql` after the account
   migration. Subscription endpoints and delivery records are server-only with RLS.
2. Generate a VAPID key pair with `npx web-push generate-vapid-keys`. Store secrets
   directly in the hosting environment, never in git or browser-visible variables.
3. Set these **server-only** environment variables alongside the existing public
   Supabase URL:
   - `SUPABASE_SERVICE_ROLE_KEY`: this project's Supabase service-role key.
   - `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY`: the generated VAPID pair.
   - `WEB_PUSH_SUBJECT`: a real contact such as `mailto:owner@example.com`.
   - `RHYTHM_PUSH_CRON_SECRET`: a random secret of at least 32 bytes.
4. Deploy the app. Keep the VAPID keys stable; changing them requires devices to
   unsubscribe and subscribe again.
5. Enable Supabase Cron (`pg_cron`), `pg_net`, and Vault. Save two Vault secrets:
   `rhythm_push_dispatch_url` = `https://YOUR_PRODUCTION_HOST/api/notifications/dispatch`
   and `rhythm_push_cron_secret` = the same cron secret used on the server.
   Then run `supabase/task-notifications-cron.sql`. It invokes the dispatcher every
   30 seconds while any device is subscribed. Do not use a once-daily hosting cron.
6. Open Settings on each device and enable notifications. Start a fresh live timer
   with a task starting soon; close Rhythm and confirm one notification per device.
   Also verify skip, reschedule, stop, sign-out, and tapping the notification.

The code does not provision secrets, run production migrations, or install the cron
automatically. Until environment configuration exists, Settings explicitly reports
that server setup is needed. Verify cron runs and HTTP responses in Supabase after
setup; configured keys alone do not prove background delivery works.

## Delivery behavior

- The server reads the current synced `workspace_documents.payload.liveTimer`.
  There is no separate stale schedule queue to cancel. Offline changes must sync
  before the server can honor them; already submitted push messages cannot be recalled.
- Every dispatch uses an atomic, revision-checked claim per subscription/run/task.
  Reflows and split segments do not generate another alert for that task. A fresh
  launch does. Legacy timers use plan ID plus start time as the launch identity.
- Only tasks, not breaks, generate alerts. Completed/skipped tasks, removed timers,
  and tasks already running when a device enabled notifications are excluded.
- Alerts normally arrive within the 30-second polling interval plus network delay.
  Starts older than 90 seconds are not replayed; short tasks can be missed between
  polls. Push TTL is bounded by that window and task end; stale payloads are discarded
  by the service worker. This is best-effort notification delivery, not an exact alarm.
- Expired endpoints (404/410) are removed. Explicit provider 429/5xx rejections can
  retry in the next poll. Ambiguous timeouts retain the claim to avoid duplicates;
  a crash after claiming can lose that alert. Exactly-once delivery across a database
  and external push provider is not guaranteed.
- The dispatcher returns aggregate sent/failed counts without logging task names,
  endpoints, or keys. Alerting should monitor non-2xx responses and cron failures.
- Delivery claims are retained until the device subscription/account is deleted,
  preserving deduplication for long-running sessions. Review retention and dispatcher
  batching before expanding beyond personal use.

References: [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart),
[Vault scheduling](https://supabase.com/docs/guides/functions/schedule-functions),
[web-push](https://github.com/web-push-libs/web-push).

## Local verification

`npm test` covers schedule eligibility, API authorization and dispatch using a
synthetic transport, PostgreSQL claims/RLS, and service-worker handling.
`npm run build` checks the production routes. Start that build with
`npm run start -- --port 3017`, then run
`node tests/task-notifications-browser.mjs` for the mobile settings flow using
simulated browser push and account APIs (no actual notifications are sent).
The browser suite uses the configured public Supabase URL only as an intercepted
request target; it requires a `https://*.supabase.co` public build configuration.
Set `BROWSER_CHANNEL` or `BASE_URL` to override the default Edge/local test server.
