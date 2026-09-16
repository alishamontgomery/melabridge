create table if not exists public.vendor_sourcing_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  request_type text not null check (request_type in ('concierge', 'private_vendor')),
  category text not null check (char_length(category) between 1 and 100),
  vendor_name text check (vendor_name is null or char_length(vendor_name) <= 160),
  contact_email text check (contact_email is null or char_length(contact_email) <= 255),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  website text check (website is null or char_length(website) <= 500),
  location text check (location is null or char_length(location) <= 180),
  budget_range text check (budget_range is null or char_length(budget_range) <= 120),
  notes text check (notes is null or char_length(notes) <= 2000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'matched', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_vendor_requires_name
    check (request_type <> 'private_vendor' or nullif(btrim(vendor_name), '') is not null)
);

create index if not exists vendor_sourcing_requests_user_event_idx
  on public.vendor_sourcing_requests (user_id, event_id, created_at desc);

create index if not exists vendor_sourcing_requests_status_idx
  on public.vendor_sourcing_requests (status, created_at desc);

alter table public.vendor_sourcing_requests enable row level security;

drop policy if exists "Users can view their vendor sourcing requests" on public.vendor_sourcing_requests;
create policy "Users can view their vendor sourcing requests"
  on public.vendor_sourcing_requests for select
  to authenticated
  using (user_id = public.current_app_user_id());

drop policy if exists "Users can create their vendor sourcing requests" on public.vendor_sourcing_requests;
create policy "Users can create their vendor sourcing requests"
  on public.vendor_sourcing_requests for insert
  to authenticated
  with check (
    user_id = public.current_app_user_id()
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and e.owner_id = public.current_app_user_id()
        and e.deleted_at is null
    )
  );

drop policy if exists "Users can update their vendor sourcing requests" on public.vendor_sourcing_requests;
create policy "Users can update their vendor sourcing requests"
  on public.vendor_sourcing_requests for update
  to authenticated
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

drop policy if exists "Users can delete their vendor sourcing requests" on public.vendor_sourcing_requests;
create policy "Users can delete their vendor sourcing requests"
  on public.vendor_sourcing_requests for delete
  to authenticated
  using (user_id = public.current_app_user_id());

grant select, insert, update, delete on public.vendor_sourcing_requests to authenticated;
