-- Private, per-user snapshots. Writes are revision-checked in one transaction.
create table public.workspace_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null check (module in ('translucency', 'rhythm')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 10485760),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, module)
);
alter table public.workspace_documents enable row level security;
revoke all on public.workspace_documents from anon, authenticated;
grant select on public.workspace_documents to authenticated;
create policy own_documents on public.workspace_documents for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.save_workspace_document(bound_user_id uuid, document_module text, document_payload jsonb, expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := auth.uid();
  next_revision bigint;
begin
  if account_id is null or bound_user_id is distinct from account_id then raise exception 'Sign in required' using errcode = '42501'; end if;
  if document_module not in ('rhythm', 'translucency') or expected_revision < 0 or expected_revision is null then
    raise exception 'Invalid document';
  end if;
  if expected_revision = 0 then
    insert into public.workspace_documents(user_id, module, payload)
      values (account_id, document_module, document_payload)
      on conflict do nothing returning revision into next_revision;
  else
    update public.workspace_documents set payload = document_payload, revision = revision + 1, updated_at = now()
      where user_id = account_id and module = document_module and revision = expected_revision
      returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'Sync conflict' using errcode = '40001'; end if;
  return next_revision;
end;
$$;
revoke all on function public.save_workspace_document(uuid, text, jsonb, bigint) from public, anon;
grant execute on function public.save_workspace_document(uuid, text, jsonb, bigint) to authenticated;
