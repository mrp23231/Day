-- Day: user-owned records. Apply with `supabase db push`.
begin;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 60),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}', revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table public.tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check(length(id) between 1 and 100), due_date date not null,
  title text not null check(length(title) between 1 and 180),
  data jsonb not null check(jsonb_typeof(data)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(user_id,id)
);
create table public.task_recurrence_rules (
  user_id uuid not null, task_id text not null,
  rule text not null check(rule in ('none','daily','weekdays','weekly')),
  primary key(user_id,task_id), foreign key(user_id,task_id) references public.tasks(user_id,id) on delete cascade
);
create table public.nutrition_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calories integer not null check(calories between 800 and 6000),
  protein integer not null check(protein between 0 and 500),
  fat integer not null check(fat between 0 and 300),
  carbs integer not null check(carbs between 0 and 1000),
  updated_at timestamptz not null default now()
);
create table public.food_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check(length(id) between 1 and 100), entry_date date not null,
  name text not null check(length(name) between 1 and 180),
  meal text not null check(meal in ('breakfast','lunch','dinner','snack')),
  calories numeric not null check(calories between 0 and 50000),
  data jsonb not null check(jsonb_typeof(data)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(user_id,id)
);
create table public.food_ingredients (
  user_id uuid not null, id uuid not null default gen_random_uuid(), food_entry_id text not null,
  name text not null, grams numeric not null check(grams>0),
  source text, primary key(user_id,id),
  foreign key(user_id,food_entry_id) references public.food_entries(user_id,id) on delete cascade
);
create table public.water_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check(length(id) between 1 and 100), entry_date date not null,
  amount integer not null check(amount between 1 and 3000),
  data jsonb not null check(jsonb_typeof(data)='object'),
  created_at timestamptz not null default now(), primary key(user_id,id)
);
create table public.habits (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check(length(id) between 1 and 100), name text not null check(length(name) between 1 and 120),
  data jsonb not null check(jsonb_typeof(data)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(user_id,id)
);
create table public.habit_completions (
  user_id uuid not null, habit_id text not null, completion_date date not null,
  created_at timestamptz not null default now(), primary key(user_id,habit_id,completion_date),
  foreign key(user_id,habit_id) references public.habits(user_id,id) on delete cascade
);
create table public.ai_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(), request_count integer not null default 0
);
create index tasks_user_date on public.tasks(user_id,due_date);
create index food_user_date on public.food_entries(user_id,entry_date);
create index water_user_date on public.water_entries(user_id,entry_date);
create index habit_completion_date on public.habit_completions(user_id,completion_date);

do $$ declare tab text; begin
  foreach tab in array array['profiles','user_preferences','tasks','task_recurrence_rules','nutrition_goals','food_entries','food_ingredients','water_entries','habits','habit_completions'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',tab);
    execute format('grant select,insert,update,delete on public.%I to authenticated',tab);
  end loop;
end $$;
alter table public.ai_rate_limits enable row level security;
revoke all on public.ai_rate_limits from anon, authenticated;

create function public.load_day_state() returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid := auth.uid(); prefs public.user_preferences%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into prefs from public.user_preferences where user_id=uid;
  if not found then return null; end if;
  return jsonb_build_object('revision',prefs.revision,'data',jsonb_build_object(
    'version',1,'preferences',prefs.data,
    'tasks',coalesce((select jsonb_agg(data order by due_date,id) from public.tasks where user_id=uid),'[]'::jsonb),
    'foods',coalesce((select jsonb_agg(data order by entry_date,id) from public.food_entries where user_id=uid),'[]'::jsonb),
    'water',coalesce((select jsonb_agg(data order by entry_date,id) from public.water_entries where user_id=uid),'[]'::jsonb),
    'habits',coalesce((select jsonb_agg(data order by id) from public.habits where user_id=uid),'[]'::jsonb)
  ));
end $$;

create function public.save_day_state(payload jsonb,expected_revision bigint) returns bigint language plpgsql security invoker set search_path='' as $$
declare uid uuid := auth.uid(); current_revision bigint; item jsonb; day_value jsonb; p jsonb := payload->'preferences';
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if octet_length(payload::text)>5000000 or payload->>'version'<>'1' or
     jsonb_typeof(payload->'tasks')<>'array' or jsonb_typeof(payload->'foods')<>'array' or
     jsonb_typeof(payload->'water')<>'array' or jsonb_typeof(payload->'habits')<>'array' or jsonb_typeof(p)<>'object'
     then raise exception 'Invalid payload'; end if;
  insert into public.user_preferences(user_id,data,revision) values(uid,p,0) on conflict(user_id) do nothing;
  select revision into current_revision from public.user_preferences where user_id=uid for update;
  if current_revision<>expected_revision then raise exception 'Cloud revision conflict. Reload and merge before saving.'; end if;
  insert into public.profiles(user_id,display_name) values(uid,coalesce(p->>'name','')) on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now();
  insert into public.nutrition_goals(user_id,calories,protein,fat,carbs) values(uid,(p->>'calorieGoal')::int,(p->>'proteinGoal')::int,(p->>'fatGoal')::int,(p->>'carbsGoal')::int) on conflict(user_id) do update set calories=excluded.calories,protein=excluded.protein,fat=excluded.fat,carbs=excluded.carbs,updated_at=now();
  delete from public.tasks where user_id=uid and id not in(select value->>'id' from jsonb_array_elements(payload->'tasks'));
  for item in select value from jsonb_array_elements(payload->'tasks') loop
    insert into public.tasks(user_id,id,due_date,title,data) values(uid,item->>'id',(item->>'date')::date,item->>'title',item) on conflict(user_id,id) do update set due_date=excluded.due_date,title=excluded.title,data=excluded.data,updated_at=now();
    insert into public.task_recurrence_rules(user_id,task_id,rule) values(uid,item->>'id',item->>'repeat') on conflict(user_id,task_id) do update set rule=excluded.rule;
  end loop;
  delete from public.food_entries where user_id=uid and id not in(select value->>'id' from jsonb_array_elements(payload->'foods'));
  for item in select value from jsonb_array_elements(payload->'foods') loop
    insert into public.food_entries(user_id,id,entry_date,name,meal,calories,data) values(uid,item->>'id',(item->>'date')::date,item->>'name',item->>'meal',(item->>'calories')::numeric,item) on conflict(user_id,id) do update set entry_date=excluded.entry_date,name=excluded.name,meal=excluded.meal,calories=excluded.calories,data=excluded.data,updated_at=now();
  end loop;
  delete from public.water_entries where user_id=uid and id not in(select value->>'id' from jsonb_array_elements(payload->'water'));
  for item in select value from jsonb_array_elements(payload->'water') loop
    insert into public.water_entries(user_id,id,entry_date,amount,data) values(uid,item->>'id',(item->>'date')::date,(item->>'amount')::int,item) on conflict(user_id,id) do update set entry_date=excluded.entry_date,amount=excluded.amount,data=excluded.data;
  end loop;
  delete from public.habits where user_id=uid and id not in(select value->>'id' from jsonb_array_elements(payload->'habits'));
  for item in select value from jsonb_array_elements(payload->'habits') loop
    insert into public.habits(user_id,id,name,data) values(uid,item->>'id',item->>'name',item) on conflict(user_id,id) do update set name=excluded.name,data=excluded.data,updated_at=now();
    delete from public.habit_completions where user_id=uid and habit_id=item->>'id';
    for day_value in select value from jsonb_array_elements(item->'completions') loop
      insert into public.habit_completions(user_id,habit_id,completion_date) values(uid,item->>'id',(day_value#>>'{}')::date) on conflict do nothing;
    end loop;
  end loop;
  update public.user_preferences set data=p,revision=current_revision+1,updated_at=now() where user_id=uid;
  return current_revision+1;
end $$;

-- Definer scope is restricted to a per-user counter. No direct table grants.
create function public.consume_ai_request() returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); amount integer;
begin
  if uid is null then return false; end if;
  insert into public.ai_rate_limits(user_id,window_start,request_count) values(uid,now(),1)
  on conflict(user_id) do update set request_count=case when public.ai_rate_limits.window_start<now()-interval '10 minutes' then 1 else public.ai_rate_limits.request_count+1 end,
  window_start=case when public.ai_rate_limits.window_start<now()-interval '10 minutes' then now() else public.ai_rate_limits.window_start end returning request_count into amount;
  return amount<=10;
end $$;
revoke all on function public.load_day_state() from public,anon;
revoke all on function public.save_day_state(jsonb,bigint) from public,anon;
revoke all on function public.consume_ai_request() from public,anon;
grant execute on function public.load_day_state() to authenticated;
grant execute on function public.save_day_state(jsonb,bigint) to authenticated;
grant execute on function public.consume_ai_request() to authenticated;
commit;
