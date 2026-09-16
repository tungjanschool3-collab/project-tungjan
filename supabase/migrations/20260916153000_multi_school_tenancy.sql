-- Multi-school tenancy with server-validated sessions and RLS isolation.
create extension if not exists pgcrypto;

create table if not exists app_schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{3,30}$'),
  name text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists app_admins (
  id int primary key default 1 check (id = 1),
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists app_sessions (
  token_hash text primary key,
  school_id uuid references app_schools(id) on delete cascade,
  role text not null check (role in ('admin','school')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_sessions_expires on app_sessions(expires_at);

insert into app_admins(id,password_hash)
values (1, crypt('044357246', gen_salt('bf', 10)))
on conflict (id) do nothing;

insert into app_schools(id,code,name,password_hash,active)
values ('00000000-0000-0000-0000-000000000001','tungjan','โรงเรียนวัดทุ่งจาน',crypt('044357246',gen_salt('bf',10)),true)
on conflict (id) do nothing;

alter table school_info add column if not exists school_id uuid references app_schools(id) on delete cascade;
alter table positions add column if not exists school_id uuid references app_schools(id) on delete cascade;
alter table teachers add column if not exists school_id uuid references app_schools(id) on delete cascade;
alter table school_accounts add column if not exists school_id uuid references app_schools(id) on delete cascade;
alter table accounts add column if not exists school_id uuid references app_schools(id) on delete cascade;
alter table projects add column if not exists school_id uuid references app_schools(id) on delete cascade;
alter table project_activities add column if not exists school_id uuid references app_schools(id) on delete cascade;
alter table utility_bills add column if not exists school_id uuid references app_schools(id) on delete cascade;
alter table calendar_events add column if not exists school_id uuid references app_schools(id) on delete cascade;
alter table transactions add column if not exists school_id uuid references app_schools(id) on delete cascade;

do $$ declare t text; begin
  foreach t in array array['school_info','positions','teachers','school_accounts','accounts','projects','project_activities','utility_bills','calendar_events','transactions'] loop
    execute format('update %I set school_id=$1 where school_id is null',t) using '00000000-0000-0000-0000-000000000001'::uuid;
    execute format('alter table %I alter column school_id set not null',t);
    execute format('create index if not exists %I on %I(school_id)','idx_'||t||'_school',t);
  end loop;
end $$;

alter table school_info drop constraint if exists school_single_row;
alter table school_info drop constraint if exists school_info_pkey;
alter table school_info add primary key (school_id,id);
alter table accounts drop constraint if exists accounts_code_key;
alter table accounts add constraint accounts_school_code_key unique(school_id,code);
alter table school_accounts drop constraint if exists school_accounts_name_key;
alter table school_accounts add constraint school_accounts_school_name_key unique(school_id,name);

create or replace function app_request_token() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)->>'x-app-session'
$$;
create or replace function app_session_school_id() returns uuid language sql stable security definer set search_path=public,extensions,pg_temp as $$
  select school_id from app_sessions where token_hash=encode(digest(coalesce(app_request_token(),''),'sha256'),'hex') and expires_at>now() limit 1
$$;
create or replace function app_session_role() returns text language sql stable security definer set search_path=public,extensions,pg_temp as $$
  select role from app_sessions where token_hash=encode(digest(coalesce(app_request_token(),''),'sha256'),'hex') and expires_at>now() limit 1
$$;

create or replace function app_login(p_code text,p_password text,p_admin boolean default false) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_school app_schools%rowtype; v_token text; v_role text; begin
  delete from app_sessions where expires_at<=now();
  if p_admin then
    if not exists(select 1 from app_admins where id=1 and password_hash=crypt(p_password,password_hash)) then raise exception 'รหัสผู้ดูแลระบบไม่ถูกต้อง'; end if;
    v_role:='admin';
  else
    select * into v_school from app_schools where lower(code)=lower(trim(p_code)) and active;
    if v_school.id is null or v_school.password_hash<>crypt(p_password,v_school.password_hash) then raise exception 'รหัสโรงเรียนหรือรหัสผ่านไม่ถูกต้อง'; end if;
    v_role:='school';
  end if;
  v_token:=encode(gen_random_bytes(32),'hex');
  insert into app_sessions(token_hash,school_id,role,expires_at) values(encode(digest(v_token,'sha256'),'hex'),v_school.id,v_role,now()+interval '12 hours');
  return jsonb_build_object('token',v_token,'role',v_role,'school_id',v_school.id,'school_name',v_school.name,'expires_at',now()+interval '12 hours');
end $$;

create or replace function app_whoami() returns jsonb language sql stable security definer set search_path=public,extensions,pg_temp as $$
  select coalesce((select jsonb_build_object('role',s.role,'school_id',s.school_id,'school_name',sc.name,'expires_at',s.expires_at)
    from app_sessions s left join app_schools sc on sc.id=s.school_id
    where s.token_hash=encode(digest(coalesce(app_request_token(),''),'sha256'),'hex') and s.expires_at>now() limit 1),'null'::jsonb)
$$;

create or replace function app_logout() returns boolean language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin delete from app_sessions where token_hash=encode(digest(coalesce(app_request_token(),''),'sha256'),'hex'); return true; end $$;

create or replace function app_admin_list_schools() returns table(id uuid,code text,name text,active boolean,created_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$ begin
  if app_session_role()<>'admin' then raise exception 'ไม่มีสิทธิ์ผู้ดูแลระบบ'; end if;
  return query select s.id,s.code,s.name,s.active,s.created_at from app_schools s order by s.created_at;
end $$;

create or replace function app_admin_create_school(p_code text,p_name text,p_password text,p_office text default '',p_district text default '',p_province text default '') returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_id uuid; v_parent record; v_new_parent uuid; begin
  if app_session_role()<>'admin' then raise exception 'ไม่มีสิทธิ์ผู้ดูแลระบบ'; end if;
  if length(trim(p_password))<6 then raise exception 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'; end if;
  insert into app_schools(code,name,password_hash) values(lower(trim(p_code)),trim(p_name),crypt(p_password,gen_salt('bf',10))) returning id into v_id;
  insert into school_info(school_id,id,name,office,district,province,fiscal_year) values(v_id,1,trim(p_name),p_office,p_district,p_province,2569);
  insert into positions(school_id,name,sort) select v_id,name,sort from positions where school_id='00000000-0000-0000-0000-000000000001';
  for v_parent in select * from school_accounts where school_id='00000000-0000-0000-0000-000000000001' order by sort loop
    insert into school_accounts(school_id,name,bank_name,account_no,note,sort,active) values(v_id,v_parent.name,null,null,v_parent.note,v_parent.sort,v_parent.active) returning id into v_new_parent;
    insert into accounts(school_id,code,name,category,opening_cash,opening_bank,opening_govdeposit,opening_debtor,opening_date,sort,active,school_account_id)
      select v_id,code,name,category,0,0,0,0,null,sort,active,v_new_parent from accounts where school_id='00000000-0000-0000-0000-000000000001' and school_account_id=v_parent.id;
  end loop;
  insert into accounts(school_id,code,name,category,opening_cash,opening_bank,opening_govdeposit,opening_debtor,opening_date,sort,active,school_account_id)
    select v_id,code,name,category,0,0,0,0,null,sort,active,null from accounts where school_id='00000000-0000-0000-0000-000000000001' and school_account_id is null;
  return jsonb_build_object('id',v_id,'code',lower(trim(p_code)),'name',trim(p_name),'active',true);
end $$;

create or replace function app_admin_set_school(p_school_id uuid,p_name text,p_active boolean,p_password text default null) returns boolean
language plpgsql security definer set search_path=public,extensions,pg_temp as $$ begin
  if app_session_role()<>'admin' then raise exception 'ไม่มีสิทธิ์ผู้ดูแลระบบ'; end if;
  update app_schools set name=trim(p_name),active=p_active,password_hash=case when coalesce(p_password,'')='' then password_hash else crypt(p_password,gen_salt('bf',10)) end where id=p_school_id;
  update school_info set name=trim(p_name) where school_id=p_school_id and id=1;
  return found;
end $$;

do $$ declare t text; begin
  foreach t in array array['school_info','positions','teachers','school_accounts','accounts','projects','project_activities','utility_bills','calendar_events','transactions'] loop
    execute format('alter table %I enable row level security',t);
    execute format('drop policy if exists app_all on %I',t);
    execute format('drop policy if exists tenant_isolation on %I',t);
    execute format('create policy tenant_isolation on %I for all using (school_id=app_session_school_id()) with check (school_id=app_session_school_id())',t);
  end loop;
end $$;

alter table app_schools enable row level security;
alter table app_admins enable row level security;
alter table app_sessions enable row level security;
revoke all on app_schools,app_admins,app_sessions from anon,authenticated;
grant execute on function app_login(text,text,boolean),app_whoami(),app_logout(),app_admin_list_schools(),app_admin_create_school(text,text,text,text,text,text),app_admin_set_school(uuid,text,boolean,text) to anon,authenticated;
