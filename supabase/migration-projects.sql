-- ============================================================
--  Migration: เพิ่มระบบ "โครงการ" (projects) + เชื่อมกับ transactions
--  วิธีใช้: เปิด Supabase > SQL Editor > New query > วางทั้งไฟล์นี้ > Run
--  ปลอดภัยที่จะรันซ้ำได้ (ใช้ if not exists / drop policy if exists)
-- ============================================================

-- 1) ตารางโครงการ (พร้อมงบประมาณที่ได้รับ)
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,        -- ชื่อโครงการ
  budget      numeric default 0,    -- งบที่ได้รับจัดสรร
  level       text,                 -- ระดับ (อนุบาล/ประถม/รวม/อื่นๆ)
  responsible text,                 -- ผู้รับผิดชอบ
  note        text,                 -- หมายเหตุ
  sort        int default 0,
  active      boolean default true
);

-- 2) เชื่อมโครงการเข้ากับรายการรับ-จ่าย
alter table transactions add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists idx_txn_project on transactions(project_id);

-- 3) เปิดสิทธิ์เข้าถึง (RLS policy เหมือนตารางอื่นในระบบ)
alter table projects enable row level security;
do $$
begin
  execute 'drop policy if exists "app_all" on projects';
  execute 'create policy "app_all" on projects for all using (true) with check (true)';
end $$;

-- ============================================================
--  เสร็จสิ้น — กลับไปที่เว็บแล้วกด "โหลดข้อมูลใหม่"
-- ============================================================
