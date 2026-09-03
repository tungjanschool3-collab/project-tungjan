// ============================================================
//  ไฟล์ตั้งค่า - แก้ 3 บรรทัดนี้ให้ตรงกับโปรเจกต์ Supabase ของคุณ
//  (ดูวิธีหาได้ในไฟล์ README-setup-TH.md หัวข้อ "ขั้นที่ 2")
// ============================================================
window.APP_CONFIG = {
  // 1) URL ของโปรเจกต์ Supabase  เช่น https://abcdefgh.supabase.co
  SUPABASE_URL: "https://hatdivsmtputifhjcyhf.supabase.co",

  // 2) anon public key  (Project Settings > API > anon public)
  //    ⬇️ ยังขาดค่านี้ค่าเดียว — วาง key ที่ขึ้นต้นด้วย eyJ ระหว่างเครื่องหมาย " "
  SUPABASE_ANON_KEY: "sb_publishable_JlBoZAHo30uswBpaVBKX0A_v16Ijzw9",

  // 3) รหัสผ่านเข้าใช้งานโปรแกรม
  ACCESS_CODE: "044357246",
};
