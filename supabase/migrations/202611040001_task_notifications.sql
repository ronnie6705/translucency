-- Push subscriptions are device capabilities. Only the authenticated server API
-- may register them; the dispatcher alone can read and claim deliveries.
create table public.rhythm_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  enabled_at timestamptz not null default now()
);
create index rhythm_push_user on public.rhythm_push_subscriptions(user_id);
create table public.rhythm_push_deliveries (
  subscription_id uuid not null references public.rhythm_push_subscriptions(id) on delete cascade,
  event_key text not null,
  claimed_at timestamptz not null default now(),
  primary key(subscription_id, event_key)
);
alter table public.rhythm_push_subscriptions enable row level security;
alter table public.rhythm_push_deliveries enable row level security;
revoke all on public.rhythm_push_subscriptions, public.rhythm_push_deliveries from anon, authenticated;
grant all on public.rhythm_push_subscriptions, public.rhythm_push_deliveries to service_role;

-- Revision check prevents a dispatcher using a snapshot replaced by a skip,
-- stop, deletion, or reschedule while it was preparing the notification.
create function public.claim_rhythm_push(device_id uuid, owner_id uuid, document_revision bigint, notification_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed integer;
begin
  perform 1 from public.workspace_documents
    where user_id = owner_id and module = 'rhythm' and revision = document_revision for share;
  if not found then return false; end if;
  perform 1 from public.rhythm_push_subscriptions where id = device_id and user_id = owner_id for share;
  if not found then return false; end if;
  insert into public.rhythm_push_deliveries(subscription_id, event_key)
    values(device_id, notification_key) on conflict do nothing;
  get diagnostics claimed = row_count;
  return claimed = 1;
end;
$$;
revoke all on function public.claim_rhythm_push(uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.claim_rhythm_push(uuid, uuid, bigint, text) to service_role;
