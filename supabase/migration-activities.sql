-- ============================================================
--  Migration: เพิ่ม "กิจกรรมย่อย" ในโครงการ (project_activities)
--  วิธีใช้: เปิด Supabase > SQL Editor > New query > วางทั้งไฟล์นี้ > Run
--  ปลอดภัยที่จะรันซ้ำได้
-- ============================================================

-- ตารางกิจกรรมย่อย (แต่ละแถวเป็นกิจกรรมภายใต้ 1 โครงการ)
create table if not exists project_activities (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,  -- ลบโครงการ = ลบกิจกรรมย่อยด้วย
  name        text not null,        -- ชื่อกิจกรรมย่อย
  budget      numeric default 0,    -- งบประมาณย่อย
  level       text,                 -- ระดับ (อนุบาล/ประถม/รวม/อื่นๆ)
  responsible text,                 -- ผู้รับผิดชอบ
  sort        int default 0
);
create index if not exists idx_activity_project on project_activities(project_id);

-- ช่องเพิ่มเงินโครงการ (กรณีมีเงินเกิน/เหลือ ปรับเพิ่มหรือลดงบได้ — ค่า + หรือ -)
alter table projects add column if not exists budget_adjust numeric default 0;

-- เปิดสิทธิ์เข้าถึง (RLS policy เหมือนตารางอื่น)
alter table project_activities enable row level security;
do $$
begin
  execute 'drop policy if exists "app_all" on project_activities';
  execute 'create policy "app_all" on project_activities for all using (true) with check (true)';
end $$;

-- ============================================================
--  เสร็จสิ้น — กลับไปที่เว็บแล้วกด "โหลดข้อมูลใหม่"
-- ============================================================
