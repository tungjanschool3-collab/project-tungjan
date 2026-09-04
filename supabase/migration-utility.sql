-- ============================================================
--  Migration: ทะเบียนค่าสาธารณูปโภค (ค่าน้ำ / ค่าไฟ / ค่าโทรศัพท์) รายเดือน
--  วิธีใช้: เปิด Supabase > SQL Editor > New query > วางทั้งไฟล์นี้ > Run
--  ปลอดภัยที่จะรันซ้ำได้
-- ============================================================

create table if not exists utility_bills (
  id          uuid primary key default gen_random_uuid(),
  bill_month  text not null,        -- เดือนของบิล 'YYYY-MM' (เช่น 2026-05)
  type        text not null,        -- ประเภท: water / electric / phone / internet / other
  units       numeric default 0,    -- หน่วยที่ใช้
  amount      numeric default 0,    -- จำนวนเงิน (บาท)
  note        text,                 -- หมายเหตุ
  created_at  timestamptz default now()
);
create index if not exists idx_utility_month on utility_bills(bill_month);

alter table utility_bills enable row level security;
do $$
begin
  execute 'drop policy if exists "app_all" on utility_bills';
  execute 'create policy "app_all" on utility_bills for all using (true) with check (true)';
end $$;

-- ============================================================
--  เสร็จสิ้น — กลับไปที่เว็บแล้วกด "โหลดข้อมูลใหม่"
-- ============================================================
