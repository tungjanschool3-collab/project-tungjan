create table if not exists public.school_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  bank_name text,
  account_no text,
  note text,
  sort int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.accounts
  add column if not exists school_account_id uuid references public.school_accounts(id) on delete set null;

create index if not exists idx_accounts_school_account on public.accounts(school_account_id);

alter table public.school_accounts enable row level security;
drop policy if exists "app_all" on public.school_accounts;
create policy "app_all" on public.school_accounts for all using (true) with check (true);
grant select, insert, update, delete on public.school_accounts to anon, authenticated;

insert into public.school_accounts (name, sort)
values ('โรงเรียนวัดทุ่งจาน-เงินอุดหนุนอื่นๆ', 10)
on conflict (name) do nothing;

update public.accounts
set name = 'ปัจจัยพื้นฐานนักเรียนยากจน'
where name = 'ยากจน';

update public.accounts
set school_account_id = (
  select id from public.school_accounts
  where name = 'โรงเรียนวัดทุ่งจาน-เงินอุดหนุนอื่นๆ'
)
where name in (
  'อนุบาลอุดหนุน',
  'ประถมอุดหนุน',
  'พัฒนาผู้เรียน',
  'อุปกรณ์การเรียน',
  'เครื่องแบบนักเรียน',
  'หนังสือเรียน',
  'ปัจจัยพื้นฐานนักเรียนยากจน'
);
