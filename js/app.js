// ============================================================
//  App — ล็อกอิน, เมนู, ตัวจัดการหน้า (router), โมดัล, ฟอร์มกลาง
// ============================================================
window.App = (function () {
  const pages = {};        // ทะเบียนหน้าต่าง ๆ (ลงทะเบียนจากไฟล์ js/pages/*)
  let current = null;

  function skeletonMarkup(key = current || 'dashboard') {
    const isDashboard = key === 'dashboard';
    const isSettings = key === 'settings';
    const cards = isDashboard ? 4 : (isSettings ? 3 : 2);
    return `<div class="skeleton-page" aria-live="polite" aria-busy="true">
      <span class="sr-only">กำลังโหลดข้อมูล</span>
      <div class="skeleton-toolbar"><span class="skeleton sk-pill"></span><span class="skeleton sk-pill short"></span></div>
      <div class="skeleton-grid ${isDashboard ? 'dashboard-grid' : ''}">
        ${Array.from({ length: cards }, (_, i) => `<div class="skeleton-card">
          <span class="skeleton sk-heading ${i % 2 ? 'short' : ''}"></span><span class="skeleton sk-value"></span><span class="skeleton sk-line"></span>
        </div>`).join('')}
      </div>
      <div class="skeleton-panel">
        <div class="skeleton-panel-head"><span class="skeleton sk-heading"></span><span class="skeleton sk-button"></span></div>
        ${Array.from({ length: 7 }, (_, i) => `<div class="skeleton-row"><span class="skeleton sk-cell ${i % 3 === 0 ? 'wide' : ''}"></span><span class="skeleton sk-cell"></span><span class="skeleton sk-cell short"></span></div>`).join('')}
      </div>
    </div>`;
  }

  function showSkeleton(key) {
    const view = U.$('#view');
    if (view) view.innerHTML = skeletonMarkup(key);
    U.$('#app')?.classList.add('is-loading');
  }

  function hideSkeleton() { U.$('#app')?.classList.remove('is-loading'); }

  const NAV = [
    { group: 'ภาพรวม' },
    { key: 'dashboard', icon: '🏠', label: 'แดชบอร์ด' },
    { group: 'บันทึกประจำวัน' },
    { key: 'daily', icon: '✍️', label: 'บันทึกรับ–จ่าย (หน้า 1)' },
    { group: 'ทะเบียนคุม' },
    { key: 'reg-subsidy', icon: '💵', label: 'รับเงินอุดหนุน (รายงวด)' },
    { key: 'reg-receipts', icon: '🧾', label: 'ใบเสร็จรับเงิน' },
    { key: 'reg-vouchers', icon: '📘', label: 'บค./บจ./บย./บร.' },
    { key: 'reg-orders', icon: '📗', label: 'ใบสั่งซื้อ/สั่งจ้าง/ไปราชการ' },
    { key: 'reg-offbudget', icon: '📙', label: 'เงินนอกงบประมาณ' },
    { key: 'reg-utility', icon: '💡', label: 'ค่าน้ำ-ไฟ-โทรศัพท์' },
    { group: 'รายงาน' },
    { key: 'report-daily-balance', icon: '📄', label: 'รายงานเงินคงเหลือประจำวัน' },
    { key: 'report-projects', icon: '📊', label: 'รายงานงบโครงการ' },
    { group: 'ตั้งค่า' },
    { key: 'settings', icon: '⚙️', label: 'ข้อมูลหลัก' },
  ];

  function register(key, page) { pages[key] = page; }

  // ---------------- boot ----------------
  async function boot() {
    Store.init();
    window.addEventListener('app:data-loading', e => {
      if (e.detail && e.detail.loading) showSkeleton(current || location.hash.replace('#', '') || 'dashboard');
      else hideSkeleton();
    });
    document.addEventListener('click', e => {
      if (thaiCalendar && !thaiCalendar.contains(e.target) && !e.target.classList.contains('thai-date-trigger')) {
        closeThaiCalendar();
      }
    });
    // ปุ่มล็อกอิน
    const inp = U.$('#codeInput'), err = U.$('#loginErr');
    U.$('#loginBtn').addEventListener('click', tryLogin);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
    function tryLogin() {
      const code = (window.APP_CONFIG && window.APP_CONFIG.ACCESS_CODE) || '044357246';
      if (inp.value.trim() === code) {
        sessionStorage.setItem('authed', '1');
        enterApp(false);
      } else { err.textContent = 'รหัสไม่ถูกต้อง ลองอีกครั้ง'; inp.select(); }
    }
    // เข้าระบบอัตโนมัติถ้าล็อกอินไว้แล้วในเซสชันนี้
    if (sessionStorage.getItem('authed') === '1') enterApp(false);
    else if ((location.hash.replace('#', '') || 'dashboard') === 'dashboard') enterApp(true);
    else U.$('#loginScreen').style.display = 'flex';
  }

  async function enterApp(publicOnly = false) {
    U.$('#loginScreen').style.display = 'none';
    U.$('#app').style.display = 'block';
    U.$('#app').classList.toggle('public-view', publicOnly);
    renderNav(publicOnly);
    await reload(true);
    // ไปหน้าเริ่มต้น
    const requested = location.hash.replace('#', '') || 'dashboard';
    const start = publicOnly ? 'dashboard' : requested;
    go(pages[start] ? start : 'dashboard');
    if (!window.__appHashBound) window.addEventListener('hashchange', () => {
      const k = location.hash.replace('#', '');
      if (k && pages[k] && k !== current) {
        if (k !== 'dashboard' && sessionStorage.getItem('authed') !== '1') {
          U.$('#app').style.display = 'none'; U.$('#loginScreen').style.display = 'flex';
        } else go(k);
      }
    });
    window.__appHashBound = true;
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
  function renderNav(publicOnly = false) {
    const nav = U.$('#nav');
    nav.innerHTML = '';
    if (publicOnly) {
      nav.appendChild(U.el('<div class="nav-group">หน้าสาธารณะ</div>'));
      const item = U.el('<div class="nav-item active" data-key="dashboard"><span class="ic">🏠</span><span>แดชบอร์ด</span></div>');
      item.onclick = () => go('dashboard'); nav.appendChild(item); return;
    }
    NAV.forEach(n => {
      if (n.group) { nav.appendChild(U.el(`<div class="nav-group">${U.esc(n.group)}</div>`)); return; }
      const item = U.el(`<div class="nav-item" data-key="${n.key}"><span class="ic">${n.icon}</span><span>${U.esc(n.label)}</span></div>`);
      item.addEventListener('click', () => go(n.key));
      nav.appendChild(item);
    });
  }

  function go(key) {
    if (!pages[key]) return;
    if (key !== 'dashboard' && sessionStorage.getItem('authed') !== '1') {
      U.$('#app').style.display = 'none'; U.$('#loginScreen').style.display = 'flex'; return;
    }
    current = key;
    location.hash = key;
    U.$$('#nav .nav-item').forEach(i => i.classList.toggle('active', i.dataset.key === key));
    const school = Store.data().school || {};
    const page = pages[key];
    // topbar
    U.$('#pageTitle').textContent = page.title || '';
    U.$('#pageSub').textContent = (typeof page.subtitle === 'function' ? page.subtitle() : page.subtitle) || (school.name || '');
    // ตัวเลือกปีงบประมาณ
    const badge = U.$('#yearBadge');
    badge.innerHTML = '';
    if (Store.isConfigured()) {
      const sel = U.el('<select id="fySelect" title="เลือกปีงบประมาณ">');
      Store.fyList().forEach(fy => sel.appendChild(U.el(`<option value="${fy}" ${fy === Store.getFY() ? 'selected' : ''}>ปีงบประมาณ ${fy}</option>`)));
      sel.onchange = () => { Store.setFY(sel.value); go(current); };
      badge.appendChild(sel);
    } else {
      badge.textContent = 'ปีงบประมาณ —';
    }
    // config warning
    const banner = U.$('#configBanner');
    banner.style.display = Store.isConfigured() ? 'none' : 'block';
    // render
    const c = U.$('#view');
    c.innerHTML = '';
    try { page.render(c); }
    catch (e) { console.error(e); c.appendChild(U.el(`<div class="card"><div class="empty">เกิดข้อผิดพลาด: ${U.esc(e.message || e)}</div></div>`)); }
    enhanceThaiDateInputs(c);
    window.scrollTo(0, 0);
  }

  // ---------------- ปฏิทินภาษาไทย ----------------
  const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const TH_DAYS = ['อา','จ','อ','พ','พฤ','ศ','ส'];
  let thaiCalendar;
  function isoParts(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? { y:Number(m[1]), m:Number(m[2])-1, d:Number(m[3]) } : null;
  }
  function thaiDateLabel(iso) {
    const p = isoParts(iso);
    return p ? `${p.d} ${TH_MONTHS[p.m]} ${p.y + 543}` : 'เลือกวันที่';
  }
  function closeThaiCalendar() {
    if (thaiCalendar) thaiCalendar.remove();
    thaiCalendar = null;
  }
  function openThaiCalendar(input, trigger) {
    closeThaiCalendar();
    const selected = isoParts(input.value), now = new Date();
    let viewY = selected ? selected.y : now.getFullYear(), viewM = selected ? selected.m : now.getMonth();
    const pop = U.el('<div class="thai-calendar" role="dialog" aria-label="ปฏิทินภาษาไทย"></div>');
    thaiCalendar = pop; document.body.appendChild(pop);
    const choose = (y,m,d) => {
      input.value = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      trigger.textContent = thaiDateLabel(input.value);
      input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
      closeThaiCalendar();
    };
    const draw = () => {
      const picked = isoParts(input.value), first = new Date(viewY,viewM,1).getDay(), days = new Date(viewY,viewM+1,0).getDate(), prevDays = new Date(viewY,viewM,0).getDate();
      pop.innerHTML = `<div class="thai-cal-head"><button type="button" class="prev" aria-label="เดือนก่อน">‹</button><strong>${TH_MONTHS[viewM]} ${viewY+543}</strong><button type="button" class="next" aria-label="เดือนถัดไป">›</button></div><div class="thai-cal-days">${TH_DAYS.map(x=>`<b>${x}</b>`).join('')}</div><div class="thai-cal-grid"></div><div class="thai-cal-foot"><button type="button" class="clear">ล้างวันที่</button><button type="button" class="today">วันนี้</button></div>`;
      const grid=pop.querySelector('.thai-cal-grid');
      for(let i=0;i<42;i++){
        const raw=i-first+1; let y=viewY,m=viewM,d=raw,muted=false;
        if(raw<1){m--;if(m<0){m=11;y--;}d=prevDays+raw;muted=true;}else if(raw>days){m++;if(m>11){m=0;y++;}d=raw-days;muted=true;}
        const isPicked=picked&&picked.y===y&&picked.m===m&&picked.d===d, isToday=now.getFullYear()===y&&now.getMonth()===m&&now.getDate()===d;
        const b=U.el(`<button type="button" class="${muted?'muted ':''}${isPicked?'selected ':''}${isToday?'current':''}">${d}</button>`); b.onclick=()=>choose(y,m,d); grid.appendChild(b);
      }
      pop.querySelector('.prev').onclick=()=>{viewM--;if(viewM<0){viewM=11;viewY--;}draw();};
      pop.querySelector('.next').onclick=()=>{viewM++;if(viewM>11){viewM=0;viewY++;}draw();};
      pop.querySelector('.clear').onclick=()=>{input.value='';trigger.textContent='เลือกวันที่';input.dispatchEvent(new Event('change',{bubbles:true}));closeThaiCalendar();};
      pop.querySelector('.today').onclick=()=>choose(now.getFullYear(),now.getMonth(),now.getDate());
    };
    draw();
    const r=trigger.getBoundingClientRect(), width=Math.min(330,window.innerWidth-24);
    pop.style.width=width+'px'; pop.style.left=Math.max(12,Math.min(r.left,window.innerWidth-width-12))+'px';
    pop.style.top=(r.bottom+8+330>window.innerHeight?Math.max(12,r.top-338):r.bottom+8)+'px';
  }
  function enhanceThaiDateInputs(root=document) {
    root.querySelectorAll('input[type="date"]:not([data-th-date])').forEach(input=>{
      input.dataset.thDate='1'; input.classList.add('native-date-source');
      const button=U.el(`<button type="button" class="thai-date-trigger">${thaiDateLabel(input.value)}</button>`);
      input.insertAdjacentElement('afterend',button); button.onclick=()=>openThaiCalendar(input,button);
    });
  }

  // ---------------- modal ----------------
  function openModal(title, bodyNode, footNode, opts = {}) {
    const back = U.$('#modalBack');
    const box = U.$('#modalBox');
    const fullscreen = opts.fullscreen || title === 'เพิ่มรายการรับ–จ่าย' || title === 'แก้ไขรายการ';
    box.style.width = fullscreen ? '100vw' : (opts.width || '');
    box.style.maxWidth = fullscreen ? '100vw' : '';
    box.style.height = fullscreen ? '100dvh' : '';
    box.style.maxHeight = fullscreen ? '100dvh' : '';
    box.style.borderRadius = fullscreen ? '0' : '';
    U.$('#modalTitle').textContent = title;
    const body = U.$('#modalBody'); body.innerHTML = ''; body.appendChild(bodyNode);
    enhanceThaiDateInputs(body);
    const foot = U.$('#modalFoot'); foot.innerHTML = '';
    if (footNode) foot.appendChild(footNode);
    back.classList.add('show');
    return { close: closeModal };
  }
  function closeModal() { U.$('#modalBack').classList.remove('show'); }

  function confirmDialog(msg, onYes, { danger = true, yes = 'ยืนยัน' } = {}) {
    const body = U.el(`<div style="font-size:15px;padding:6px 0">${U.esc(msg)}</div>`);
    const foot = U.el('<div class="btn-row"></div>');
    const ok = U.el(`<button class="btn ${danger ? 'danger' : 'primary'}">${U.esc(yes)}</button>`);
    ok.onclick = async () => { closeModal(); await onYes(); };
    foot.append(ok);
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
    const save = U.el(`<button class="btn primary">💾 ${U.esc(submitLabel)}</button>`);
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
    foot.append(save);
    openModal(title, grid, foot, { width });
  }

  // ---------------- helper: ตัวเลือกเดือน ----------------
  function monthOptions() {
    const fy = Store.getFY();
    const set = new Set(Store.txnsFY(fy).map(t => U.ymOf(t.txn_date)).filter(Boolean));
    // ถ้าปีงบที่เลือก = ปีงบปัจจุบันตามปฏิทิน ให้มีเดือนปัจจุบันด้วย
    if (U.fiscalYearOf(U.todayISO()) === fy) set.add(U.ymOf(U.todayISO()));
    // อย่างน้อยต้องมี 1 เดือน (เดือนแรกของปีงบ = ต.ค. ปีก่อน)
    if (!set.size) set.add((fy - 543 - 1) + '-10');
    return Array.from(set).sort().reverse();
  }

  return { register, boot, go, reload, openModal, closeModal, confirmDialog, formModal, monthOptions, pages };
})();

document.addEventListener('DOMContentLoaded', () => {
  // ปิดโมดัลด้วยปุ่มกากบาทเท่านั้น การคลิกพื้นหลังและปุ่ม Esc จะไม่ปิดหน้าต่าง
  U.$('#modalClose').addEventListener('click', App.closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && U.$('#modalBack').classList.contains('show')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  U.$('#reloadBtn').addEventListener('click', () => App.reload(false));
  U.$('#logoutBtn').addEventListener('click', () => { sessionStorage.removeItem('authed'); location.reload(); });
  App.boot();
});
