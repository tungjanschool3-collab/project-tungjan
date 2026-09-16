// ============================================================
//  Admin หลัก — จัดการโรงเรียนที่เข้าใช้งาน
// ============================================================
(function () {
  async function render(c) {
    c.innerHTML = '<div class="card"><div class="empty">กำลังโหลดรายชื่อโรงเรียน...</div></div>';
    try {
      const schools = await Store.adminSchools();
      c.innerHTML = '';
      const top = U.el(`<div class="toolbar"><div><h3>โรงเรียนในระบบ</h3><div class="sub">ข้อมูลของแต่ละโรงเรียนแยกจากกันด้วยสิทธิ์ฐานข้อมูล</div></div><div class="spacer"></div><button class="btn primary" id="addSchool">＋ เพิ่มโรงเรียน</button></div>`);
      top.querySelector('#addSchool').onclick = addSchool;
      c.appendChild(top);
      const card = U.el('<div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>รหัสโรงเรียน</th><th>ชื่อโรงเรียน</th><th>สถานะ</th><th>วันที่เพิ่ม</th><th></th></tr></thead><tbody></tbody></table></div></div>');
      const body = card.querySelector('tbody');
      schools.forEach(s => {
        const tr = U.el(`<tr><td><code>${U.esc(s.code)}</code></td><td><b>${U.esc(s.name)}</b></td><td><span class="status-pill ${s.active ? 'active' : 'inactive'}">${s.active ? 'เปิดใช้งาน' : 'ระงับใช้งาน'}</span></td><td>${U.esc(U.thaiDate(String(s.created_at).slice(0,10),{fullYear:true}))}</td><td><button class="btn ghost sm">แก้ไข</button></td></tr>`);
        tr.querySelector('button').onclick = () => editSchool(s); body.appendChild(tr);
      });
      if (!schools.length) body.appendChild(U.el('<tr><td colspan="5" class="empty">ยังไม่มีโรงเรียน</td></tr>'));
      c.appendChild(card);
    } catch (e) { c.innerHTML = `<div class="card"><div class="empty">โหลดข้อมูลไม่สำเร็จ: ${U.esc(e.message || e)}</div></div>`; }
  }

  function addSchool() {
    App.formModal({ title:'เพิ่มโรงเรียน', width:'680px', fields:[
      {name:'name',label:'ชื่อโรงเรียน',required:true,col:1},
      {name:'code',label:'รหัสโรงเรียน',required:true,hint:'อักษรอังกฤษตัวเล็ก/ตัวเลข 3–30 ตัว เช่น banmai01'},
      {name:'password',label:'รหัสผ่าน',required:true,hint:'อย่างน้อย 6 ตัวอักษร'},
      {name:'office',label:'สังกัด/สำนักงานเขต'}, {name:'district',label:'อำเภอ'},
      {name:'province',label:'จังหวัด'},
    ], onSubmit:async v => {
      v.code=String(v.code||'').toLowerCase();
      if(!/^[a-z0-9_-]{3,30}$/.test(v.code)) throw new Error('รหัสโรงเรียนต้องเป็นอังกฤษตัวเล็ก ตัวเลข _ หรือ - จำนวน 3–30 ตัว');
      if(String(v.password||'').length<6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      await Store.adminCreateSchool(v); U.toast('เพิ่มโรงเรียนแล้ว'); App.go('admin-schools');
    }});
  }

  function editSchool(s) {
    App.formModal({ title:'แก้ไขโรงเรียน', fields:[
      {name:'name',label:'ชื่อโรงเรียน',required:true,col:1},
      {name:'password',label:'รหัสผ่านใหม่',hint:'เว้นว่างหากไม่ต้องการเปลี่ยน',col:1},
      {name:'active',label:'เปิดใช้งาน',type:'checkbox',col:1},
    ], values:{name:s.name,password:'',active:s.active}, onSubmit:async v=>{
      if(v.password && v.password.length<6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      await Store.adminSetSchool({id:s.id,...v}); U.toast('บันทึกแล้ว'); App.go('admin-schools');
    }});
  }

  App.register('admin-schools',{title:'Admin หลัก',subtitle:'เพิ่มโรงเรียนและจัดการสิทธิ์เข้าใช้งาน',render});
})();
