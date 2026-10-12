alter table public.app_schools add column if not exists email text;
alter table public.app_admins add column if not exists email text;

alter table public.app_schools drop constraint if exists app_schools_email_format;
alter table public.app_schools add constraint app_schools_email_format
  check (email is null or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');
alter table public.app_admins drop constraint if exists app_admins_email_format;
alter table public.app_admins add constraint app_admins_email_format
  check (email is null or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');

create unique index if not exists app_schools_email_unique
  on public.app_schools (lower(email)) where email is not null;

drop function if exists public.app_admin_list_schools();
create function public.app_admin_list_schools()
returns table(id uuid,code text,name text,email text,active boolean,created_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$ begin
  if app_session_role()<>'admin' then raise exception 'ไม่มีสิทธิ์ผู้ดูแลระบบ'; end if;
  return query select s.id,s.code,s.name,s.email,s.active,s.created_at from app_schools s order by s.created_at;
end $$;

drop function if exists public.app_admin_create_school(text,text,text,text,text,text);
create function public.app_admin_create_school(
  p_code text,p_name text,p_password text,p_office text default '',p_district text default '',p_province text default '',p_email text default null
) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_id uuid; v_parent record; v_new_parent uuid; v_email text; begin
  if app_session_role()<>'admin' then raise exception 'ไม่มีสิทธิ์ผู้ดูแลระบบ'; end if;
  if length(trim(p_password))<6 then raise exception 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'; end if;
  v_email:=nullif(lower(trim(coalesce(p_email,''))), '');
  if v_email is not null and v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'รูปแบบอีเมลไม่ถูกต้อง'; end if;
  insert into app_schools(code,name,email,password_hash)
    values(lower(trim(p_code)),trim(p_name),v_email,crypt(p_password,gen_salt('bf',10))) returning id into v_id;
  insert into school_info(school_id,id,name,office,district,province,fiscal_year) values(v_id,1,trim(p_name),p_office,p_district,p_province,2569);
  insert into positions(school_id,name,sort) select v_id,name,sort from positions where school_id='00000000-0000-0000-0000-000000000001';
  for v_parent in select * from school_accounts where school_id='00000000-0000-0000-0000-000000000001' order by sort loop
    insert into school_accounts(school_id,name,bank_name,account_no,note,sort,active) values(v_id,v_parent.name,null,null,v_parent.note,v_parent.sort,v_parent.active) returning id into v_new_parent;
    insert into accounts(school_id,code,name,category,opening_cash,opening_bank,opening_govdeposit,opening_debtor,opening_date,sort,active,school_account_id)
      select v_id,code,name,category,0,0,0,0,null,sort,active,v_new_parent from accounts where school_id='00000000-0000-0000-0000-000000000001' and school_account_id=v_parent.id;
  end loop;
  insert into accounts(school_id,code,name,category,opening_cash,opening_bank,opening_govdeposit,opening_debtor,opening_date,sort,active,school_account_id)
    select v_id,code,name,category,0,0,0,0,null,sort,active,null from accounts where school_id='00000000-0000-0000-0000-000000000001' and school_account_id is null;
  return jsonb_build_object('id',v_id,'code',lower(trim(p_code)),'name',trim(p_name),'email',v_email,'active',true);
end $$;

drop function if exists public.app_admin_set_school(uuid,text,boolean,text);
create function public.app_admin_set_school(p_school_id uuid,p_name text,p_active boolean,p_password text default null,p_email text default null)
returns boolean language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_email text; begin
  if app_session_role()<>'admin' then raise exception 'ไม่มีสิทธิ์ผู้ดูแลระบบ'; end if;
  v_email:=nullif(lower(trim(coalesce(p_email,''))), '');
  if v_email is not null and v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'รูปแบบอีเมลไม่ถูกต้อง'; end if;
  update app_schools set name=trim(p_name),email=v_email,active=p_active,
    password_hash=case when coalesce(p_password,'')='' then password_hash else crypt(p_password,gen_salt('bf',10)) end
    where id=p_school_id;
  update school_info set name=trim(p_name) where school_id=p_school_id and id=1;
  return found;
end $$;

create or replace function public.app_set_account_email(p_email text) returns text
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_role text; v_email text; v_school uuid; begin
  v_role:=app_session_role();
  if v_role not in ('admin','school') then raise exception 'กรุณาเข้าสู่ระบบใหม่'; end if;
  v_email:=nullif(lower(trim(coalesce(p_email,''))), '');
  if v_email is not null and v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'รูปแบบอีเมลไม่ถูกต้อง'; end if;
  if v_role='admin' then update app_admins set email=v_email,updated_at=now() where id=1;
  else v_school:=app_session_school_id(); update app_schools set email=v_email where id=v_school; end if;
  return v_email;
end $$;

create or replace function public.app_login(p_code text,p_password text,p_admin boolean default false) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_school app_schools%rowtype; v_token text; v_role text; v_email text; begin
  delete from app_sessions where expires_at<=now();
  if p_admin then
    select email into v_email from app_admins where id=1 and password_hash=crypt(p_password,password_hash);
    if not found then raise exception 'รหัสผู้ดูแลระบบไม่ถูกต้อง'; end if;
    v_role:='admin';
  else
    select * into v_school from app_schools where lower(code)=lower(trim(p_code)) and active;
    if v_school.id is null or v_school.password_hash<>crypt(p_password,v_school.password_hash) then raise exception 'รหัสโรงเรียนหรือรหัสผ่านไม่ถูกต้อง'; end if;
    v_role:='school'; v_email:=v_school.email;
  end if;
  v_token:=encode(gen_random_bytes(32),'hex');
  insert into app_sessions(token_hash,school_id,role,expires_at) values(encode(digest(v_token,'sha256'),'hex'),v_school.id,v_role,now()+interval '12 hours');
  return jsonb_build_object('token',v_token,'role',v_role,'school_id',v_school.id,'school_name',v_school.name,'email',v_email,'expires_at',now()+interval '12 hours');
end $$;

create or replace function public.app_whoami() returns jsonb
language sql stable security definer set search_path=public,extensions,pg_temp as $$
  select coalesce((select jsonb_build_object('role',s.role,'school_id',s.school_id,'school_name',sc.name,
    'email',case when s.role='admin' then (select a.email from app_admins a where a.id=1) else sc.email end,'expires_at',s.expires_at)
    from app_sessions s left join app_schools sc on sc.id=s.school_id
    where s.token_hash=encode(digest(coalesce(app_request_token(),''),'sha256'),'hex') and s.expires_at>now() limit 1),'null'::jsonb)
$$;

revoke all on function public.app_admin_list_schools() from public;
revoke all on function public.app_admin_create_school(text,text,text,text,text,text,text) from public;
revoke all on function public.app_admin_set_school(uuid,text,boolean,text,text) from public;
revoke all on function public.app_set_account_email(text) from public;
grant execute on function public.app_admin_list_schools(),public.app_admin_create_school(text,text,text,text,text,text,text),
  public.app_admin_set_school(uuid,text,boolean,text,text),public.app_set_account_email(text) to anon,authenticated;
