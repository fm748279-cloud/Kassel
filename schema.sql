-- =========================================================
--  كاسب لقطع الغيار — قاعدة البيانات (Supabase / PostgreSQL)
--  شغّل هذا الملف كاملاً مرة واحدة من: SQL Editor ← New query ← Run
-- =========================================================

-- ---------- المشرفون (من يملك صلاحية لوحة الإدارة) ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- القطع ----------
create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  part_number text,
  brand text,
  category text,
  condition text not null default 'new' check (condition in ('new','used','scrap')),
  price numeric(10,2),
  stock integer not null default 1,
  fits jsonb not null default '[]'::jsonb,      -- [{"make":"تويوتا","model":"كامري","from":2018,"to":2024}]
  images text[] not null default '{}',
  description text,
  source_vehicle text,                           -- للتشليح: السيارة المصدر
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists parts_active_idx on public.parts (is_active, created_at desc);
create index if not exists parts_pn_idx on public.parts (lower(part_number));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists parts_touch on public.parts;
create trigger parts_touch before update on public.parts
  for each row execute function public.touch_updated_at();

-- ---------- طلبات الشراء ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  phone text not null check (char_length(phone) between 8 and 20),
  city text not null check (char_length(city) <= 60),
  vin text check (vin is null or char_length(vin) <= 17),
  vehicle text check (vehicle is null or char_length(vehicle) <= 120),
  notes text check (notes is null or char_length(notes) <= 1000),
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0,
  status text not null default 'new' check (status in ('new','confirmed','shipped','done','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- ---------- طلبات قطع غير موجودة ----------
create table if not exists public.part_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (char_length(phone) between 8 and 20),
  city text check (city is null or char_length(city) <= 60),
  vehicle text check (vehicle is null or char_length(vehicle) <= 120),
  vin text check (vin is null or char_length(vin) <= 17),
  part_text text not null check (char_length(part_text) between 2 and 1000),
  status text not null default 'new' check (status in ('new','quoted','done','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists requests_created_idx on public.part_requests (created_at desc);

-- ---------- الصلاحيات (Row Level Security) ----------
alter table public.admins        enable row level security;
alter table public.parts         enable row level security;
alter table public.orders        enable row level security;
alter table public.part_requests enable row level security;

-- المشرف يرى نفسه فقط
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (user_id = auth.uid());

-- القطع: الجميع يرى القطع المفعّلة، والمشرف يدير الكل
drop policy if exists parts_public_read on public.parts;
create policy parts_public_read on public.parts for select using (is_active or public.is_admin());
drop policy if exists parts_admin_write on public.parts;
create policy parts_admin_write on public.parts for all using (public.is_admin()) with check (public.is_admin());

-- الطلبات: أي زائر يرسل طلب، والمشرف فقط يقرأ ويعدّل
drop policy if exists orders_public_insert on public.orders;
create policy orders_public_insert on public.orders for insert with check (status = 'new');
drop policy if exists orders_admin on public.orders;
create policy orders_admin on public.orders for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists requests_public_insert on public.part_requests;
create policy requests_public_insert on public.part_requests for insert with check (status = 'new');
drop policy if exists requests_admin on public.part_requests;
create policy requests_admin on public.part_requests for all using (public.is_admin()) with check (public.is_admin());

-- ---------- تخزين صور القطع ----------
insert into storage.buckets (id, name, public)
values ('parts', 'parts', true)
on conflict (id) do nothing;

drop policy if exists parts_img_read on storage.objects;
create policy parts_img_read on storage.objects for select using (bucket_id = 'parts');
drop policy if exists parts_img_write on storage.objects;
create policy parts_img_write on storage.objects for insert with check (bucket_id = 'parts' and public.is_admin());
drop policy if exists parts_img_update on storage.objects;
create policy parts_img_update on storage.objects for update using (bucket_id = 'parts' and public.is_admin());
drop policy if exists parts_img_delete on storage.objects;
create policy parts_img_delete on storage.objects for delete using (bucket_id = 'parts' and public.is_admin());

-- =========================================================
--  بعد إنشاء حسابك من Authentication ← Users ← Add user
--  شغّل السطر التالي مع وضع بريدك، ليصبح حسابك مشرفاً:
--
--  insert into public.admins (user_id)
--  select id from auth.users where email = 'بريدك@example.com';
-- =========================================================
