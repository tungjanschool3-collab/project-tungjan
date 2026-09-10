// ============================================================
//  หน้า 1 — บันทึกการรับ–จ่ายเงินประจำวัน (แหล่งข้อมูลหลัก)
// ============================================================
(function () {
  const DOC_TYPES = [
    { v: 'บร', l: 'บร — รับเงิน' },
    { v: 'บจ', l: 'บจ — จ่ายเงิน' },
    { v: 'บค', l: 'บค — เบิกเงิน' },
    { v: 'บย', l: 'บย — ยืมเงิน' },
  ];
  const BAL_TYPES = [
    { v: 'bank', l: 'เงินฝากธนาคาร' },
    { v: 'cash', l: 'เงินสด' },
    { v: 'govdeposit', l: 'เงินฝากส่วนราชการ' },
  ];
  const CSV_HEADERS = [
    'วันที่', 'ประเภทเอกสาร', 'เลขที่เอกสาร', 'รายการ', 'รายจ่าย', 'รายรับ', 'บัญชี',
    'ที่เก็บเงิน', 'งวดที่', 'จ่ายลูกหนี้', 'จ่ายใบสำคัญ', 'เลขใบสั่งซื้อ', 'เลขใบสั่งจ้าง',
    'เลขบันทึกข้อความ', 'โครงการ', 'กิจกรรม', 'ระดับ', 'ไปราชการ', 'ล้างหนี้',
    'ครูผู้รับผิดชอบ', 'หมายเหตุ'
  ];
  let filterMonth = '';

  function txnsOfMonth(m) {
    return Store.txnsFY()
      .filter(t => !m || U.ymOf(t.txn_date) === m)
      .sort((a, b) => (a.txn_date < b.txn_date ? -1 : a.txn_date > b.txn_date ? 1 : (a.doc_no || 0) - (b.doc_no || 0)));
  }

  function render(c) {
    const D = Store.data();
    const months = App.monthOptions();
    if (!filterMonth) filterMonth = months[0] || U.ymOf(U.todayISO());

    // ----- toolbar -----
    const tools = U.el(`<div class="toolbar no-print">
      <div class="field"><label>เดือน</label><select id="mSel"></select></div>
      <div class="spacer"></div>
      <button class="btn primary" id="addBtn">+ เพิ่มรายการ</button>
      <button class="btn" id="importBtn">⬆️ นำเข้า CSV</button>
      <button class="btn ghost" id="templateBtn">📄 แม่แบบ CSV</button>
      <input type="file" id="csvFile" accept=".csv,text/csv" style="display:none">
      <button class="btn print" id="printBtn">🖨️ พิมพ์ (การรับ–จ่าย)</button>
      <button class="btn excel" id="xlsBtn">⬇️ Excel เดือนนี้</button>
      <button class="btn excel" id="csvBtn">⬇️ CSV ข้อมูลทั้งหมด</button>
    </div>`);
    const mSel = tools.querySelector('#mSel');
    months.forEach(m => mSel.appendChild(U.el(`<option value="${m}" ${m === filterMonth ? 'selected' : ''}>${U.thaiMonthYear(m)}</option>`)));
    mSel.onchange = () => { filterMonth = mSel.value; App.go('daily'); };
    tools.querySelector('#addBtn').onclick = () => openEditor(null);
    const csvFile = tools.querySelector('#csvFile');
    tools.querySelector('#importBtn').onclick = () => csvFile.click();
    csvFile.onchange = () => {
      if (csvFile.files[0]) importCSV(csvFile.files[0]);
      csvFile.value = '';
    };
    tools.querySelector('#templateBtn').onclick = downloadCSVTemplate;
    tools.querySelector('#printBtn').onclick = () => window.print();
    tools.querySelector('#xlsBtn').onclick = exportExcel;
    tools.querySelector('#csvBtn').onclick = exportAllCSV;
    c.appendChild(tools);

    const rows = txnsOfMonth(filterMonth);
    const totIn = rows.reduce((s, t) => s + Number(t.amount_in || 0), 0);
    const totOut = rows.reduce((s, t) => s + Number(t.amount_out || 0), 0);

    // ----- stats -----
    const stats = U.el(`<div class="grid c3 no-print" style="margin-bottom:16px">
      <div class="stat"><div class="lab">📥 รายรับรวมเดือนนี้</div><div class="val in">${U.money(totIn)}</div></div>
      <div class="stat"><div class="lab">📤 รายจ่ายรวมเดือนนี้</div><div class="val out">${U.money(totOut)}</div></div>
      <div class="stat"><div class="lab">🧮 จำนวนรายการ</div><div class="val bal">${rows.length}</div></div>
    </div>`);
    c.appendChild(stats);

    // ----- ตารางแก้ไข (บนจอ) -----
    const card = U.el('<div class="card no-print"><div class="table-wrap"></div></div>');
    const tw = card.querySelector('.table-wrap');
    const table = U.el(`<table class="data"><thead><tr>
      <th style="width:110px">วันเดือนปี</th><th style="width:70px">เอกสาร</th><th style="width:60px">เลขที่</th>
      <th>รายการ</th><th>บัญชี</th><th class="num">รายจ่าย</th><th class="num">รายรับ</th><th style="width:90px"></th>
    </tr></thead><tbody></tbody></table>`);
    const tb = table.querySelector('tbody');
    if (!rows.length) tb.appendChild(U.el('<tr><td colspan="8"><div class="empty">ยังไม่มีรายการในเดือนนี้ — กด “+ เพิ่มรายการ”</div></td></tr>'));

    let lastDate = null;
    rows.forEach(t => {
      const acc = Store.accountById(t.account_id);
      const showDate = t.txn_date !== lastDate; lastDate = t.txn_date;
      const tr = U.el(`<tr>
        <td>${showDate ? '<b>' + U.esc(U.thaiDate(t.txn_date)) + '</b>' : ''}</td>
        <td>${t.doc_type ? `<span class="pill doc doc-${t.doc_type}">${t.doc_type}</span>` : ''}</td>
        <td class="num">${t.doc_no ?? ''}</td>
        <td>${U.esc(t.description || '')}</td>
        <td>${acc ? U.esc(acc.name) : '<span style="color:#aaa">—</span>'}</td>
        <td class="num ${t.amount_out ? 'money-out' : ''}">${U.money0(t.amount_out)}</td>
        <td class="num ${t.amount_in ? 'money-in' : ''}">${U.money0(t.amount_in)}</td>
        <td><div class="row-actions"><button class="icon-btn">✏️</button><button class="icon-btn del">🗑️</button></div></td>
      </tr>`);
      tr.querySelectorAll('button')[0].onclick = () => openEditor(t);
      tr.querySelectorAll('button')[1].onclick = () => {
        App.confirmDialog(`ลบรายการ "${t.description || ''}" ?`, async () => {
          try { await Store.remove('transactions', t.id); U.toast('ลบแล้ว'); await reload(); }
          catch (e) { U.toast('ลบไม่สำเร็จ: ' + (e.message || e), 'err'); }
        });
      };
      tb.appendChild(tr);
    });
    // แถวรวม
    const foot = U.el(`<tr class="sum" style="font-weight:700;background:#f7f9fe">
      <td colspan="5" style="text-align:right">รวมทั้งสิ้น</td>
      <td class="num money-out">${U.money(totOut)}</td><td class="num money-in">${U.money(totIn)}</td><td></td></tr>`);
    tb.appendChild(foot);
    tw.appendChild(table);
    c.appendChild(card);

    // ----- แผ่นพิมพ์ (การรับ–จ่ายเงิน) -----
    c.appendChild(buildPrintSheet(rows, filterMonth));
  }

  async function reload() { await Store.loadAll(); App.go('daily'); }

  // ---------------- ตัวแก้ไขรายการ (โมดัลแบบมีหมวด) ----------------
  function openEditor(t) {
    const D = Store.data();
    const isNew = !t;
    const v = Object.assign({
      txn_date: U.todayISO(), doc_type: 'บจ', doc_no: Store.nextDocNo(), description: '',
      amount_in: 0, amount_out: 0, account_id: '', bal_type: 'bank', round_no: '',
      pay_debtor: 0, pay_voucher: 0, po_no: '', hire_no: '', memo_no: '', project: '',
      level: '', travel: false, clear_status: '', teacher_id: '', notes: '',
    }, t || {});

    const accOpts = [{ value: '', label: '— เลือกบัญชี —' }].concat(D.accounts.filter(a => a.active !== false).map(a => ({ value: a.id, label: a.name })));
    const teacherOpts = [{ value: '', label: '— ไม่ระบุ —' }].concat(D.teachers.map(x => ({ value: x.id, label: x.name })));
    const activityPrefix = '[กิจกรรม] ';
    const noteLines = String(v.notes || '').split('\n');
    const existingActivity = noteLines.find(x => x.startsWith(activityPrefix))?.slice(activityPrefix.length) || '';
    const cleanNotes = noteLines.filter(x => !x.startsWith(activityPrefix)).join('\n');

    const body = U.el('<div></div>');
    body.innerHTML = `
      <div class="card" style="box-shadow:none;border:1px solid var(--line);margin-bottom:14px">
        <h4 style="margin-bottom:10px">ข้อมูลหลัก</h4>
        <div class="grid c3">
          <div class="field"><label>วันที่ *</label><input id="f_date" type="date" value="${U.esc(v.txn_date)}"></div>
          <div class="field"><label>ประเภทเอกสาร</label><select id="f_doctype"></select></div>
          <div class="field"><label>เลขที่เอกสาร</label><input id="f_docno" type="number" value="${v.doc_no ?? ''}"></div>
        </div>
        <div class="grid c2" style="margin-top:10px">
          <div class="field" style="grid-column:span 2"><label>รายการ *</label><input id="f_desc" value="${U.esc(v.description)}"></div>
          <div class="field"><label>โครงการ</label><select id="f_proj"><option value="">— เลือกโครงการ —</option></select></div>
          <div class="field"><label>กิจกรรม</label><select id="f_activity"><option value="">— เลือกกิจกรรมต่อ —</option></select></div>
          <div class="field"><label>บัญชี</label><select id="f_acc"></select></div>
          <div class="field"><label>ที่เก็บเงิน (คงเหลือช่อง)</label><select id="f_bal"></select></div>
          <div class="field"><label>รายรับ</label><input id="f_in" type="number" step="0.01" value="${v.amount_in || 0}"></div>
          <div class="field"><label>รายจ่าย</label><input id="f_out" type="number" step="0.01" value="${v.amount_out || 0}"></div>
          <div class="field"><label>งวดที่ (เงินอุดหนุน)</label><input id="f_round" type="number" min="1" value="${v.round_no ?? ''}" placeholder="เช่น 1, 2 (ถ้าเป็นเงินอุดหนุน)"></div>
        </div>
      </div>

      <details class="card" style="box-shadow:none;border:1px solid var(--line);margin-bottom:14px" ${(v.pay_debtor||v.pay_voucher)?'open':''}>
        <summary style="cursor:pointer;font-weight:700">ทะเบียนเงินนอกงบประมาณ (แยกช่องจ่าย) — ไม่บังคับ</summary>
        <div class="grid c2" style="margin-top:10px">
          <div class="field"><label>จ่าย: ลูกหนี้</label><input id="f_paydebt" type="number" step="0.01" value="${v.pay_debtor||0}"></div>
          <div class="field"><label>จ่าย: ใบสำคัญ</label><input id="f_payvou" type="number" step="0.01" value="${v.pay_voucher||0}"></div>
        </div>
        <div class="hint" style="margin-top:6px">ถ้าไม่กรอก ระบบจะถือว่ายอด "รายจ่าย" เป็นใบสำคัญทั้งหมด</div>
      </details>

      <details class="card" style="box-shadow:none;border:1px solid var(--line)" ${(v.po_no||v.hire_no||v.project||v.travel)?'open':''}>
        <summary style="cursor:pointer;font-weight:700">ใบสั่งซื้อ/สั่งจ้าง/ไปราชการ — ไม่บังคับ</summary>
        <div class="grid c3" style="margin-top:10px">
          <div class="field"><label>เลขใบสั่งซื้อ</label><input id="f_po" value="${U.esc(v.po_no||'')}"></div>
          <div class="field"><label>เลขใบสั่งจ้าง</label><input id="f_hire" value="${U.esc(v.hire_no||'')}"></div>
          <div class="field"><label>เลขบันทึกข้อความ</label><input id="f_memo" value="${U.esc(v.memo_no||'')}"></div>
          <div class="field"><label>ระดับ</label><input id="f_level" value="${U.esc(v.level||'')}" placeholder="อนุบาล/ประถม"></div>
          <div class="field"><label>ล้างหนี้</label><select id="f_clear"></select></div>
          <div class="field"><label>ครูที่รับผิดชอบ</label><select id="f_teacher"></select></div>
          <div class="field" style="display:flex;flex-direction:row;align-items:center;gap:8px;margin-top:22px"><input id="f_travel" type="checkbox" style="width:20px;height:20px" ${v.travel?'checked':''}><label style="margin:0">เป็นรายการไปราชการ</label></div>
        </div>
        <div class="field" style="margin-top:10px"><label>หมายเหตุ</label><input id="f_notes" value="${U.esc(cleanNotes)}"></div>
      </details>`;

    // เติม select
    const sel = (id, opts, val) => { const s = body.querySelector(id); opts.forEach(o => s.appendChild(U.el(`<option value="${U.esc(o.value ?? o.v)}" ${String(o.value ?? o.v) === String(val) ? 'selected' : ''}>${U.esc(o.label ?? o.l)}</option>`))); return s; };
    sel('#f_doctype', DOC_TYPES.map(d => ({ value: d.v, label: d.l })), v.doc_type);
    sel('#f_acc', accOpts, v.account_id);
    sel('#f_bal', BAL_TYPES.map(b => ({ value: b.v, label: b.l })), v.bal_type);
    sel('#f_clear', [{ value: '', label: '—' }, { value: 'cleared', label: 'เช็คล้างหนี้' }, { value: 'none', label: 'ไม่ทำ' }], v.clear_status || '');
    sel('#f_teacher', teacherOpts, v.teacher_id);

    // เลือกโครงการและกรองกิจกรรมตามโครงการ
    const projectSel = body.querySelector('#f_proj');
    D.projects.filter(p => p.active !== false).forEach(p => projectSel.appendChild(U.el(`<option value="${U.esc(p.id)}" ${p.id === v.project_id ? 'selected' : ''}>${U.esc(p.name)}</option>`)));
    const activitySel = body.querySelector('#f_activity');
    const updateActivities = () => {
      const p = Store.projectById(projectSel.value);
      const names = (D.projectActivities || []).filter(a => a.project_id === projectSel.value).map(a => a.name);
      if (p && String(p.note || '').startsWith('[PROJECT_REPORT]')) { try { const n = JSON.parse(String(p.note).slice(16)).activity; if (n) names.push(n); } catch (e) {} }
      activitySel.innerHTML = '<option value="">— เลือกกิจกรรมต่อ —</option>';
      [...new Set(names.filter(Boolean))].forEach(name => activitySel.appendChild(U.el(`<option value="${U.esc(name)}" ${name === existingActivity ? 'selected' : ''}>${U.esc(name)}</option>`)));
    };
    projectSel.onchange = updateActivities; updateActivities();

    const foot = U.el('<div class="btn-row"></div>');
    const cancel = U.el('<button class="btn ghost">ยกเลิก</button>');
    const saveNext = isNew ? U.el('<button class="btn">＋ เพิ่มรายการ</button>') : null;
    const save = U.el('<button class="btn primary">💾 บันทึกและเสร็จ</button>');
    cancel.onclick = App.closeModal;
    const saveEntry = async keepOpen => {
      const g = id => body.querySelector(id);
      const selectedProject = Store.projectById(g('#f_proj').value);
      const activityName = g('#f_activity').value;
      const payload = {
        txn_date: g('#f_date').value, doc_type: g('#f_doctype').value || null,
        doc_no: g('#f_docno').value === '' ? null : Number(g('#f_docno').value),
        description: g('#f_desc').value.trim(),
        account_id: g('#f_acc').value || null, bal_type: g('#f_bal').value,
        amount_in: Number(g('#f_in').value || 0), amount_out: Number(g('#f_out').value || 0),
        round_no: g('#f_round').value === '' ? null : Number(g('#f_round').value),
        pay_debtor: Number(g('#f_paydebt').value || 0), pay_voucher: Number(g('#f_payvou').value || 0),
        po_no: g('#f_po').value.trim() || null, hire_no: g('#f_hire').value.trim() || null,
        memo_no: g('#f_memo').value.trim() || null, project: selectedProject ? selectedProject.name : null,
        project_id: selectedProject ? selectedProject.id : null,
        level: g('#f_level').value.trim() || null, travel: g('#f_travel').checked,
        clear_status: g('#f_clear').value || null, teacher_id: g('#f_teacher').value || null,
        notes: ((activityName ? activityPrefix + activityName + '\n' : '') + g('#f_notes').value.trim()).trim() || null,
      };
      if (!payload.txn_date) { U.toast('กรุณาเลือกวันที่', 'err'); return; }
      if (!payload.description) { U.toast('กรุณากรอกรายการ', 'err'); return; }
      save.disabled = true;
      if (saveNext) saveNext.disabled = true;
      (keepOpen && saveNext ? saveNext : save).textContent = 'กำลังบันทึก...';
      try {
        if (isNew) await Store.insert('transactions', payload);
        else await Store.update('transactions', t.id, payload);
        if (keepOpen && isNew) {
          // โหลดข้อมูลล่าสุดทันที เพื่อให้ทะเบียน บค./บจ./บย./บร. ใบสั่งซื้อ/สั่งจ้าง และเงินนอกงบประมาณซิงค์กัน
          await Store.loadAll();
          U.toast('บันทึกและซิงค์ทุกทะเบียนแล้ว — เพิ่มรายการถัดไปได้ทันที');
          g('#f_docno').value = payload.doc_no == null ? '' : Number(payload.doc_no) + 1;
          g('#f_desc').value = '';
          ['#f_in','#f_out','#f_paydebt','#f_payvou'].forEach(id => { g(id).value = 0; });
          ['#f_round','#f_po','#f_hire','#f_memo','#f_proj','#f_activity','#f_level','#f_notes'].forEach(id => { g(id).value = ''; });
          updateActivities();
          g('#f_clear').value = ''; g('#f_teacher').value = ''; g('#f_travel').checked = false;
          save.disabled = false; save.textContent = '💾 บันทึกและเสร็จ';
          saveNext.disabled = false; saveNext.textContent = '＋ เพิ่มรายการ';
          g('#f_desc').focus();
          return;
        }
        U.toast('บันทึกรายการแล้ว'); App.closeModal();
        filterMonth = U.ymOf(payload.txn_date); await reload();
      } catch (e) {
        console.error(e); U.toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'err');
        save.disabled = false; save.textContent = '💾 บันทึกและเสร็จ';
        if (saveNext) { saveNext.disabled = false; saveNext.textContent = '＋ เพิ่มรายการ'; }
      }
    };
    if (saveNext) saveNext.onclick = () => saveEntry(true);
    save.onclick = () => saveEntry(false);
    foot.append(cancel);
    if (saveNext) foot.append(saveNext);
    foot.append(save);
    App.openModal(isNew ? 'เพิ่มรายการรับ–จ่าย' : 'แก้ไขรายการ', body, foot, { width: '760px' });
  }

  // ---------------- แผ่นพิมพ์ การรับ–จ่ายเงิน ----------------
  function buildPrintSheet(rows, m) {
    const s = Store.data().school || {};
    const sheet = U.el('<div class="print-only sheet daily-print-sheet"></div>');
    sheet.appendChild(U.el(`<div class="doc-head">
      <div class="fy">ปีงบประมาณ ${Store.getFY()}</div><img class="doc-logo" src="assets/logo.png" alt="">
      <div class="t1">การรับ – จ่ายเงิน</div>
      <div class="t2">${U.esc(s.name || '')} ${U.esc(s.district || '')} จังหวัด${U.esc(s.province || '')}</div>
      <div class="t3">ประจำเดือน ${U.thaiMonthYear(m)}</div>
    </div>`));
    const table = U.el(`<table class="reg"><thead><tr>
      <th style="width:12%">วัน เดือน ปี</th><th style="width:6%">ที่</th><th>รายการ</th>
      <th style="width:13%">รายจ่าย</th><th style="width:13%">รายรับ</th><th style="width:16%">บัญชี</th>
    </tr></thead><tbody></tbody></table>`);
    const tb = table.querySelector('tbody');
    let last = null, i = 0, tIn = 0, tOut = 0;
    rows.forEach(t => {
      const acc = Store.accountById(t.account_id);
      const showDate = t.txn_date !== last; last = t.txn_date; i++;
      tIn += Number(t.amount_in || 0); tOut += Number(t.amount_out || 0);
      tb.appendChild(U.el(`<tr>
        <td class="c">${showDate ? U.esc(U.thaiDate(t.txn_date)) : ''}</td>
        <td class="c">${i}</td>
        <td>${U.esc(t.description || '')}</td>
        <td class="num">${U.money0(t.amount_out)}</td>
        <td class="num">${U.money0(t.amount_in)}</td>
        <td class="c">${acc ? U.esc(acc.name) : ''}</td></tr>`));
    });
    tb.appendChild(U.el(`<tr class="sum"><td colspan="3" class="c">รวมทั้งสิ้น</td>
      <td class="num">${U.money(tOut)}</td><td class="num">${U.money(tIn)}</td><td></td></tr>`));
    sheet.appendChild(table);
    sheet.appendChild(signRow(s));
    return sheet;
  }

  function exportExcel() {
    const rows = txnsOfMonth(filterMonth);
    const s = Store.data().school || {};
    const aoa = [
      [`การรับ – จ่ายเงิน  ${s.name || ''}  ปีงบประมาณ ${Store.getFY()}`],
      [`ประจำเดือน ${U.thaiMonthYear(filterMonth)}`],
      [],
      ['วัน เดือน ปี', 'ที่', 'ประเภท', 'เลขที่', 'รายการ', 'รายจ่าย', 'รายรับ', 'บัญชี'],
    ];
    let i = 0, last = null, tIn = 0, tOut = 0;
    rows.forEach(t => {
      const acc = Store.accountById(t.account_id); i++;
      const showDate = t.txn_date !== last; last = t.txn_date;
      tIn += Number(t.amount_in || 0); tOut += Number(t.amount_out || 0);
      aoa.push([showDate ? U.thaiDate(t.txn_date) : '', i, t.doc_type || '', t.doc_no || '',
        t.description || '', Number(t.amount_out || 0), Number(t.amount_in || 0), acc ? acc.name : '']);
    });
    aoa.push(['', '', '', '', 'รวมทั้งสิ้น', tOut, tIn, '']);
    Exporter.download(
      `การรับจ่าย_${filterMonth}.xlsx`, U.thaiMonthYear(filterMonth), aoa,
      { cols: [14, 5, 8, 8, 40, 13, 13, 18], numCols: [5, 6], merges: ['A1:H1', 'A2:H2'] }
    );
  }

  // ---------------- CSV: นำเข้าหลายวัน / ส่งออกประวัติทั้งหมด ----------------
  function csvCell(value) {
    const s = String(value == null ? '' : value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadCSV(filename, rows) {
    const text = String.fromCharCode(0xFEFF) + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadCSVTemplate() {
    downloadCSV('แม่แบบรายรับรายจ่าย.csv', [CSV_HEADERS, [
      U.todayISO(), 'บจ', Store.nextDocNo(), 'ตัวอย่างรายการ', 1000, 0,
      (Store.data().accounts[0] || {}).name || '', 'เงินฝากธนาคาร', '', 0, 1000,
      '', '', '', '', '', '', 'ไม่', '', '', ''
    ]]);
    U.toast('ดาวน์โหลดแม่แบบ CSV แล้ว');
  }

  function exportAllCSV() {
    const D = Store.data();
    const rows = [...D.transactions].sort((a, b) =>
      String(a.txn_date).localeCompare(String(b.txn_date)) || Number(a.doc_no || 0) - Number(b.doc_no || 0)
    );
    const values = rows.map(t => {
      const acc = Store.accountById(t.account_id);
      const teacher = Store.teacherById(t.teacher_id);
      const project = Store.projectById(t.project_id);
      const notes = String(t.notes || '').split('\n');
      const activity = notes.find(x => x.startsWith('[กิจกรรม] '))?.slice(10) || '';
      const cleanNotes = notes.filter(x => !x.startsWith('[กิจกรรม] ')).join('\n');
      return [
        t.txn_date || '', t.doc_type || '', t.doc_no ?? '', t.description || '',
        Number(t.amount_out || 0), Number(t.amount_in || 0), acc ? acc.name : '',
        BAL_TYPES.find(x => x.v === t.bal_type)?.l || t.bal_type || '', t.round_no ?? '',
        Number(t.pay_debtor || 0), Number(t.pay_voucher || 0), t.po_no || '', t.hire_no || '',
        t.memo_no || '', project ? project.name : (t.project || ''), activity, t.level || '',
        t.travel ? 'ใช่' : 'ไม่', t.clear_status === 'cleared' ? 'เช็คล้างหนี้' : (t.clear_status === 'none' ? 'ไม่ทำ' : ''),
        teacher ? teacher.name : '', cleanNotes
      ];
    });
    downloadCSV(`รายรับรายจ่าย_ข้อมูลทั้งหมด_${U.todayISO()}.csv`, [CSV_HEADERS, ...values]);
    U.toast(`ส่งออกข้อมูลย้อนหลังทั้งหมด ${rows.length} รายการแล้ว`);
  }

  const norm = value => String(value == null ? '' : value).trim().toLowerCase().replace(/[\s_.\-–—/()]+/g, '');
  const num = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const n = Number(String(value == null ? '' : value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  };
  const yes = value => ['1', 'true', 'yes', 'y', 'ใช่', 'มี'].includes(norm(value));

  function isoDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    if (typeof value === 'number' && window.XLSX?.SSF) {
      const d = XLSX.SSF.parse_date_code(value);
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const s = String(value == null ? '' : value).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      let y = Number(m[1]); if (y > 2400) y -= 543;
      return `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) {
      let y = Number(m[3]); if (y > 2400) y -= 543;
      return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    return '';
  }

  function transactionKey(t) {
    return [t.txn_date, t.doc_type || '', t.doc_no ?? '', norm(t.description), num(t.amount_out), num(t.amount_in), t.account_id || ''].join('|');
  }

  async function importCSV(file) {
    if (!window.XLSX) { U.toast('ยังโหลดตัวอ่านไฟล์ไม่สำเร็จ', 'err'); return; }
    let data;
    try {
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
      data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: '' });
    } catch (e) { U.toast('อ่านไฟล์ CSV ไม่สำเร็จ: ' + (e.message || e), 'err'); return; }
    if (!data || data.length < 2) { U.toast('ไฟล์ CSV ไม่มีข้อมูล', 'err'); return; }

    const aliases = {
      date: ['วันที่', 'วันเดือนปี', 'date', 'txndate'], type: ['ประเภทเอกสาร', 'ประเภท', 'doctype'],
      no: ['เลขที่เอกสาร', 'เลขที่', 'docno'], desc: ['รายการ', 'รายละเอียด', 'description'],
      out: ['รายจ่าย', 'amountout'], in: ['รายรับ', 'amountin'], account: ['บัญชี', 'account'],
      bal: ['ที่เก็บเงิน', 'ช่องคงเหลือ', 'baltype'], round: ['งวดที่', 'roundno'],
      debtor: ['จ่ายลูกหนี้', 'paydebtor'], voucher: ['จ่ายใบสำคัญ', 'payvoucher'],
      po: ['เลขใบสั่งซื้อ', 'ใบสั่งซื้อ', 'pono'], hire: ['เลขใบสั่งจ้าง', 'ใบสั่งจ้าง', 'hireno'],
      memo: ['เลขบันทึกข้อความ', 'เลขบันทึก', 'memono'], project: ['โครงการ', 'project'],
      activity: ['กิจกรรม', 'activity'], level: ['ระดับ', 'level'], travel: ['ไปราชการ', 'travel'],
      clear: ['ล้างหนี้', 'clearstatus'], teacher: ['ครูผู้รับผิดชอบ', 'ผู้รับผิดชอบ', 'teacher'],
      notes: ['หมายเหตุ', 'notes']
    };
    const headers = data[0].map(norm), idx = {};
    Object.entries(aliases).forEach(([key, names]) => { idx[key] = headers.findIndex(h => names.map(norm).includes(h)); });
    if (idx.date < 0 || idx.desc < 0) { U.toast('ต้องมีคอลัมน์ “วันที่” และ “รายการ”', 'err'); return; }

    const D = Store.data(), get = (row, key) => idx[key] >= 0 ? row[idx[key]] : '';
    const accountMap = new Map(), teacherMap = new Map(), projectMap = new Map();
    D.accounts.forEach(x => { accountMap.set(norm(x.name), x); if (x.code) accountMap.set(norm(x.code), x); });
    D.teachers.forEach(x => teacherMap.set(norm(x.name), x));
    D.projects.forEach(x => projectMap.set(norm(x.name), x));
    const existing = new Set(D.transactions.map(transactionKey)), pending = new Set();
    const rows = []; let invalid = 0, duplicate = 0;
    data.slice(1).forEach(source => {
      const date = isoDate(get(source, 'date')), description = String(get(source, 'desc') || '').trim();
      if (!date || !description) { invalid++; return; }
      const account = accountMap.get(norm(get(source, 'account'))), teacher = teacherMap.get(norm(get(source, 'teacher'))), project = projectMap.get(norm(get(source, 'project')));
      const balText = norm(get(source, 'bal'));
      const bal = BAL_TYPES.find(x => norm(x.v) === balText || norm(x.l) === balText)?.v || 'bank';
      const clearText = norm(get(source, 'clear'));
      const activity = String(get(source, 'activity') || '').trim(), notes = String(get(source, 'notes') || '').trim();
      const row = {
        txn_date: date, doc_type: String(get(source, 'type') || '').trim() || null,
        doc_no: get(source, 'no') === '' ? null : Math.trunc(num(get(source, 'no'))), description,
        amount_out: num(get(source, 'out')), amount_in: num(get(source, 'in')),
        account_id: account?.id || null, bal_type: bal,
        round_no: get(source, 'round') === '' ? null : Math.trunc(num(get(source, 'round'))),
        pay_debtor: num(get(source, 'debtor')), pay_voucher: num(get(source, 'voucher')),
        po_no: String(get(source, 'po') || '').trim() || null, hire_no: String(get(source, 'hire') || '').trim() || null,
        memo_no: String(get(source, 'memo') || '').trim() || null,
        project: project?.name || String(get(source, 'project') || '').trim() || null, project_id: project?.id || null,
        level: String(get(source, 'level') || '').trim() || null, travel: yes(get(source, 'travel')),
        clear_status: clearText === norm('เช็คล้างหนี้') || clearText === 'cleared' ? 'cleared' : (clearText === norm('ไม่ทำ') || clearText === 'none' ? 'none' : null),
        teacher_id: teacher?.id || null,
        notes: ((activity ? '[กิจกรรม] ' + activity + '\n' : '') + notes).trim() || null
      };
      const key = transactionKey(row);
      if (existing.has(key) || pending.has(key)) { duplicate++; return; }
      pending.add(key); rows.push(row);
    });
    if (!rows.length) { U.toast(`ไม่มีรายการใหม่ให้นำเข้า (ซ้ำ ${duplicate}, ไม่สมบูรณ์ ${invalid})`, 'err'); return; }

    App.confirmDialog(
      `พบรายการใหม่ ${rows.length} รายการ จากหลายวัน${duplicate ? ` · ข้ามรายการซ้ำ ${duplicate}` : ''}${invalid ? ` · ข้ามแถวไม่สมบูรณ์ ${invalid}` : ''}\n\nข้อมูลเดิมในระบบจะไม่ถูกลบหรือเขียนทับ ยืนยันนำเข้า?`,
      async () => {
        try {
          for (let i = 0; i < rows.length; i += 200) await Store.insertMany('transactions', rows.slice(i, i + 200));
          await Store.loadAll();
          filterMonth = U.ymOf(rows[rows.length - 1].txn_date);
          U.toast(`นำเข้าสำเร็จ ${rows.length} รายการ · ข้อมูลเดิมยังอยู่ครบ`);
          App.go('daily');
        } catch (e) { U.toast('นำเข้าไม่สำเร็จ: ' + (e.message || e), 'err'); }
      }, { danger: false, yes: 'นำเข้า' }
    );
  }

  function signRow(s) {
    return U.el(`<div class="sign-row">
      <div class="s">ลงชื่อ................................ เจ้าหน้าที่การเงิน<br>(${U.esc(s.finance_officer || '')})</div>
      <div class="s">ลงชื่อ................................ ผู้ตรวจสอบ<br>(${U.esc(s.auditor || '')})</div>
      <div class="s">ลงชื่อ................................ ผู้อำนวยการ<br>(${U.esc(s.director || '')})</div>
    </div>`);
  }

  // เปิดให้หน้าอื่นเรียกใช้ตัวแก้ไข
  window.TxnEditor = { open: openEditor, signRow };

  App.register('daily', {
    title: 'บันทึกรับ–จ่าย (หน้า 1)',
    subtitle: 'บันทึกการรับ–จ่ายเงินประจำวัน — ข้อมูลนี้จะไหลไปทุกทะเบียนคุมอัตโนมัติ',
    render,
  });
})();
