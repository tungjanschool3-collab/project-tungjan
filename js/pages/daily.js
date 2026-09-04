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
      <button class="btn print" id="printBtn">🖨️ พิมพ์ (การรับ–จ่าย)</button>
      <button class="btn excel" id="xlsBtn">⬇️ Excel เดือนนี้</button>
    </div>`);
    const mSel = tools.querySelector('#mSel');
    months.forEach(m => mSel.appendChild(U.el(`<option value="${m}" ${m === filterMonth ? 'selected' : ''}>${U.thaiMonthYear(m)}</option>`)));
    mSel.onchange = () => { filterMonth = mSel.value; App.go('daily'); };
    tools.querySelector('#addBtn').onclick = () => openEditor(null);
    tools.querySelector('#printBtn').onclick = () => window.print();
    tools.querySelector('#xlsBtn').onclick = exportExcel;
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
      amount_in: 0, amount_out: 0, account_id: '', bal_type: 'bank',
      pay_debtor: 0, pay_voucher: 0, po_no: '', hire_no: '', memo_no: '', project: '',
      level: '', travel: false, clear_status: '', teacher_id: '', notes: '',
    }, t || {});

    const accOpts = [{ value: '', label: '— เลือกบัญชี —' }].concat(D.accounts.filter(a => a.active !== false).map(a => ({ value: a.id, label: a.name })));
    const teacherOpts = [{ value: '', label: '— ไม่ระบุ —' }].concat(D.teachers.map(x => ({ value: x.id, label: x.name })));

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
          <div class="field"><label>บัญชี</label><select id="f_acc"></select></div>
          <div class="field"><label>ที่เก็บเงิน (คงเหลือช่อง)</label><select id="f_bal"></select></div>
          <div class="field"><label>รายรับ</label><input id="f_in" type="number" step="0.01" value="${v.amount_in || 0}"></div>
          <div class="field"><label>รายจ่าย</label><input id="f_out" type="number" step="0.01" value="${v.amount_out || 0}"></div>
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
        <summary style="cursor:pointer;font-weight:700">ใบสั่งซื้อ/สั่งจ้าง/ไปราชการ & โครงการ — ไม่บังคับ</summary>
        <div class="grid c3" style="margin-top:10px">
          <div class="field"><label>เลขใบสั่งซื้อ</label><input id="f_po" value="${U.esc(v.po_no||'')}"></div>
          <div class="field"><label>เลขใบสั่งจ้าง</label><input id="f_hire" value="${U.esc(v.hire_no||'')}"></div>
          <div class="field"><label>เลขบันทึกข้อความ</label><input id="f_memo" value="${U.esc(v.memo_no||'')}"></div>
          <div class="field" style="grid-column:span 2"><label>โครงการ</label><input id="f_proj" list="projOptions" value="${U.esc(v.project||'')}" placeholder="พิมพ์ หรือเลือกจากรายการโครงการ"><datalist id="projOptions"></datalist></div>
          <div class="field"><label>ระดับ</label><input id="f_level" value="${U.esc(v.level||'')}" placeholder="อนุบาล/ประถม"></div>
          <div class="field"><label>ล้างหนี้</label><select id="f_clear"></select></div>
          <div class="field"><label>ครูที่รับผิดชอบ</label><select id="f_teacher"></select></div>
          <div class="field" style="display:flex;flex-direction:row;align-items:center;gap:8px;margin-top:22px"><input id="f_travel" type="checkbox" style="width:20px;height:20px" ${v.travel?'checked':''}><label style="margin:0">เป็นรายการไปราชการ</label></div>
        </div>
        <div class="field" style="margin-top:10px"><label>หมายเหตุ</label><input id="f_notes" value="${U.esc(v.notes||'')}"></div>
      </details>`;

    // เติม select
    const sel = (id, opts, val) => { const s = body.querySelector(id); opts.forEach(o => s.appendChild(U.el(`<option value="${U.esc(o.value ?? o.v)}" ${String(o.value ?? o.v) === String(val) ? 'selected' : ''}>${U.esc(o.label ?? o.l)}</option>`))); return s; };
    sel('#f_doctype', DOC_TYPES.map(d => ({ value: d.v, label: d.l })), v.doc_type);
    sel('#f_acc', accOpts, v.account_id);
    sel('#f_bal', BAL_TYPES.map(b => ({ value: b.v, label: b.l })), v.bal_type);
    sel('#f_clear', [{ value: '', label: '—' }, { value: 'cleared', label: 'เช็คล้างหนี้' }, { value: 'none', label: 'ไม่ทำ' }], v.clear_status || '');
    sel('#f_teacher', teacherOpts, v.teacher_id);

    // เติมรายการโครงการให้ช่อง datalist (เลือกได้ หรือพิมพ์เอง)
    const projDL = body.querySelector('#projOptions');
    D.projects.forEach(p => projDL.appendChild(U.el(`<option value="${U.esc(p.name)}"></option>`)));

    const foot = U.el('<div class="btn-row"></div>');
    const cancel = U.el('<button class="btn ghost">ยกเลิก</button>');
    const save = U.el('<button class="btn primary">💾 บันทึกรายการ</button>');
    cancel.onclick = App.closeModal;
    save.onclick = async () => {
      const g = id => body.querySelector(id);
      const payload = {
        txn_date: g('#f_date').value, doc_type: g('#f_doctype').value || null,
        doc_no: g('#f_docno').value === '' ? null : Number(g('#f_docno').value),
        description: g('#f_desc').value.trim(),
        account_id: g('#f_acc').value || null, bal_type: g('#f_bal').value,
        amount_in: Number(g('#f_in').value || 0), amount_out: Number(g('#f_out').value || 0),
        pay_debtor: Number(g('#f_paydebt').value || 0), pay_voucher: Number(g('#f_payvou').value || 0),
        po_no: g('#f_po').value.trim() || null, hire_no: g('#f_hire').value.trim() || null,
        memo_no: g('#f_memo').value.trim() || null, project: g('#f_proj').value.trim() || null,
        project_id: (Store.projectByName(g('#f_proj').value.trim()) || {}).id || null,
        level: g('#f_level').value.trim() || null, travel: g('#f_travel').checked,
        clear_status: g('#f_clear').value || null, teacher_id: g('#f_teacher').value || null,
        notes: g('#f_notes').value.trim() || null,
      };
      if (!payload.txn_date) { U.toast('กรุณาเลือกวันที่', 'err'); return; }
      if (!payload.description) { U.toast('กรุณากรอกรายการ', 'err'); return; }
      save.disabled = true; save.textContent = 'กำลังบันทึก...';
      try {
        if (isNew) await Store.insert('transactions', payload);
        else await Store.update('transactions', t.id, payload);
        U.toast('บันทึกรายการแล้ว'); App.closeModal();
        filterMonth = U.ymOf(payload.txn_date); await reload();
      } catch (e) { console.error(e); U.toast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'err'); save.disabled = false; save.textContent = '💾 บันทึกรายการ'; }
    };
    foot.append(cancel, save);
    App.openModal(isNew ? 'เพิ่มรายการรับ–จ่าย' : 'แก้ไขรายการ', body, foot, { width: '760px' });
  }

  // ---------------- แผ่นพิมพ์ การรับ–จ่ายเงิน ----------------
  function buildPrintSheet(rows, m) {
    const s = Store.data().school || {};
    const sheet = U.el('<div class="print-only sheet"></div>');
    sheet.appendChild(U.el(`<div class="doc-head">
      <div class="fy">ปีงบประมาณ ${Store.getFY()}</div>
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
