// ============================================================
//  App — ล็อกอิน, เมนู, ตัวจัดการหน้า (router), โมดัล, ฟอร์มกลาง
// ============================================================
window.App = (function () {
  const pages = {};        // ทะเบียนหน้าต่าง ๆ (ลงทะเบียนจากไฟล์ js/pages/*)
  let current = null;

  const NAV = [
    { group: 'ภาพรวม' },
    { key: 'dashboard', icon: '🏠', label: 'แดชบอร์ด' },
    { group: 'บันทึกประจำวัน' },
    { key: 'daily', icon: '✍️', label: 'บันทึกรับ–จ่าย (หน้า 1)' },
    { group: 'ทะเบียนคุม' },
    { key: 'reg-vouchers', icon: '📘', label: 'บค./บจ./บย./บร.' },
    { key: 'reg-orders', icon: '📗', label: 'ใบสั่งซื้อ/สั่งจ้าง/ไปราชการ' },
    { key: 'reg-offbudget', icon: '📙', label: 'เงินนอกงบประมาณ' },
    { group: 'ตั้งค่า' },
    { key: 'settings', icon: '⚙️', label: 'ข้อมูลหลัก' },
  ];

  function register(key, page) { pages[key] = page; }

  // ---------------- boot ----------------
  async function boot() {
    Store.init();
    // ปุ่มล็อกอิน
    const inp = U.$('#codeInput'), err = U.$('#loginErr');
    U.$('#loginBtn').addEventListener('click', tryLogin);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
    function tryLogin() {
      const code = (window.APP_CONFIG && window.APP_CONFIG.ACCESS_CODE) || '044357246';
      if (inp.value.trim() === code) {
        sessionStorage.setItem('authed', '1');
        enterApp();
      } else { err.textContent = 'รหัสไม่ถูกต้อง ลองอีกครั้ง'; inp.select(); }
    }
    // เข้าระบบอัตโนมัติถ้าล็อกอินไว้แล้วในเซสชันนี้
    if (sessionStorage.getItem('authed') === '1') enterApp();
    else U.$('#loginScreen').style.display = 'flex';
  }

  async function enterApp() {
    U.$('#loginScreen').style.display = 'none';
    U.$('#app').style.display = 'block';
    renderNav();
    await reload(true);
    // ไปหน้าเริ่มต้น
    const start = location.hash.replace('#', '') || 'dashboard';
    go(pages[start] ? start : 'dashboard');
    window.addEventListener('hashchange', () => {
      const k = location.hash.replace('#', '');
      if (k && pages[k] && k !== current) go(k);
    });
  }

  // ---------------- data reload ----------------
  async function reload(silent) {
    if (!Store.isConfigured()) { if (!silent) U.toast('ยังไม่ได้ตั้งค่า Supabase', 'err'); return; }
    try {
      await Store.loadAll();
      if (!silent) U.toast('โหลดข้อมูลใหม่แล้ว');
      if (current) go(current);
    } catch (e) {
      console.error(e);
      U.toast('โหลดข้อมูลไม่สำเร็จ: ' + (e.message || e), 'err');
    }
  }

  // ---------------- nav ----------------
  function renderNav() {
    const nav = U.$('#nav');
    nav.innerHTML = '';
    NAV.forEach(n => {
      if (n.group) { nav.appendChild(U.el(`<div class="nav-group">${U.esc(n.group)}</div>`)); return; }
      const item = U.el(`<div class="nav-item" data-key="${n.key}"><span class="ic">${n.icon}</span><span>${U.esc(n.label)}</span></div>`);
      item.addEventListener('click', () => go(n.key));
      nav.appendChild(item);
    });
  }

  function go(key) {
    if (!pages[key]) return;
    current = key;
    location.hash = key;
    U.$$('#nav .nav-item').forEach(i => i.classList.toggle('active', i.dataset.key === key));
    const school = Store.data().school || {};
    const page = pages[key];
    // topbar
    U.$('#pageTitle').textContent = page.title || '';
    U.$('#pageSub').textContent = (typeof page.subtitle === 'function' ? page.subtitle() : page.subtitle) || (school.name || '');
    U.$('#yearBadge').textContent = 'ปีงบประมาณ ' + (school.fiscal_year || '—');
    // config warning
    const banner = U.$('#configBanner');
    banner.style.display = Store.isConfigured() ? 'none' : 'block';
    // render
    const c = U.$('#view');
    c.innerHTML = '';
    try { page.render(c); }
    catch (e) { console.error(e); c.appendChild(U.el(`<div class="card"><div class="empty">เกิดข้อผิดพลาด: ${U.esc(e.message || e)}</div></div>`)); }
    window.scrollTo(0, 0);
  }

  // ---------------- modal ----------------
  function openModal(title, bodyNode, footNode, opts = {}) {
    const back = U.$('#modalBack');
    const box = U.$('#modalBox');
    box.style.width = opts.width || '';
    U.$('#modalTitle').textContent = title;
    const body = U.$('#modalBody'); body.innerHTML = ''; body.appendChild(bodyNode);
    const foot = U.$('#modalFoot'); foot.innerHTML = '';
    if (footNode) foot.appendChild(footNode);
    back.classList.add('show');
    return { close: closeModal };
  }
  function closeModal() { U.$('#modalBack').classList.remove('show'); }

  function confirmDialog(msg, onYes, { danger = true, yes = 'ยืนยัน' } = {}) {
    const body = U.el(`<div style="font-size:15px;padding:6px 0">${U.esc(msg)}</div>`);
    const foot = U.el('<div class="btn-row"></div>');
    const no = U.el('<button class="btn ghost">ยกเลิก</button>');
    const ok = U.el(`<button class="btn ${danger ? 'danger' : 'primary'}">${U.esc(yes)}</button>`);
    no.onclick = closeModal;
    ok.onclick = async () => { closeModal(); await onYes(); };
    foot.append(no, ok);
    openModal('ยืนยันการทำรายการ', body, foot);
  }

  // ---------------- ฟอร์มกลาง (ใช้ในโมดัลเพิ่ม/แก้ไข) ----------------
  // fields: [{name,label,type,options,required,col(1..12),hint,readonly,step,placeholder}]
  function formModal({ title, fields, values = {}, onSubmit, submitLabel = 'บันทึก', width }) {
    const grid = U.el('<div class="grid c2"></div>');
    const inputs = {};
    fields.forEach(f => {
      const wrap = U.el(`<div class="field" style="${f.col === 1 ? 'grid-column:span 2' : ''}"></div>`);
      wrap.appendChild(U.el(`<label>${U.esc(f.label)}${f.required ? ' *' : ''}</label>`));
      let inp;
      const v = values[f.name] != null ? values[f.name] : (f.default != null ? f.default : '');
      if (f.type === 'select') {
        inp = U.el('<select></select>');
        (f.options || []).forEach(o => {
          const op = U.el(`<option value="${U.esc(o.value)}">${U.esc(o.label)}</option>`);
          if (String(o.value) === String(v)) op.selected = true;
          inp.appendChild(op);
        });
      } else if (f.type === 'textarea') {
        inp = U.el('<textarea rows="2"></textarea>'); inp.value = v;
      } else if (f.type === 'checkbox') {
        inp = U.el(`<input type="checkbox" style="width:20px;height:20px">`);
        inp.checked = !!v;
      } else {
        inp = U.el(`<input type="${f.type || 'text'}" ${f.step ? `step="${f.step}"` : ''} ${f.readonly ? 'readonly' : ''} ${f.placeholder ? `placeholder="${U.esc(f.placeholder)}"` : ''}>`);
        inp.value = v;
      }
      inputs[f.name] = { inp, def: f };
      wrap.appendChild(inp);
      if (f.hint) wrap.appendChild(U.el(`<div class="hint">${U.esc(f.hint)}</div>`));
      grid.appendChild(wrap);
    });
    const foot = U.el('<div class="btn-row"></div>');
    const cancel = U.el('<button class="btn ghost">ยกเลิก</button>');
    const save = U.el(`<button class="btn primary">💾 ${U.esc(submitLabel)}</button>`);
    cancel.onclick = closeModal;
    save.onclick = async () => {
      const out = {};
      for (const [name, { inp, def }] of Object.entries(inputs)) {
        let val;
        if (def.type === 'checkbox') val = inp.checked;
        else if (def.type === 'number') val = inp.value === '' ? 0 : Number(inp.value);
        else val = inp.value.trim ? inp.value.trim() : inp.value;
        if (def.required && (val === '' || val == null)) { U.toast(`กรุณากรอก: ${def.label}`, 'err'); inp.focus(); return; }
        out[name] = val === '' && def.type !== 'number' ? null : val;
      }
      save.disabled = true; save.textContent = 'กำลังบันทึก...';
      try { await onSubmit(out); closeModal(); }
      catch (e) { console.error(e); U.toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'err'); save.disabled = false; save.textContent = '💾 ' + submitLabel; }
    };
    foot.append(cancel, save);
    openModal(title, grid, foot, { width });
  }

  // ---------------- helper: ตัวเลือกเดือน ----------------
  function monthOptions() {
    const set = new Set(Store.data().transactions.map(t => U.ymOf(t.txn_date)).filter(Boolean));
    // เพิ่มเดือนปัจจุบันเสมอ
    set.add(U.ymOf(U.todayISO()));
    return Array.from(set).sort().reverse();
  }

  return { register, boot, go, reload, openModal, closeModal, confirmDialog, formModal, monthOptions, pages };
})();

document.addEventListener('DOMContentLoaded', () => {
  // ปุ่มปิดโมดัล/คลิกพื้นหลัง
  U.$('#modalClose').addEventListener('click', App.closeModal);
  U.$('#modalBack').addEventListener('click', e => { if (e.target.id === 'modalBack') App.closeModal(); });
  U.$('#reloadBtn').addEventListener('click', () => App.reload(false));
  U.$('#logoutBtn').addEventListener('click', () => { sessionStorage.removeItem('authed'); location.reload(); });
  App.boot();
});
