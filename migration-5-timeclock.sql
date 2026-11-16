-- Limpiempo update 5: time clock and pay rates
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  note text default '',
  edited boolean not null default false,
  created_at timestamptz default now(),
  constraint out_after_in check (clock_out is null or clock_out > clock_in)
);
create index if not exists te_biz_in on time_entries (business_id, clock_in);
create index if not exists te_user_open on time_entries (user_id) where clock_out is null;

create table if not exists member_pay (
  user_id uuid primary key references auth.users on delete cascade,
  business_id uuid not null references businesses on delete cascade,
  hourly_rate numeric(10,2) not null default 0
);

alter table time_entries enable row level security;
alter table member_pay enable row level security;

-- Crew see only their own hours; owner sees and fixes everyone's
drop policy if exists te_read on time_entries;
create policy te_read on time_entries for select
  using (business_id = my_business() and (my_role() = 'owner' or user_id = auth.uid()));
drop policy if exists te_owner_write on time_entries;
create policy te_owner_write on time_entries for all
  using (business_id = my_business() and my_role() = 'owner')
  with check (business_id = my_business() and my_role() = 'owner'
              and user_id in (select m.user_id from members m where m.business_id = my_business()));

-- Pay rates: owner only
drop policy if exists mp_owner on member_pay;
create policy mp_owner on member_pay for all
  using (business_id = my_business() and my_role() = 'owner')
  with check (business_id = my_business() and my_role() = 'owner'
              and user_id in (select m.user_id from members m where m.business_id = my_business()));

-- Clock in / out always use the real time, so nobody can type in a different time
create or replace function clock_in() returns uuid
language plpgsql security definer set search_path = public as $$
declare b uuid; e uuid;
begin
  b := my_business();
  if b is null then raise exception 'Not on a team'; end if;
  if exists (select 1 from time_entries where user_id = auth.uid() and clock_out is null) then
    raise exception 'Already clocked in';
  end if;
  insert into time_entries (business_id, user_id, clock_in) values (b, auth.uid(), now()) returning id into e;
  return e;
end $$;

create or replace function clock_out() returns uuid
language plpgsql security definer set search_path = public as $$
declare e uuid;
begin
  update time_entries set clock_out = now()
   where user_id = auth.uid() and clock_out is null and clock_in < now()
   returning id into e;
  if e is null then raise exception 'Not clocked in'; end if;
  return e;
end $$;

revoke all on function clock_in() from public;
revoke all on function clock_out() from public;
grant execute on function clock_in() to authenticated;
grant execute on function clock_out() to authenticated;
