-- Run separately after enabling pg_cron, pg_net and Vault and creating the two
-- Vault secrets documented in docs/task-notifications.md. Re-running replaces
-- the job with the same name. No credentials are embedded in this file.
select cron.schedule('rhythm-task-notifications', '30 seconds', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'rhythm_push_dispatch_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rhythm_push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) where exists (select 1 from public.rhythm_push_subscriptions);
$job$);
