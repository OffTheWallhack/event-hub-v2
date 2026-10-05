-- Event Hub v2 — 001 core schema
-- ===== helpers =====
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ===== profiles & roles =====
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null default 'pending' check (role in ('pending','driver','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role in ('admin','driver'))
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    case when lower(new.email) = 'rdurica1995@gmail.com' then 'admin' else 'pending' end
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== master data =====
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  full_name text,
  engine text, horsepower int, weight_kg int, fuel text,
  image_path text, custom_photo_path text,
  is_generic boolean not null default false,
  equipment_notes text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_me boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flavors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  label text,
  color_bg text, color_text text, color_border text,
  photo_path text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'others' check (category in ('coolers','audio','branding','others')),
  quantity int not null default 1 check (quantity >= 0),
  qty_broken int not null default 0,
  qty_borrowed int not null default 0,
  qty_to_buy int not null default 0,
  status text not null default 'ok' check (status in ('ok','broken','lost','rented_out','borrowed','in_rent')),
  status_note text,
  held_by text,
  borrowed_from date, borrowed_until date,
  status_event_id uuid,
  photo_path text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.equipment_set_items (
  set_id uuid not null references public.equipment_sets(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  quantity int not null default 1,
  primary key (set_id, equipment_id)
);

-- ===== events =====
create table public.events (
  id uuid primary key default gen_random_uuid(),
  ical_uid text unique,
  title text not null,
  start_date timestamptz not null,
  end_date timestamptz,
  basecamp_notes text,
  basecamp_url text,
  deleted_from_basecamp boolean not null default false,
  deleted_from_basecamp_at timestamptz,
  status text not null default 'planned' check (status in ('planned','done','cancelled')),
  event_type text not null default 'event_car' check (event_type in ('event_car','support','adhoc','servis')),
  departments text[] not null default '{}',
  location text,
  location_url text,
  spectators int,
  planned_arrival time,
  contact text,
  requester text,
  event_client text,
  event_code text,
  description text,
  report text,
  rating int check (rating between 1 and 5),
  photos_folder_url text,
  social_url text,
  no_expenses boolean not null default false,
  played_as_dj boolean not null default false,
  service_notes text,
  service_due_at timestamptz,
  service_reminder_at timestamptz,
  legacy jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_valid check (departments <@ array['ec','culture','sport','onpremise']::text[])
);
create index events_start_idx on public.events (start_date);

alter table public.equipment add constraint equipment_status_event_fk
  foreign key (status_event_id) references public.events(id) on delete set null;

create table public.event_vehicles (
  event_id uuid not null references public.events(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, vehicle_id)
);

create table public.event_drivers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, driver_id)
);

create table public.event_equipment (
  event_id uuid not null references public.events(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  quantity int not null default 1,
  returned_confirmed boolean not null default false,
  returned_at timestamptz,
  issue text not null default 'none' check (issue in ('none','broken','not_returned')),
  created_at timestamptz not null default now(),
  primary key (event_id, equipment_id)
);

create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  path text,
  drive_url text,
  caption text,
  created_at timestamptz not null default now()
);

create table public.briefing_tokens (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  token text not null unique,
  label text,
  expires_at timestamptz,
  revoked boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- ===== product =====
create table public.carton_movements (
  id uuid primary key default gen_random_uuid(),
  flavor_id uuid not null references public.flavors(id) on delete restrict,
  cartons int not null check (cartons <> 0),
  type text not null check (type in ('delivery','event','returned','opened_garage','damaged','adjustment')),
  event_id uuid references public.events(id) on delete set null,
  person text,
  recipient text,
  note text,
  counts_in_stock boolean not null default true,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index carton_movements_event_idx on public.carton_movements (event_id);

create view public.carton_stock with (security_invoker = true) as
select f.id as flavor_id, f.name, f.label, f.sort_order, f.active,
       coalesce(sum(m.cartons) filter (where m.counts_in_stock), 0)::int as cartons
from public.flavors f
left join public.carton_movements m on m.flavor_id = f.id
group by f.id;

-- ===== finance (admin only) =====
create table public.driver_payouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  amount numeric(10,2) not null default 0,
  tax_rate numeric(5,4) not null default 0.15,
  paid boolean not null default false,
  paid_at timestamptz,
  note text,
  rate_per_hour numeric, hours numeric,
  started_at timestamptz, ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  doc_type text check (doc_type in ('blok','ucet','faktura','taxi','brigadnik','screenshot','ziadny')),
  amount numeric(10,2) not null,
  description text,
  event_id uuid references public.events(id) on delete set null,
  department text,
  control text,
  drive_file_url text,
  drive_file_name text,
  receipt_path text,
  paid_by text,
  reimbursed_to_payer boolean not null default false,
  reimbursed_to_payer_at timestamptz,
  reimbursed_by_redbull boolean not null default false,
  reimbursed_by_redbull_at timestamptz,
  note text,
  legacy jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (date);

-- ===== garage =====
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'general' check (scope in ('general','vehicle','garage')),
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  text text not null,
  status text not null default 'open' check (status in ('open','in_progress','done')),
  priority int not null default 0,
  due_date date,
  remind_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicle_services (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  date date,
  description text not null,
  cost numeric(10,2),
  created_at timestamptz not null default now()
);

-- ===== system =====
create table public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table public.sync_status (
  key text primary key,
  last_synced_at timestamptz,
  last_result jsonb,
  last_error text,
  updated_at timestamptz not null default now()
);

-- ===== updated_at triggers =====
do $$ declare t text; begin
  foreach t in array array['profiles','vehicles','drivers','flavors','equipment','events','event_drivers','driver_payouts','expenses','todos'] loop
    execute format('create trigger %I_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ===== RLS =====
do $$ declare t text; begin
  foreach t in array array['profiles','vehicles','drivers','flavors','equipment','equipment_sets','equipment_set_items','events','event_vehicles','event_drivers','event_equipment','event_photos','briefing_tokens','carton_movements','driver_payouts','expenses','todos','vehicle_services','app_settings','sync_status'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy profiles_self_read on public.profiles for select using (user_id = auth.uid() or public.is_admin());
create policy profiles_admin_write on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- operational data: approved users read, admins write
do $$ declare t text; begin
  foreach t in array array['vehicles','drivers','flavors','equipment','equipment_sets','equipment_set_items','events','event_vehicles','event_drivers','event_equipment','event_photos','carton_movements','todos','vehicle_services','sync_status'] loop
    execute format('create policy %I_read on public.%I for select using (public.is_approved())', t, t);
    execute format('create policy %I_admin_all on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- admin only: finances, tokens, settings
do $$ declare t text; begin
  foreach t in array array['driver_payouts','expenses','briefing_tokens','app_settings'] loop
    execute format('create policy %I_admin_all on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;
