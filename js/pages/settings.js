// ============================================================
//  หน้า "ข้อมูลหลัก" — โรงเรียน / ครู-ตำแหน่ง / บัญชี-ยอดยกมา / ปฏิทิน
// ============================================================
(function () {
  let tab = 'school';
  const TABS = [
    { k: 'school', label: '🏫 ข้อมูลโรงเรียน' },
    { k: 'staff', label: '👩‍🏫 ครู & ตำแหน่ง' },
    { k: 'accounts', label: '📒 บัญชี & ยอดยกมา' },
    { k: 'projects', label: '📁 โครงการ' },
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
    if (tab === 'projects') renderProjects(body, D);
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

  // ---------------- โครงการ + กิจกรรมย่อย ----------------
  // CSV แบบเรียบ: 1 แถว = 1 กิจกรรมย่อย (โครงการที่ซ้ำจะถูกจับกลุ่มให้เอง)
  const PROJ_COLS = [
    { key: 'project',     header: 'โครงการ',      match: ['โครงการ', 'project'] },
    { key: 'total',       header: 'งบประมาณรวม',  match: ['งบประมาณรวม', 'งบรวม', 'รวม', 'total'] },
    { key: 'activity',    header: 'กิจกรรม',      match: ['กิจกรรม', 'activity'] },
    { key: 'sub',         header: 'งบประมาณย่อย', match: ['ย่อย', 'งบกิจกรรม', 'sub'] },
    { key: 'level',       header: 'ระดับ',        match: ['ระดับ', 'level'] },
    { key: 'responsible', header: 'ผู้รับผิดชอบ',  match: ['รับผิดชอบ', 'ผู้รับ', 'responsible', 'owner'] },
  ];
  const netBudget = p => Number(p.budget || 0) + Number(p.budget_adjust || 0);
  const actsOf = pid => (Store.data().projectActivities || []).filter(a => a.project_id === pid).sort((x, y) => (x.sort || 0) - (y.sort || 0));

  function parseNum(v) {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function renderProjects(c, D) {
    // แถบเครื่องมือ
    const bar = U.el(`<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div><h3>โครงการ &amp; กิจกรรมย่อย</h3><div class="sub">แต่ละโครงการมีงบประมาณรวม แตกเป็นกิจกรรมย่อย (งบย่อย/ระดับ/ผู้รับผิดชอบ) — นำเข้า/ส่งออก CSV ได้</div></div>
        <div class="btn-row" style="flex-wrap:wrap">
          <button class="btn primary sm" id="addProj">+ เพิ่มโครงการ</button>
          <button class="btn excel sm" id="expProj">⬇️ ส่งออก CSV</button>
          <button class="btn sm" id="impProj">⬆️ นำเข้า CSV/Excel</button>
          <button class="btn ghost sm" id="tplProj">📄 ไฟล์ตัวอย่าง</button>
          <input type="file" id="impFile" accept=".csv,.xlsx,.xls" style="display:none">
        </div>
      </div>
    </div>`);
    bar.querySelector('#addProj').onclick = () => editProject(null);
    bar.querySelector('#expProj').onclick = exportProjectsCSV;
    bar.querySelector('#tplProj').onclick = downloadProjectTemplate;
    const fileInput = bar.querySelector('#impFile');
    bar.querySelector('#impProj').onclick = () => fileInput.click();
    fileInput.onchange = () => { if (fileInput.files[0]) importProjectsFile(fileInput.files[0]); fileInput.value = ''; };
    c.appendChild(bar);

    if (!D.projects.length) {
      c.appendChild(U.el('<div class="card"><div class="empty">ยังไม่มีโครงการ — กด “+ เพิ่มโครงการ” หรือ “นำเข้า CSV/Excel”</div></div>'));
      return;
    }

    D.projects.forEach(p => {
      const list = actsOf(p.id);
      const subTotal = list.reduce((s, a) => s + Number(a.budget || 0), 0);
      const net = netBudget(p);
      const adjust = Number(p.budget_adjust || 0);
      const over = subTotal > net;
      const card = U.el(`<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0 0 2px">${U.esc(p.name)}</h3>
            <div class="sub">งบประมาณรวม <b>${U.money(p.budget)}</b>${adjust ? ` ${adjust > 0 ? '+' : '−'} เพิ่ม/ปรับ ${U.money(Math.abs(adjust))} = งบสุทธิ <b>${U.money(net)}</b>` : ''} · รวมงบกิจกรรมย่อย ${U.money(subTotal)}${over ? ' <span style="color:#c0392b">(เกินงบ)</span>' : ''}</div>
          </div>
          <div class="btn-row">
            <button class="btn primary sm addAct">+ เพิ่มกิจกรรม</button>
            <button class="icon-btn editP" title="แก้ไขโครงการ">✏️</button>
            <button class="icon-btn del delP" title="ลบโครงการ">🗑️</button>
          </div>
        </div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>กิจกรรมย่อย</th><th class="num">งบประมาณย่อย</th><th>ระดับ</th><th>ผู้รับผิดชอบ</th><th style="width:90px"></th></tr></thead>
          <tbody class="actBody"></tbody>
        </table></div>
      </div>`);
      const tb = card.querySelector('.actBody');
      if (!list.length) tb.appendChild(U.el('<tr><td colspan="5"><div class="empty" style="padding:10px 0">ยังไม่มีกิจกรรมย่อย — กด “+ เพิ่มกิจกรรม”</div></td></tr>'));
      list.forEach(a => {
        const tr = U.el(`<tr>
          <td>${U.esc(a.name)}</td>
          <td class="num">${U.money(a.budget)}</td>
          <td>${U.esc(a.level || '')}</td>
          <td>${U.esc(a.responsible || '')}</td>
          <td><div class="row-actions"><button class="icon-btn">✏️</button><button class="icon-btn del">🗑️</button></div></td></tr>`);
        tr.querySelectorAll('button')[0].onclick = () => editActivity(p, a);
        tr.querySelectorAll('button')[1].onclick = () => delRow('project_activities', a.id, `ลบกิจกรรม "${a.name}"?`);
        tb.appendChild(tr);
      });
      card.querySelector('.addAct').onclick = () => editActivity(p, null);
      card.querySelector('.editP').onclick = () => editProject(p);
      card.querySelector('.delP').onclick = () => delRow('projects', p.id, `ลบโครงการ "${p.name}"? (กิจกรรมย่อยทั้งหมดจะถูกลบด้วย)`);
      c.appendChild(card);
    });

    const gBudget = D.projects.reduce((s, p) => s + netBudget(p), 0);
    c.appendChild(U.el(`<div class="card" style="font-weight:700;background:#f7f9fe">รวมงบประมาณสุทธิทุกโครงการ (${D.projects.length} โครงการ): ${U.money(gBudget)}</div>`));
  }

  function editProject(p) {
    App.formModal({
      width: '620px',
      title: p ? 'แก้ไขโครงการ' : 'เพิ่มโครงการ',
      fields: [
        { name: 'name', label: 'ชื่อโครงการ', required: true, col: 1 },
        { name: 'budget', label: 'งบประมาณรวม (บาท)', type: 'number', step: '0.01' },
        { name: 'budget_adjust', label: 'เพิ่ม/ปรับงบ (กรณีเกินหรือเหลือ, ใส่ − ได้)', type: 'number', step: '0.01', hint: 'บวกเพิ่มเมื่อได้เงินเพิ่ม, ใส่เลขติดลบเมื่อถูกหักคืน' },
        { name: 'note', label: 'หมายเหตุ', type: 'textarea', col: 1 },
      ],
      values: p || { budget: 0, budget_adjust: 0 },
      onSubmit: async (v) => {
        if (p) { await Store.update('projects', p.id, v); }
        else { v.sort = (Store.data().projects.length + 1) * 10; v.active = true; await Store.insert('projects', v); }
        U.toast('บันทึกโครงการแล้ว'); await refresh();
      },
    });
  }

  function editActivity(project, a) {
    App.formModal({
      width: '620px',
      title: (a ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม') + ' — ' + project.name,
      fields: [
        { name: 'name', label: 'ชื่อกิจกรรมย่อย', required: true, col: 1 },
        { name: 'budget', label: 'งบประมาณย่อย (บาท)', type: 'number', step: '0.01' },
        { name: 'level', label: 'ระดับ', type: 'select',
          options: [{ value: '', label: '— ไม่ระบุ —' }].concat(['อนุบาล', 'ประถม', 'รวม', 'อื่นๆ'].map(x => ({ value: x, label: x }))) },
        { name: 'responsible', label: 'ผู้รับผิดชอบ' },
      ],
      values: a || { budget: 0 },
      onSubmit: async (v) => {
        if (a) { await Store.update('project_activities', a.id, v); }
        else {
          v.project_id = project.id;
          v.sort = (actsOf(project.id).length + 1) * 10;
          await Store.insert('project_activities', v);
        }
        U.toast('บันทึกกิจกรรมแล้ว'); await refresh();
      },
    });
  }

  // ---- CSV: ดาวน์โหลด (มี BOM ให้ Excel อ่านภาษาไทยได้) ----
  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadCSV(filename, aoa) {
    const BOM = String.fromCharCode(0xFEFF); // ให้ Excel เปิดไฟล์แล้วภาษาไทยไม่เพี้ยน
    const text = BOM + aoa.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function exportProjectsCSV() {
    const D = Store.data();
    if (!D.projects.length) { U.toast('ยังไม่มีโครงการให้ส่งออก', 'err'); return; }
    const rows = [PROJ_COLS.map(c => c.header)];
    D.projects.forEach(p => {
      const list = actsOf(p.id);
      if (!list.length) rows.push([p.name || '', Number(p.budget || 0), '', '', '', '']);
      else list.forEach(a => rows.push([p.name || '', Number(p.budget || 0), a.name || '', Number(a.budget || 0), a.level || '', a.responsible || '']));
    });
    downloadCSV('โครงการและกิจกรรม.csv', rows);
    U.toast('ส่งออก CSV แล้ว');
  }
  function downloadProjectTemplate() {
    downloadCSV('แม่แบบโครงการ.csv', [
      PROJ_COLS.map(c => c.header),
      ['อาหารกลางวัน', 200000, 'จัดซื้อวัตถุดิบ', 150000, 'รวม', 'ครูสมชาย'],
      ['อาหารกลางวัน', 200000, 'จ้างแม่ครัว', 50000, 'รวม', 'ครูสมหญิง'],
      ['เรียนฟรี 15 ปี', 80000, 'ค่าอุปกรณ์การเรียน', 80000, 'ประถม', 'ครูสมศรี'],
    ]);
    U.toast('ดาวน์โหลดไฟล์ตัวอย่างแล้ว');
  }

  // ---- นำเข้า CSV/Excel (1 แถว = 1 กิจกรรมย่อย, จับกลุ่มตามโครงการ) ----
  async function importProjectsFile(file) {
    if (!window.XLSX) { U.toast('ยังโหลดไลบรารีอ่านไฟล์ไม่สำเร็จ', 'err'); return; }
    let aoa;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: '' });
    } catch (e) { U.toast('อ่านไฟล์ไม่สำเร็จ: ' + (e.message || e), 'err'); return; }
    if (!aoa || aoa.length < 2) { U.toast('ไฟล์ว่าง หรือไม่มีข้อมูล', 'err'); return; }

    const headers = aoa[0].map(h => String(h || '').toLowerCase().trim());
    const idx = {};
    PROJ_COLS.forEach(col => { idx[col.key] = headers.findIndex(h => col.match.some(m => h.includes(m.toLowerCase()))); });
    if (idx.project < 0) { U.toast('ไม่พบคอลัมน์ "โครงการ" ในไฟล์', 'err'); return; }

    // จับกลุ่มแถวตามชื่อโครงการ (คงลำดับ)
    const order = [], groups = {};
    for (let r = 1; r < aoa.length; r++) {
      const g = k => idx[k] >= 0 ? aoa[r][idx[k]] : '';
      const pname = String(g('project') || '').trim();
      if (!pname) continue;
      if (!groups[pname]) { groups[pname] = { total: parseNum(g('total')), acts: [] }; order.push(pname); }
      else if (!groups[pname].total) { groups[pname].total = parseNum(g('total')); }
      const aname = String(g('activity') || '').trim();
      if (aname) groups[pname].acts.push({ name: aname, budget: parseNum(g('sub')), level: String(g('level') || '').trim() || null, responsible: String(g('responsible') || '').trim() || null });
    }
    if (!order.length) { U.toast('ไม่พบข้อมูลโครงการในไฟล์', 'err'); return; }

    const totalActs = order.reduce((s, n) => s + groups[n].acts.length, 0);
    App.confirmDialog(
      `พบ ${order.length} โครงการ และ ${totalActs} กิจกรรมย่อย — ยืนยันนำเข้า? (โครงการชื่อซ้ำจะใช้ของเดิม แล้วเพิ่มกิจกรรมที่ยังไม่มี)`,
      async () => {
        try {
          const D = Store.data();
          const byName = {};
          D.projects.forEach(p => byName[(p.name || '').trim()] = p);
          const toCreate = order.filter(n => !byName[n]).map((n, i) => ({ name: n, budget: groups[n].total, sort: (D.projects.length + i + 1) * 10, active: true }));
          let created = [];
          if (toCreate.length) created = await Store.insertMany('projects', toCreate);
          created.forEach(p => byName[(p.name || '').trim()] = p);

          const existActs = new Set((D.projectActivities || []).map(a => a.project_id + '|' + (a.name || '').trim()));
          const actRows = [];
          order.forEach(n => {
            const proj = byName[n]; if (!proj) return;
            groups[n].acts.forEach((a, i) => {
              const key = proj.id + '|' + a.name;
              if (existActs.has(key)) return;
              existActs.add(key);
              actRows.push(Object.assign({}, a, { project_id: proj.id, sort: (i + 1) * 10 }));
            });
          });
          if (actRows.length) await Store.insertMany('project_activities', actRows);
          U.toast(`นำเข้า ${created.length} โครงการใหม่ + ${actRows.length} กิจกรรม`); await refresh();
        } catch (e) { U.toast('นำเข้าไม่สำเร็จ: ' + (e.message || e), 'err'); }
      },
      { danger: false, yes: 'นำเข้า' }
    );
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
