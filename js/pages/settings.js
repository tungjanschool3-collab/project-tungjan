// ============================================================
//  หน้า "ข้อมูลหลัก" — โรงเรียน / ครู-ตำแหน่ง / บัญชี-ยอดยกมา / ปฏิทิน
// ============================================================
(function () {
  let tab = 'school';
  const TABS = [
    { k: 'school', label: '🏫 ข้อมูลโรงเรียน' },
    { k: 'staff', label: '👩‍🏫 ครู & ตำแหน่ง' },
    { k: 'accounts', label: '📒 บัญชี & ยอดยกมา' },
    { k: 'calendar', label: '📅 ปฏิทิน' },
  ];

  async function refresh() { await Store.loadAll(); App.go('settings'); }

  function render(c) {
    const D = Store.data();
    // แถบแท็บ
    const bar = U.el('<div class="card"><div class="chips" id="tabbar"></div></div>');
    const tb = bar.querySelector('#tabbar');
    TABS.forEach(t => {
      const chip = U.el(`<div class="chip ${tab === t.k ? 'active' : ''}">${t.label}</div>`);
      chip.onclick = () => { tab = t.k; App.go('settings'); };
      tb.appendChild(chip);
    });
    c.appendChild(bar);
    const body = U.el('<div></div>');
    c.appendChild(body);
    if (tab === 'school') renderSchool(body, D);
    if (tab === 'staff') renderStaff(body, D);
    if (tab === 'accounts') renderAccounts(body, D);
    if (tab === 'calendar') renderCalendar(body, D);
  }

  // ---------------- โรงเรียน ----------------
  function renderSchool(c, D) {
    const s = D.school || {};
    const card = U.el(`<div class="card">
      <h3>ข้อมูลโรงเรียน</h3>
      <div class="sub">ใช้แสดงหัวกระดาษของทุกทะเบียนคุมและช่องลงชื่อท้ายกระดาษ</div>
      <div class="grid c2" id="sf"></div>
      <div class="btn-row" style="margin-top:16px"><button class="btn primary" id="saveSchool">💾 บันทึกข้อมูลโรงเรียน</button></div>
    </div>`);
    const f = card.querySelector('#sf');
    const fields = [
      { n: 'name', l: 'ชื่อโรงเรียน', col: 1 },
      { n: 'office', l: 'สังกัด / สำนักงานเขต (เช่น สพป.นม.3)' },
      { n: 'fiscal_year', l: 'ปีงบประมาณ (พ.ศ.)', t: 'number' },
      { n: 'district', l: 'อำเภอ' },
      { n: 'province', l: 'จังหวัด' },
      { n: 'finance_officer', l: 'เจ้าหน้าที่การเงิน (ลงชื่อ)' },
      { n: 'auditor', l: 'ผู้ตรวจสอบ (ลงชื่อ)' },
      { n: 'director', l: 'ผู้อำนวยการ (ลงชื่อ)' },
    ];
    const inputs = {};
    fields.forEach(fd => {
      const w = U.el(`<div class="field" style="${fd.col === 1 ? 'grid-column:span 2' : ''}"><label>${fd.l}</label><input type="${fd.t || 'text'}" value="${U.esc(s[fd.n] ?? '')}"></div>`);
      inputs[fd.n] = w.querySelector('input');
      f.appendChild(w);
    });
    card.querySelector('#saveSchool').onclick = async () => {
      const patch = {};
      Object.entries(inputs).forEach(([k, i]) => patch[k] = k === 'fiscal_year' ? Number(i.value || 0) : i.value.trim());
      try { await Store.upsertSchool(patch); U.toast('บันทึกข้อมูลโรงเรียนแล้ว'); App.go('settings'); }
      catch (e) { U.toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'err'); }
    };
    c.appendChild(card);
  }

  // ---------------- ครู & ตำแหน่ง ----------------
  function renderStaff(c, D) {
    // ตำแหน่ง
    const posCard = U.el(`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center">
      <div><h3>ตำแหน่ง</h3><div class="sub">รายการตำแหน่งสำหรับเลือกให้ครู</div></div>
      <button class="btn primary sm" id="addPos">+ เพิ่มตำแหน่ง</button></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>ตำแหน่ง</th><th style="width:90px"></th></tr></thead><tbody id="posBody"></tbody></table></div></div>`);
    const pb = posCard.querySelector('#posBody');
    if (!D.positions.length) pb.appendChild(U.el('<tr><td colspan="2"><div class="empty">ยังไม่มีตำแหน่ง</div></td></tr>'));
    D.positions.forEach(p => {
      const tr = U.el(`<tr><td>${U.esc(p.name)}</td><td><div class="row-actions">
        <button class="icon-btn" title="แก้ไข">✏️</button><button class="icon-btn del" title="ลบ">🗑️</button></div></td></tr>`);
      tr.querySelectorAll('button')[0].onclick = () => editPos(p);
      tr.querySelectorAll('button')[1].onclick = () => delRow('positions', p.id, `ลบตำแหน่ง "${p.name}"?`);
      pb.appendChild(tr);
    });
    posCard.querySelector('#addPos').onclick = () => editPos(null);
    c.appendChild(posCard);

    // ครู
    const tCard = U.el(`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center">
      <div><h3>ครู / บุคลากร</h3><div class="sub">ใช้เลือกเป็น "ครูที่รับผิดชอบ" ในทะเบียนคุม</div></div>
      <button class="btn primary sm" id="addT">+ เพิ่มครู</button></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>ชื่อ–สกุล</th><th>ตำแหน่ง</th><th style="width:90px"></th></tr></thead><tbody id="tBody"></tbody></table></div></div>`);
    const tbb = tCard.querySelector('#tBody');
    if (!D.teachers.length) tbb.appendChild(U.el('<tr><td colspan="3"><div class="empty">ยังไม่มีข้อมูลครู</div></td></tr>'));
    D.teachers.forEach(t => {
      const pos = Store.positionById(t.position_id);
      const tr = U.el(`<tr><td>${U.esc(t.name)}</td><td>${U.esc(pos ? pos.name : '—')}</td><td><div class="row-actions">
        <button class="icon-btn">✏️</button><button class="icon-btn del">🗑️</button></div></td></tr>`);
      tr.querySelectorAll('button')[0].onclick = () => editTeacher(t);
      tr.querySelectorAll('button')[1].onclick = () => delRow('teachers', t.id, `ลบครู "${t.name}"?`);
      tbb.appendChild(tr);
    });
    tCard.querySelector('#addT').onclick = () => editTeacher(null);
    c.appendChild(tCard);
  }

  function editPos(p) {
    App.formModal({
      title: p ? 'แก้ไขตำแหน่ง' : 'เพิ่มตำแหน่ง',
      fields: [
        { name: 'name', label: 'ชื่อตำแหน่ง', required: true, col: 1 },
        { name: 'sort', label: 'ลำดับ', type: 'number' },
      ],
      values: p || { sort: (Store.data().positions.length + 1) * 10 },
      onSubmit: async (v) => {
        if (p) await Store.update('positions', p.id, v); else await Store.insert('positions', v);
        U.toast('บันทึกแล้ว'); await refresh();
      },
    });
  }
  function editTeacher(t) {
    App.formModal({
      title: t ? 'แก้ไขครู' : 'เพิ่มครู',
      fields: [
        { name: 'name', label: 'ชื่อ–สกุล', required: true, col: 1 },
        { name: 'position_id', label: 'ตำแหน่ง', type: 'select',
          options: [{ value: '', label: '— ไม่ระบุ —' }].concat(Store.data().positions.map(p => ({ value: p.id, label: p.name }))) },
        { name: 'sort', label: 'ลำดับ', type: 'number' },
      ],
      values: t || { sort: (Store.data().teachers.length + 1) * 10 },
      onSubmit: async (v) => {
        if (!v.position_id) v.position_id = null;
        if (t) await Store.update('teachers', t.id, v); else await Store.insert('teachers', v);
        U.toast('บันทึกแล้ว'); await refresh();
      },
    });
  }

  // ---------------- บัญชี & ยอดยกมา ----------------
  function renderAccounts(c, D) {
    const card = U.el(`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center">
      <div><h3>บัญชีทะเบียนที่ต้องการคุม</h3><div class="sub">แต่ละบัญชีจะมีทะเบียนคุมเงินนอกงบประมาณของตัวเอง — กรอก "ยอดยกมา" ต้นปีงบ</div></div>
      <button class="btn primary sm" id="addAcc">+ เพิ่มบัญชี</button></div>
      <div class="table-wrap"><table class="data">
      <thead><tr><th>บัญชี</th><th>ประเภท</th><th class="num">ยกมา:เงินสด</th><th class="num">ยกมา:ธนาคาร</th><th class="num">ยกมา:ส่วนราชการ</th><th class="num">ยกมา:ลูกหนี้</th><th>วันที่ยกมา</th><th style="width:90px"></th></tr></thead>
      <tbody id="accBody"></tbody></table></div></div>`);
    const b = card.querySelector('#accBody');
    if (!D.accounts.length) b.appendChild(U.el('<tr><td colspan="8"><div class="empty">ยังไม่มีบัญชี</div></td></tr>'));
    D.accounts.forEach(a => {
      const tr = U.el(`<tr>
        <td><b>${U.esc(a.name)}</b>${a.active === false ? ' <span class="pill" style="background:#eee;color:#888">ปิด</span>' : ''}</td>
        <td>${U.esc(a.category || '')}</td>
        <td class="num">${U.money(a.opening_cash)}</td>
        <td class="num">${U.money(a.opening_bank)}</td>
        <td class="num">${U.money(a.opening_govdeposit)}</td>
        <td class="num">${U.money(a.opening_debtor)}</td>
        <td>${U.esc(a.opening_date ? U.thaiDate(a.opening_date) : '—')}</td>
        <td><div class="row-actions"><button class="icon-btn">✏️</button><button class="icon-btn del">🗑️</button></div></td></tr>`);
      tr.querySelectorAll('button')[0].onclick = () => editAccount(a);
      tr.querySelectorAll('button')[1].onclick = () => delRow('accounts', a.id, `ลบบัญชี "${a.name}"? (ประวัติที่ผูกกับบัญชีนี้จะไม่ถูกลบแต่จะไม่มีบัญชีอ้างอิง)`);
      b.appendChild(tr);
    });
    card.querySelector('#addAcc').onclick = () => editAccount(null);
    c.appendChild(card);
  }
  function editAccount(a) {
    App.formModal({
      width: '620px',
      title: a ? 'แก้ไขบัญชี' : 'เพิ่มบัญชี',
      fields: [
        { name: 'name', label: 'ชื่อบัญชี', required: true, col: 1 },
        { name: 'category', label: 'ประเภท', type: 'select',
          options: ['อนุบาล', 'ประถม', 'อื่นๆ'].map(x => ({ value: x, label: x })) },
        { name: 'sort', label: 'ลำดับการแสดง', type: 'number' },
        { name: 'opening_cash', label: 'ยอดยกมา: เงินสด', type: 'number', step: '0.01' },
        { name: 'opening_bank', label: 'ยอดยกมา: เงินฝากธนาคาร', type: 'number', step: '0.01' },
        { name: 'opening_govdeposit', label: 'ยอดยกมา: เงินฝากส่วนราชการ', type: 'number', step: '0.01' },
        { name: 'opening_debtor', label: 'ยอดยกมา: ลูกหนี้', type: 'number', step: '0.01' },
        { name: 'opening_date', label: 'วันที่ยกยอดมา', type: 'date', col: 1 },
      ],
      values: a || { category: 'อื่นๆ', sort: (Store.data().accounts.length + 1) * 10 },
      onSubmit: async (v) => {
        if (!v.opening_date) v.opening_date = null;
        if (!a) v.code = 'acc_' + U.uid();
        if (a) await Store.update('accounts', a.id, v); else await Store.insert('accounts', v);
        U.toast('บันทึกบัญชีแล้ว'); await refresh();
      },
    });
  }

  // ---------------- ปฏิทิน ----------------
  function renderCalendar(c, D) {
    const card = U.el(`<div class="card"><div style="display:flex;justify-content:space-between;align-items:center">
      <div><h3>ปฏิทินกิจกรรม</h3><div class="sub">บันทึกวันสำคัญ เช่น 2 ส.ค. 69</div></div>
      <button class="btn primary sm" id="addEv">+ เพิ่มกิจกรรม</button></div>
      <div class="table-wrap"><table class="data"><thead><tr><th style="width:150px">วันที่</th><th>เรื่อง</th><th>รายละเอียด</th><th style="width:90px"></th></tr></thead><tbody id="evBody"></tbody></table></div></div>`);
    const b = card.querySelector('#evBody');
    if (!D.events.length) b.appendChild(U.el('<tr><td colspan="4"><div class="empty">ยังไม่มีกิจกรรม</div></td></tr>'));
    D.events.forEach(ev => {
      const tr = U.el(`<tr><td><b>${U.esc(U.thaiDate(ev.event_date))}</b></td><td>${U.esc(ev.title)}</td><td>${U.esc(ev.detail || '')}</td>
        <td><div class="row-actions"><button class="icon-btn">✏️</button><button class="icon-btn del">🗑️</button></div></td></tr>`);
      tr.querySelectorAll('button')[0].onclick = () => editEvent(ev);
      tr.querySelectorAll('button')[1].onclick = () => delRow('calendar_events', ev.id, `ลบกิจกรรม "${ev.title}"?`);
      b.appendChild(tr);
    });
    card.querySelector('#addEv').onclick = () => editEvent(null);
    c.appendChild(card);
  }
  function editEvent(ev) {
    App.formModal({
      title: ev ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม',
      fields: [
        { name: 'event_date', label: 'วันที่', type: 'date', required: true },
        { name: 'title', label: 'เรื่อง', required: true },
        { name: 'detail', label: 'รายละเอียด', type: 'textarea', col: 1 },
      ],
      values: ev || { event_date: U.todayISO() },
      onSubmit: async (v) => {
        if (ev) await Store.update('calendar_events', ev.id, v); else await Store.insert('calendar_events', v);
        U.toast('บันทึกกิจกรรมแล้ว'); await refresh();
      },
    });
  }

  // ---------------- ลบทั่วไป ----------------
  function delRow(table, id, msg) {
    App.confirmDialog(msg, async () => {
      try { await Store.remove(table, id); U.toast('ลบแล้ว'); await refresh(); }
      catch (e) { U.toast('ลบไม่สำเร็จ: ' + (e.message || e), 'err'); }
    });
  }

  App.register('settings', {
    title: 'ข้อมูลหลัก',
    subtitle: 'ตั้งค่าโรงเรียน ครู บัญชี และยอดยกมา',
    render,
  });
})();
