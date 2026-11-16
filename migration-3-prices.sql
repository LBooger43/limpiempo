-- Limpiempo update 3: each business keeps its own price list
alter table businesses add column if not exists services jsonb;
