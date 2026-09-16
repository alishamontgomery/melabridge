-- Automatic vendor-demand matching.
-- Existing vendor_sourcing_requests rows remain the source of demand history;
-- this ledger only records which published vendor was already surfaced/notified.

create table if not exists public.vendor_demand_matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.vendor_sourcing_requests(id) on delete cascade,
  vendor_profile_id uuid not null references public.vendor_profiles(id) on delete cascade,
  notified_at timestamptz not null default now(),
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, vendor_profile_id)
);

create index if not exists vendor_demand_matches_request_idx
  on public.vendor_demand_matches (request_id, created_at desc);

create index if not exists vendor_demand_matches_vendor_idx
  on public.vendor_demand_matches (vendor_profile_id, created_at desc);

alter table public.vendor_demand_matches enable row level security;

create policy "Users can view their own vendor demand matches"
  on public.vendor_demand_matches for select
  to authenticated
  using (
    exists (
      select 1
      from public.vendor_sourcing_requests r
      where r.id = request_id
        and r.user_id = public.current_app_user_id()
    )
  );

grant select on public.vendor_demand_matches to authenticated;
grant all on public.vendor_demand_matches to service_role;