alter table public.growth_tasks
  add column if not exists subtasks jsonb not null default '[]'::jsonb;
