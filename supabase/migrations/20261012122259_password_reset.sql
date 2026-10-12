create table public.app_password_resets (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  role text not null check (role in ('admin','school')),
  school_id uuid references public.app_schools(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check ((role = 'admin' and school_id is null) or (role = 'school' and school_id is not null))
);

create index app_password_resets_account_idx on public.app_password_resets(role, school_id, created_at desc);
create index app_password_resets_expiry_idx on public.app_password_resets(expires_at) where used_at is null;

alter table public.app_password_resets enable row level security;
revoke all on table public.app_password_resets from public, anon, authenticated;
grant select, insert, update, delete on table public.app_password_resets to service_role;

create function public.app_complete_password_reset(p_token_hash text, p_password text)
returns boolean language plpgsql security invoker set search_path=public,extensions,pg_temp as $$
declare v_reset public.app_password_resets%rowtype;
begin
  if length(coalesce(p_password, '')) < 6 or length(p_password) > 128 then raise exception 'รหัสผ่านต้องมี 6–128 ตัวอักษร'; end if;
  select * into v_reset from public.app_password_resets
    where token_hash=p_token_hash and used_at is null and expires_at>now() for update;
  if v_reset.id is null then return false; end if;
  if v_reset.role='admin' then
    update public.app_admins set password_hash=crypt(p_password,gen_salt('bf',10)),updated_at=now() where id=1;
    delete from public.app_sessions where role='admin';
  else
    update public.app_schools set password_hash=crypt(p_password,gen_salt('bf',10)) where id=v_reset.school_id;
    delete from public.app_sessions where school_id=v_reset.school_id;
  end if;
  update public.app_password_resets set used_at=now() where id=v_reset.id;
  return true;
end $$;

revoke all on function public.app_complete_password_reset(text,text) from public, anon, authenticated;
grant execute on function public.app_complete_password_reset(text,text) to service_role;
