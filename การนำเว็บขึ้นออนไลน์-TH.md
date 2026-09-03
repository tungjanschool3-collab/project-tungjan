# 🌐 วิธีนำเว็บขึ้นออนไลน์ (ให้มีลิงก์ใช้งานจริง)

โปรแกรมคุมเงินนอกงบประมาณ — โรงเรียนวัดทุ่งจาน
GitHub repo ของคุณ: https://github.com/tungjanschool3-collab/project-tungjan

> เราจะทำ 2 ช่วง: **(1) เอาโค้ดขึ้น GitHub** → **(2) เชื่อม Vercel เพื่อได้ลิงก์เว็บ**
> ทำผ่านหน้าเว็บล้วน ๆ ไม่ต้องพิมพ์คำสั่งใด ๆ

---

## ✅ ช่วงที่ 1 — อัปโหลดโค้ดขึ้น GitHub

1. เปิด repo: **https://github.com/tungjanschool3-collab/project-tungjan**
2. กด **Add file** (มุมขวาบน) → **Upload files**
   - ถ้า repo ยังว่าง จะมีลิงก์ **"uploading an existing file"** กดได้เลย
3. เปิดโฟลเดอร์ `E:\โปรแกรมคุมเงินนอกงบประมาณ` ใน File Explorer
   - กดในโฟลเดอร์ → **Ctrl+A** เลือกทั้งหมด
   - ต้องได้: `index.html`, `config.js`, `vercel.json`, ไฟล์คู่มือ `.md`
     และโฟลเดอร์ `css`, `js`, `supabase`
   - **ลากทั้งหมด** ไปวางในกรอบ *Drag files here* ของ GitHub
   - รอจนรายชื่อไฟล์ขึ้นครบ (โฟลเดอร์ย่อยติดมาเอง)
4. เลื่อนลงล่างสุด → กดปุ่มเขียว **Commit changes**

✔️ สำเร็จเมื่อ: หน้า repo แสดงไฟล์ครบ (เห็นโฟลเดอร์ css / js / supabase)

---

## ✅ ช่วงที่ 2 — เชื่อม Vercel เพื่อได้ลิงก์เว็บ

1. เปิด **https://vercel.com** → กด **Sign Up** (หรือ Log in)
   - เลือก **Continue with GitHub** (ใช้บัญชี GitHub เดียวกับที่ทำ repo) → กด **Authorize**
2. เข้ามาแล้วกด **Add New…** → **Project**
3. หัวข้อ **Import Git Repository** จะเห็น repo ชื่อ **project-tungjan**
   - ถ้าไม่เห็น กด **Adjust GitHub App Permissions / Configure** แล้วเลือกให้เข้าถึง repo นั้น
   - กดปุ่ม **Import** ตรง repo `project-tungjan`
4. หน้า Configure Project:
   - **Framework Preset:** ปล่อยเป็น **Other** (ไม่ต้องเลือกอะไร)
   - **Root Directory:** ปล่อยค่าเดิม
   - ไม่ต้องตั้งค่าอื่น
   - กดปุ่ม **Deploy**
5. รอสักครู่ (ประมาณ 20–40 วินาที) จะขึ้น **Congratulations!** 🎉
   - กด **Continue to Dashboard** หรือ **Visit** เพื่อเปิดเว็บ
   - จะได้ลิงก์แบบ `https://project-tungjan.vercel.app`

✔️ สำเร็จเมื่อ: เปิดลิงก์แล้วเจอหน้าล็อกอิน ใส่รหัส **044357246** เข้าได้

---

## 🔑 ช่วงที่ 3 — ใส่ anon key (เมื่อพร้อมให้บันทึกข้อมูลได้จริง)

ตอนนี้เว็บออนไลน์แล้ว แต่ยัง "บันทึกข้อมูลไม่ได้" จนกว่าจะใส่ key
(จะขึ้นแถบเหลืองเตือนว่ายังไม่เชื่อมต่อฐานข้อมูล)

**วิธีใส่ key:**
1. เอา anon key จาก: https://supabase.com/dashboard/project/hatdivsmtputifhjcyhf/settings/api
   (กล่อง `anon` `public` → Copy — ข้อความยาวขึ้นต้น `eyJ`)
2. แก้ไฟล์ `config.js` บรรทัด `SUPABASE_ANON_KEY: "",` ให้เป็น `SUPABASE_ANON_KEY: "eyJ...",`
   - แก้ในเครื่องก็ได้ (Notepad) แล้วอัปโหลดทับใน GitHub
   - หรือแก้บน GitHub โดยตรง: เข้า repo → คลิกไฟล์ `config.js` → กดไอคอน ✏️ (Edit) → วาง key → **Commit changes**
3. **Vercel จะ deploy ใหม่ให้อัตโนมัติ** ทุกครั้งที่แก้ไฟล์บน GitHub (รอ ~30 วิ)

> 💡 หรือส่ง key ให้ผมในแชต ผมจะแก้ `config.js` ในเครื่องให้ แล้วคุณแค่อัปโหลดทับไฟล์เดียว

---

## 🔄 การแก้ไข/อัปเดตเว็บภายหลัง
- แก้ไฟล์ในเครื่อง → อัปโหลดทับใน GitHub (Add file → Upload files ทับไฟล์เดิม) → Vercel deploy ใหม่ให้เอง
- ทุกการเปลี่ยนแปลงบน GitHub = เว็บอัปเดตอัตโนมัติภายในไม่กี่วินาที

## 🏷️ (ทางเลือก) เปลี่ยนชื่อลิงก์ให้จำง่าย
- ใน Vercel → เลือกโปรเจกต์ → **Settings → Domains** → เพิ่ม/แก้ชื่อ subdomain เช่น `tungjan-money.vercel.app`

---

### สรุปสั้น ๆ
| ช่วง | ทำอะไร | ผลลัพธ์ |
|---|---|---|
| 1 | อัปโหลดไฟล์ขึ้น GitHub | โค้ดอยู่บนคลาวด์ |
| 2 | Import ใน Vercel → Deploy | ได้ลิงก์เว็บใช้งาน |
| 3 | ใส่ anon key | บันทึกข้อมูลได้จริง |

มีสะดุดตรงไหน ถ่ายรูปหน้าจอส่งมาได้ทุกขั้นครับ 🙌
