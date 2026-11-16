-- Limpiempo update 2: one-tap payment links (Venmo, Cash App, PayPal, Zelle, Apple Cash)
alter table businesses add column if not exists pay_venmo text default '';
alter table businesses add column if not exists pay_cashapp text default '';
alter table businesses add column if not exists pay_paypal text default '';
alter table businesses add column if not exists pay_zelle text default '';
alter table businesses add column if not exists pay_applecash text default '';

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
revoke all on function get_bill(uuid) from public;
grant execute on function get_bill(uuid) to anon, authenticated;
