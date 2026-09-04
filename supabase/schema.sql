-- ============================================================
--  โปรแกรมคุมเงินนอกงบประมาณ - โครงสร้างฐานข้อมูล (Supabase / PostgreSQL)
--  วิธีใช้: เปิด Supabase > SQL Editor > New query > วางทั้งไฟล์นี้ > Run
--  ปลอดภัยที่จะรันซ้ำได้ (ใช้ if not exists / on conflict)
-- ============================================================

-- ---------- 1) ข้อมูลโรงเรียน (เก็บแถวเดียว id=1) ----------
create table if not exists school_info (
  id              int primary key default 1,
  name            text default 'โรงเรียนวัดทุ่งจาน',
  office          text default 'สพป.นม.3',            -- สังกัด/สำนักงานเขต
  district        text default 'อำเภอปักธงชัย',
  province        text default 'นครราชสีมา',
  fiscal_year     int  default 2569,                  -- ปีงบประมาณ (พ.ศ.)
  finance_officer text default '',                    -- เจ้าหน้าที่การเงิน
  auditor         text default '',                    -- ผู้ตรวจสอบ
  director         text default '',                    -- ผู้อำนวยการ
  updated_at      timestamptz default now(),
  constraint school_single_row check (id = 1)
);

-- ---------- 2) ตำแหน่ง ----------
create table if not exists positions (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  sort  int default 0
);

-- ---------- 3) ครู ----------
create table if not exists teachers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  position_id uuid references positions(id) on delete set null,
  sort        int default 0
);

-- ---------- 4) บัญชีทะเบียนที่ต้องการคุม ----------
create table if not exists accounts (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique,           -- slug เช่น anuban_udnun
  name               text not null,         -- ชื่อบัญชี เช่น อนุบาลอุดหนุน
  category           text default 'อื่นๆ',  -- อนุบาล / ประถม / อื่นๆ
  opening_cash       numeric default 0,     -- ยอดยกมา: เงินสด
  opening_bank       numeric default 0,     -- ยอดยกมา: เงินฝากธนาคาร
  opening_govdeposit numeric default 0,     -- ยอดยกมา: เงินฝากส่วนราชการ
  opening_debtor     numeric default 0,     -- ยอดยกมา: ลูกหนี้
  opening_date       date,                  -- วันที่ยกยอด
  sort               int default 0,
  active             boolean default true
);

-- ---------- 4.5) โครงการ (พร้อมงบประมาณที่ได้รับ) ----------
create table if not exists projects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,        -- ชื่อโครงการ
  fiscal_year   int default 2569,     -- ปีงบประมาณ (พ.ศ.)
  budget        numeric default 0,    -- งบประมาณรวมที่ได้รับจัดสรร
  budget_adjust numeric default 0,    -- เงินเพิ่ม/ปรับงบ (กรณีเกิน/เหลือ, + หรือ -)
  level         text,                 -- (สำรอง) ระดับรวมของโครงการ
  responsible   text,                 -- (สำรอง) ผู้รับผิดชอบรวมของโครงการ
  note          text,                 -- หมายเหตุ
  sort          int default 0,
  active        boolean default true
);

-- ---------- 4.6) กิจกรรมย่อยในโครงการ ----------
create table if not exists project_activities (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  name        text not null,        -- ชื่อกิจกรรมย่อย
  budget      numeric default 0,    -- งบประมาณย่อย
  level       text,                 -- ระดับ (อนุบาล/ประถม/รวม/อื่นๆ)
  responsible text,                 -- ผู้รับผิดชอบ
  sort        int default 0
);
create index if not exists idx_activity_project on project_activities(project_id);

-- ---------- 5) ปฏิทิน/กิจกรรม ----------
create table if not exists calendar_events (
  id         uuid primary key default gen_random_uuid(),
  event_date date not null,
  title      text not null,
  detail     text
);

-- ---------- 6) รายการรับ-จ่ายเงิน (หน้า 1) = แหล่งข้อมูลหลัก ----------
--  ทุกทะเบียนคุมสร้างจากตารางนี้โดยอัตโนมัติ
create table if not exists transactions (
  id           uuid primary key default gen_random_uuid(),
  txn_date     date not null,
  doc_type     text,                 -- ประเภทเอกสาร: บค / บจ / บย / บร
  doc_no       int,                  -- เลขที่เอกสาร (running ต่อปีงบ)
  round_no     int,                  -- งวดที่รับเงินอุดหนุน (1..สุดท้าย)
  description  text,                 -- รายการ
  amount_in    numeric default 0,    -- รายรับ
  amount_out   numeric default 0,    -- รายจ่าย
  account_id   uuid references accounts(id) on delete set null,

  -- สำหรับทะเบียนคุมเงินนอกงบประมาณ (แยกช่องจ่าย/ที่เก็บเงิน)
  pay_debtor   numeric default 0,    -- จ่าย: ลูกหนี้
  pay_voucher  numeric default 0,    -- จ่าย: ใบสำคัญ
  bal_type     text default 'bank',  -- เงินเข้า/ออกช่องไหน: cash/bank/govdeposit

  -- สำหรับทะเบียนคุมใบสั่งซื้อ/สั่งจ้าง/ไปราชการ
  po_no        text,                 -- ใบสั่งซื้อ
  hire_no      text,                 -- ใบสั่งจ้าง
  memo_no      text,                 -- เลขบันทึกข้อความ
  project      text,                 -- โครงการ
  level        text,                 -- ระดับ (อนุบาล/ประถม)
  travel       boolean default false,-- ไปราชการ
  clear_status text,                 -- ล้างหนี้: cleared(เช็คล้างหนี้)/none(ไม่ทำ)/null
  teacher_id   uuid references teachers(id) on delete set null, -- ครูที่รับผิดชอบ
  project_id   uuid references projects(id) on delete set null,  -- เชื่อมกับตาราง projects

  notes        text,                 -- หมายเหตุ
  created_at   timestamptz default now()
);

-- เพิ่มคอลัมน์เชื่อมโครงการ (สำหรับฐานข้อมูลที่สร้างไว้ก่อนแล้ว)
alter table transactions add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists idx_txn_date    on transactions(txn_date);
create index if not exists idx_txn_account on transactions(account_id);
create index if not exists idx_txn_docno    on transactions(doc_no);
create index if not exists idx_txn_project on transactions(project_id);

-- ============================================================
--  Row Level Security
--  แอปนี้เป็นเครื่องมือภายในของโรงเรียน (single-tenant) ป้องกันการเข้าถึง
--  ด้วยรหัสผ่านหน้าเว็บ (044357246) จึงเปิด policy ให้ anon เข้าถึงได้
--  *ข้อควรทราบ: anon key ฝังอยู่ในหน้าเว็บ = เปิดเผยได้ ผู้ที่รู้ URL+key
--   จะเข้าถึงข้อมูลได้ หากต้องการความปลอดภัยสูงขึ้นให้เปิดใช้ Supabase Auth
--   ภายหลัง (ดูคู่มือ) แล้วแก้ policy ให้ตรวจ auth.uid()
-- ============================================================
alter table school_info      enable row level security;
alter table positions        enable row level security;
alter table teachers         enable row level security;
alter table accounts         enable row level security;
alter table projects         enable row level security;
alter table project_activities enable row level security;
alter table calendar_events  enable row level security;
alter table transactions     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['school_info','positions','teachers','accounts','projects','project_activities','calendar_events','transactions']
  loop
    execute format('drop policy if exists "app_all" on %I;', t);
    execute format('create policy "app_all" on %I for all using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================
--  ข้อมูลเริ่มต้น (seed)
-- ============================================================

-- โรงเรียน (แถวเดียว)
insert into school_info (id, name, office, district, province, fiscal_year)
values (1, 'โรงเรียนวัดทุ่งจาน', 'สพป.นม.3', 'อำเภอปักธงชัย', 'นครราชสีมา', 2569)
on conflict (id) do nothing;

-- บัญชีทะเบียนที่ต้องการคุม (ตามรายการที่แนบ)
insert into accounts (code, name, category, sort) values
  ('anuban_udnun',    'อนุบาลอุดหนุน',    'อนุบาล', 10),
  ('anuban_pattana',  'อนุบาลพัฒนา',      'อนุบาล', 20),
  ('anuban_uniform',  'อนุบาลเครื่องแบบ', 'อนุบาล', 30),
  ('anuban_upakorn',  'อนุบาลอุปกรณ์',    'อนุบาล', 40),
  ('prathom_udnun',   'ประถมอุดหนุน',     'ประถม',  50),
  ('prathom_pattana', 'ประถมพัฒนา',       'ประถม',  60),
  ('prathom_uniform', 'ประถมเครื่องแบบ',  'ประถม',  70),
  ('prathom_book',    'ประถมหนังสือ',     'ประถม',  80),
  ('kongtun',         'กองทุน',           'อื่นๆ',  90),
  ('ahan_chao',       'อาหารเช้า',        'อื่นๆ',  100),
  ('ahan_klangwan',   'อาหารกลางวัน',     'อื่นๆ',  110),
  ('raidai',          'รายได้',           'อื่นๆ',  120),
  ('yakjon',          'ยากจน',            'อื่นๆ',  130),
  ('yakjon_special',  'ยากจนพิเศษ',       'อื่นๆ',  140),
  ('raidai_pandin',   'รายได้แผ่นดิน',    'อื่นๆ',  150)
on conflict (code) do nothing;

-- ตำแหน่งตัวอย่าง
insert into positions (name, sort)
select v.name, v.sort from (values
  ('ผู้อำนวยการโรงเรียน', 10),
  ('ครู', 20),
  ('ครูผู้ช่วย', 30),
  ('เจ้าหน้าที่การเงิน', 40),
  ('เจ้าหน้าที่พัสดุ', 50)
) as v(name, sort)
where not exists (select 1 from positions);

-- ============================================================
--  เสร็จสิ้น — กลับไปที่แอปแล้วกด "โหลดข้อมูลใหม่"
-- ============================================================
