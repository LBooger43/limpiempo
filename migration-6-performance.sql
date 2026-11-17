-- Limpiempo update 6: hours tied to jobs (for job profit), supplies per bill, switch house
alter table time_entries add column if not exists job_id uuid references jobs on delete set null;
alter table bills add column if not exists supplies numeric(10,2) not null default 0;

drop function if exists clock_in();
create or replace function clock_in(p_job uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare b uuid; e uuid;
begin
  b := my_business();
  if b is null then raise exception 'Not on a team'; end if;
  if exists (select 1 from time_entries where user_id = auth.uid() and clock_out is null) then
    raise exception 'Already clocked in';
  end if;
  if p_job is not null and not exists (select 1 from jobs where id = p_job and business_id = b) then
    raise exception 'Job not found';
  end if;
  insert into time_entries (business_id, user_id, clock_in, job_id) values (b, auth.uid(), now(), p_job) returning id into e;
  return e;
end $$;

-- Moving to the next house: closes the current time and starts the next one (drive time counts toward the next house)
create or replace function switch_job(p_job uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare b uuid; e uuid;
begin
  b := my_business();
  if b is null then raise exception 'Not on a team'; end if;
  if p_job is not null and not exists (select 1 from jobs where id = p_job and business_id = b) then
    raise exception 'Job not found';
  end if;
  update time_entries set clock_out = now() where user_id = auth.uid() and clock_out is null and clock_in < now();
  insert into time_entries (business_id, user_id, clock_in, job_id) values (b, auth.uid(), now(), p_job) returning id into e;
  return e;
end $$;

revoke all on function clock_in(uuid) from public;
revoke all on function switch_job(uuid) from public;
grant execute on function clock_in(uuid) to authenticated;
grant execute on function switch_job(uuid) to authenticated;
