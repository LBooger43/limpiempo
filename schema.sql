-- =========================================================
-- LIMPIEMPO — Version 1 database
-- Paste this whole file into Supabase › SQL Editor › New query › Run
-- =========================================================
create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  pay_instructions text default '',
  pay_venmo text default '', pay_cashapp text default '', pay_paypal text default '',
  pay_zelle text default '', pay_applecash text default '',
  services jsonb,
  phone text default '',
  created_at timestamptz default now()
);

create table if not exists members (
  user_id uuid primary key references auth.users on delete cascade,
  business_id uuid not null references businesses on delete cascade,
  name text not null,
  role text not null check (role in ('owner','crew')),
  color text not null default '#0E7C7B',
  phone text default '',
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  name text not null,
  phone text default '',
  address text default '',
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  client_id uuid references clients on delete set null,
  job_date date not null,
  start_time time,
  hours numeric(4,1) default 3,
  crew uuid[] not null default '{}',
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  client_id uuid references clients on delete set null,
  job_id uuid references jobs on delete set null,
  token uuid not null unique default gen_random_uuid(),
  items jsonb not null default '[]',          -- [{"label":"Standard clean","amount":140}]
  subtotal numeric(10,2) not null default 0,
  allow_tip boolean not null default true,
  tip numeric(10,2) not null default 0,
  note text default '',
  status text not null default 'sent' check (status in ('sent','opened','reported','paid','void')),
  method text,                                 -- cash, zelle, venmo, check, card, other
  reported_method text,                        -- what the client said they used
  sent_at timestamptz default now(),
  opened_at timestamptz,
  reported_at timestamptz,
  paid_at timestamptz,
  reminders jsonb not null default '[]',      -- list of timestamps
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

create index if not exists jobs_biz_date on jobs (business_id, job_date);
create index if not exists bills_biz on bills (business_id, sent_at desc);
create index if not exists clients_biz on clients (business_id, name);

-- ---------- Helpers ----------
create or replace function my_business() returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from members where user_id = auth.uid() and active
$$;

create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from members where user_id = auth.uid() and active
$$;

-- ---------- Row level security ----------
alter table businesses enable row level security;
alter table members    enable row level security;
alter table clients    enable row level security;
alter table jobs       enable row level security;
alter table bills      enable row level security;

drop policy if exists biz_read on businesses;
create policy biz_read on businesses for select using (id = my_business());
drop policy if exists biz_owner_update on businesses;
create policy biz_owner_update on businesses for update
  using (id = my_business() and my_role() = 'owner') with check (id = my_business());

drop policy if exists mem_read on members;
create policy mem_read on members for select using (business_id = my_business());
drop policy if exists mem_owner_update on members;
create policy mem_owner_update on members for update
  using (business_id = my_business() and (my_role() = 'owner' or user_id = auth.uid()))
  with check (business_id = my_business());

-- Clients: whole team can see (crew needs addresses); only owner changes them
drop policy if exists cli_read on clients;
create policy cli_read on clients for select using (business_id = my_business());
drop policy if exists cli_owner_write on clients;
create policy cli_owner_write on clients for all
  using (business_id = my_business() and my_role() = 'owner')
  with check (business_id = my_business() and my_role() = 'owner');

-- Jobs: whole team can see the schedule; only owner changes it
drop policy if exists job_read on jobs;
create policy job_read on jobs for select using (business_id = my_business());
drop policy if exists job_owner_write on jobs;
create policy job_owner_write on jobs for all
  using (business_id = my_business() and my_role() = 'owner')
  with check (business_id = my_business() and my_role() = 'owner');

-- Bills: owner only (crew never sees money)
drop policy if exists bill_owner_all on bills;
create policy bill_owner_all on bills for all
  using (business_id = my_business() and my_role() = 'owner')
  with check (business_id = my_business() and my_role() = 'owner');

-- Stop people from editing their own role/business
create or replace function members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'owner' then
    new.role := old.role;
    new.active := old.active;
  end if;
  new.business_id := old.business_id;
  if old.role = 'owner' then new.role := 'owner'; new.active := true; end if;
  return new;
end $$;
drop trigger if exists members_guard on members;
create trigger members_guard before update on members for each row execute function members_guard();

-- ---------- Sign-up functions ----------
create or replace function create_business(p_business text, p_name text, p_phone text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Already in a business'; end if;
  insert into businesses (name, phone) values (trim(p_business), coalesce(p_phone,'')) returning id into b;
  insert into members (user_id, business_id, name, role, color, phone)
    values (auth.uid(), b, trim(p_name), 'owner', '#D6245E', coalesce(p_phone,''));
  return b;
end $$;

create or replace function join_business(p_code text, p_name text, p_phone text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare b uuid; n int; palette text[] := array['#0E7C7B','#7C4DDB','#C85A12','#1F6FB2','#B3164B','#3D7A1F','#8A5A00'];
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Already in a business'; end if;
  select id into b from businesses where join_code = upper(trim(p_code));
  if b is null then raise exception 'Code not found'; end if;
  select count(*) into n from members where business_id = b;
  insert into members (user_id, business_id, name, role, color, phone)
    values (auth.uid(), b, trim(p_name), 'crew', palette[(n % array_length(palette,1)) + 1], coalesce(p_phone,''));
  return b;
end $$;

-- ---------- Public bill page (homeowner, no login) ----------
create or replace function get_bill(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare r json;
begin
  update bills set status = 'opened', opened_at = now()
    where token = p_token and status = 'sent';
  select json_build_object(
    'business', b.name, 'business_phone', b.phone, 'pay_instructions', b.pay_instructions,
    'pay_venmo', b.pay_venmo, 'pay_cashapp', b.pay_cashapp, 'pay_paypal', b.pay_paypal,
    'pay_zelle', b.pay_zelle, 'pay_applecash', b.pay_applecash,
    'client', c.name, 'items', x.items, 'subtotal', x.subtotal, 'allow_tip', x.allow_tip,
    'tip', x.tip, 'note', x.note, 'status', x.status, 'method', x.method,
    'reported_method', x.reported_method, 'sent_at', x.sent_at, 'paid_at', x.paid_at)
  into r
  from bills x join businesses b on b.id = x.business_id left join clients c on c.id = x.client_id
  where x.token = p_token and x.status <> 'void';
  return r;
end $$;

create or replace function report_paid(p_token uuid, p_method text, p_tip numeric default 0)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update bills set status = 'reported', reported_at = now(),
    reported_method = left(coalesce(p_method,'other'), 20),
    tip = case when allow_tip then greatest(0, least(coalesce(p_tip,0), subtotal)) else 0 end
  where token = p_token and status in ('sent','opened');
  return found;
end $$;

revoke all on function get_bill(uuid) from public;
revoke all on function report_paid(uuid, text, numeric) from public;
grant execute on function get_bill(uuid) to anon, authenticated;
grant execute on function report_paid(uuid, text, numeric) to anon, authenticated;
grant execute on function create_business(text, text, text) to authenticated;
grant execute on function join_business(text, text, text) to authenticated;
