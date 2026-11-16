-- Limpiempo update 4: price by square feet
alter table businesses add column if not exists sqft_price numeric(10,2);
alter table businesses add column if not exists sqft_base int;
alter table businesses add column if not exists min_price numeric(10,2);
alter table clients add column if not exists sqft int;
