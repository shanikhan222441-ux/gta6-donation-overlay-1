-- Run this entire file in Supabase SQL Editor.
-- Then enable Realtime for donation_settings and donations.

create table if not exists public.donation_settings (
  id integer primary key check (id = 1),
  title text not null default 'DONATION GOAL',
  currency text not null default 'Rs.',
  target_amount numeric not null default 100000,
  total_amount numeric not null default 0,
  current_name text,
  current_amount numeric not null default 0,
  last_donation_id uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key,
  donor_name text not null default 'Anonymous',
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

insert into public.donation_settings (id) values (1)
on conflict (id) do nothing;

alter table public.donation_settings enable row level security;
alter table public.donations enable row level security;

drop policy if exists "public read settings" on public.donation_settings;
create policy "public read settings" on public.donation_settings for select to anon using (true);

-- Authenticated users can run admin controls. Create only your admin account in Supabase Auth.
drop policy if exists "authenticated update settings" on public.donation_settings;
create policy "authenticated update settings" on public.donation_settings for update to authenticated using (true) with check (true);

drop policy if exists "public read donations" on public.donations;
create policy "public read donations" on public.donations for select to anon using (true);

drop policy if exists "authenticated insert donations" on public.donations;
create policy "authenticated insert donations" on public.donations for insert to authenticated with check (true);

-- Optional: keep timestamp fresh on every settings update.
create or replace function public.touch_donation_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists donation_settings_touch on public.donation_settings;
create trigger donation_settings_touch
before update on public.donation_settings
for each row execute function public.touch_donation_settings();

-- Realtime: add both tables to supabase_realtime publication.
alter publication supabase_realtime add table public.donation_settings;
alter publication supabase_realtime add table public.donations;
