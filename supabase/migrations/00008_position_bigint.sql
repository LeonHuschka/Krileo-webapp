-- Position is set to Date.now() (milliseconds since epoch) which overflows
-- integer. Bump to bigint.

alter table public.orders alter column position type bigint;
alter table public.order_todos alter column position type bigint;
