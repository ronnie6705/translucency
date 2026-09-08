# Supabase + Vercel

## Provisioned resources

- App: https://rhythm-platform-seven.vercel.app
- Vercel project: `rhythm-platform` (`prj_AIn8Antt94cZIncqLivx4EQgezlB`) under `ronnies-2731s-projects`, Hobby.
- Supabase project: `ccpamilpcgipiwknlvrx`, `rhythm-platform`, Rhythm organization, Free, Sydney (`ap-southeast-2`).
- Private schema applied through the SQL Editor on 2026-09-08. Guest records were not uploaded.
- Production-only public configuration is saved in Vercel; local public configuration is in gitignored `.env.local`. Preview environments are intentionally unconfigured.
- Deployment uses source upload through the connected Vercel integration. No Git repository is connected to Vercel yet; local changes do not automatically deploy.
- Automated tests cover synthetic sign-in and two-device sync; real email delivery and an authenticated round trip must also be verified by signing in. Anonymous requests to the live table were verified denied (HTTP 401, PostgreSQL 42501).

## Provision Supabase

1. Create a **Free** Supabase project in an Australian region if available. Keep the database password in your password manager; it is not needed in the app.
2. Run `supabase/migrations/202609080001_account_sync.sql` in the project's SQL Editor, or apply it using the Supabase CLI. It creates one private table and a revision-checked write function. No guest data is seeded or uploaded.
3. Keep the default **Magic link or OTP** email template. The app uses PKCE email links, so no custom SMTP/template is needed for personal team-member testing. Open each link in the browser where it was requested; the one-time verifier stays there.
4. Keep email authentication enabled. Configure Site URL as `https://rhythm-platform-seven.vercel.app`. Allow exactly `https://rhythm-platform-seven.vercel.app/auth/confirm`, `http://127.0.0.1:3000/auth/confirm`, and `http://localhost:3000/auth/confirm` as redirects. Do not allow wildcard preview origins. For a private personal release, provision your own account and then disable new signups if desired.
5. Supabase's default email service restricts delivery to organization team-member addresses and is rate-limited. Verify your own address is allowed, or configure custom SMTP before opening sign-up to other people. Free projects currently need custom SMTP to customize email templates. Do not claim public email login works until a real link has been received and verified.
6. Copy the **Project URL** and **publishable key** (or legacy `anon` key). Never use a secret or `service_role` key in the frontend.

## Configure and deploy

Use the `platform` directory as the Vercel project root, Next.js as the framework, Node 22, `npm ci` for install and `npm run build` for build. Use the existing free Hobby account only for personal, non-commercial use.

Set these public build-time environment variables in Vercel **Production**, and in a gitignored `.env.local` for local testing:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Use a separate Supabase project for previews, or leave previews unconfigured (they show an account-configuration notice, not the workspace). Do not point arbitrary preview builds at personal production data. Rebuild after changing these variables. No privileged Supabase key is required on Vercel.

Deploy first as a preview and verify navigation, headers, mobile layout and the offline shell. With the database configured, verify real email login, a saved record appearing in a second browser, sign-out isolation and deletion syncing before calling cloud setup complete. No analytics or third-party tracking scripts are included.

## Storage and safety

- The app now requires sign-in before mounting either workspace, including hash deep links. Existing sessions restore automatically. Ordinary email/password sign-in sends no email; sign-up confirmation, optional magic links and password recovery still require email delivery. Keep email confirmation enabled.
- Existing email-link users can set a password from the account panel while signed in, or use “Forgot or need a password?” on the login screen. Recovery uses the existing approved `/auth/confirm` PKCE callback and the SDK's `PASSWORD_RECOVERY` event. Validated internal destinations preserve the original app page after email callbacks.
- Callback errors in either query parameters or URL fragments are now classified before URL scrubbing. Expired/used links, missing browser verifiers, missing codes, configuration failures and connection errors have distinct guidance; provider descriptions and tokens are never displayed. A captured PKCE flow ID is passed explicitly to the SDK. Implicit token links remain rejected, not used to bypass PKCE. Recovery refreshes resume only with an existing session and a per-tab, user-bound UI hint; this hint does not authorize access. Callback handling never sends another email automatically.
- Supabase's built-in sender permits only two authentication emails per hour project-wide. Set up custom SMTP before relying on public sign-up or frequent recovery. Password login does not remove those email limits.

- Guest data retains the original IndexedDB databases and migrations. Signing in never automatically uploads it.
- Account caches use `rhythm-account-cache-v1`, keys `{user UUID}:{module}`, and remount the UI when identity changes. Signing out hides those copies but retains them for offline recovery; clearing browser site data removes them. This is not encryption against someone with access to your browser profile.
- Supabase reads use row-level security. Client roles have no direct write grants. The write function checks the current authenticated UUID against the explicit account binding, validates the module and document size, and atomically increments a revision only if the previous revision matches. There is no client-supplied owner override.
- Snapshots sync on save, reconnect, focus and every 30 seconds. A conflict keeps both copies intact and offers an export before accepting the cloud version. Edits are not silently merged or overwritten. Deletions are represented by empty/updated snapshots, so a stale offline device conflicts instead of resurrecting deleted records.
- Settings deletions affect the active workspace and sync when signed in. They do not delete the Supabase login. Permanent account removal can be performed by the owner in Supabase Auth; its data cascades out of the database. Other devices may still retain offline copies.
- Free Supabase projects can pause for low activity. Export backups; the free plan does not include automatic backups. This app is not end-to-end encrypted and does not claim healthcare regulatory compliance.
- Localhost and the deployed URL are different browser origins. To migrate existing personal records, configure Supabase locally, sign in there, and explicitly import guest data into the account. Alternatively, use backup files. Do not assume a deployment carries browser data with it.

## Tests

`npm test` includes PostgreSQL-level permission and revision tests using an isolated in-memory PGlite database with simulated Supabase Auth claims. This verifies the migration SQL but does not replace live Supabase verification.

For account UI tests, start a dedicated local test server:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-test-publishable-key npm run dev -- --port 3002
npm run test:accounts
```

The browser suite intercepts this synthetic endpoint. It sends no emails and creates no external accounts. Never use those test values for a deployment.
