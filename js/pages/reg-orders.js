// ============================================================
//  ทะเบียนคุม ใบสั่งซื้อ / สั่งจ้าง / ไปราชการ และอื่นๆ
// ============================================================
(function () {
  let filterMonth = '';
  const isOrder = t => t.po_no || t.hire_no || t.travel || t.project || t.memo_no;

  function rowsOf(m) {
    return Store.txnsFY()
      .filter(t => isOrder(t) && (!m || U.ymOf(t.txn_date) === m))
      .sort((a, b) => (a.txn_date < b.txn_date ? -1 : a.txn_date > b.txn_date ? 1 : (a.doc_no || 0) - (b.doc_no || 0)));
  }
  const clearTxt = s => s === 'cleared' ? '✔ เช็คล้างหนี้' : s === 'none' ? 'ไม่ทำ' : '';

  function render(c) {
    const months = App.monthOptions();
    if (!filterMonth) filterMonth = months[0] || U.ymOf(U.todayISO());
    const s = Store.data().school || {};

    const tools = U.el(`<div class="toolbar no-print">
      <div class="field"><label>เดือน</label><select id="mSel"></select></div>
      <div class="spacer"></div>
      <button class="btn print" id="printBtn">🖨️ พิมพ์ A4</button>
      <button class="btn excel" id="xlsBtn">⬇️ Excel เดือนนี้</button>
      <button class="btn excel" id="xlsAllBtn">⬇️ Excel ทั้งปี</button>
    </div>`);
    const mSel = tools.querySelector('#mSel');
    months.forEach(m => mSel.appendChild(U.el(`<option value="${m}" ${m === filterMonth ? 'selected' : ''}>${U.thaiMonthYear(m)}</option>`)));
    mSel.onchange = () => { filterMonth = mSel.value; App.go('reg-orders'); };
    tools.querySelector('#printBtn').onclick = () => window.print();
    tools.querySelector('#xlsBtn').onclick = () => exportMonth(filterMonth);
    tools.querySelector('#xlsAllBtn').onclick = exportAll;
    c.appendChild(tools);

    c.appendChild(buildSheet(rowsOf(filterMonth), filterMonth, s));
  }

  function buildSheet(rows, m, s) {
    const wrap = U.el('<div class="card"><div class="sheet"></div></div>');
    const sheet = wrap.querySelector('.sheet');
    sheet.appendChild(U.el(`<div class="doc-head">
      <div class="fy">ปีงบประมาณ ${Store.getFY()}</div><img class="doc-logo" src="assets/logo.png" alt="">
      <div class="t1">ทะเบียนคุม ใบสั่งซื้อ / สั่งจ้าง / ไปราชการ</div>
      <div class="t2">${U.esc(s.name || '')} ${U.esc(s.district || '')} จังหวัด${U.esc(s.province || '')}</div>
      <div class="t3">ประจำเดือน ${U.thaiMonthYear(m)}</div>
    </div>`));
    const table = U.el(`<table class="reg"><thead>
      <tr><th rowspan="2" style="width:9%">วัน เดือน ปี</th><th rowspan="2" style="width:8%">ใบสั่งซื้อ</th>
      <th rowspan="2" style="width:8%">ใบสั่งจ้าง</th><th rowspan="2" style="width:8%">เลขบันทึกข้อความ</th>
      <th rowspan="2">โครงการ</th><th rowspan="2" style="width:8%">ระดับ</th>
      <th colspan="2">ล้างหนี้</th><th rowspan="2" style="width:14%">ครูที่รับผิดชอบ</th></tr>
      <tr><th style="width:7%">เช็คล้างหนี้</th><th style="width:6%">ไม่ทำ</th></tr>
      </thead><tbody></tbody></table>`);
    const tb = table.querySelector('tbody');
    let last = null;
    rows.forEach(t => {
      const teacher = Store.teacherById(t.teacher_id);
      const showDate = t.txn_date !== last; last = t.txn_date;
      const proj = t.project || t.description || '';
      tb.appendChild(U.el(`<tr>
        <td class="c">${showDate ? U.esc(U.thaiDate(t.txn_date)) : ''}</td>
        <td class="c">${U.esc(t.po_no || '')}</td>
        <td class="c">${U.esc(t.hire_no || '')}</td>
        <td class="c">${U.esc(t.memo_no || '')}</td>
        <td>${U.esc(proj)}${t.travel ? ' <b>(ไปราชการ)</b>' : ''}</td>
        <td class="c">${U.esc(t.level || '')}</td>
        <td class="c">${t.clear_status === 'cleared' ? '✔' : ''}</td>
        <td class="c">${t.clear_status === 'none' ? '✔' : ''}</td>
        <td class="c">${U.esc(teacher ? teacher.name : '')}</td></tr>`));
    });
    if (!rows.length) tb.appendChild(U.el('<tr><td colspan="9" class="c" style="padding:20px;color:#999">— ไม่มีรายการในเดือนนี้ —</td></tr>'));
    sheet.appendChild(table);
    sheet.appendChild(window.TxnEditor.signRow(s));
    return wrap;
  }

  function aoaOf(rows, m, s) {
    const aoa = [
      [`ทะเบียนคุม ใบสั่งซื้อ/สั่งจ้าง/ไปราชการ  ${s.name || ''}  ปีงบประมาณ ${Store.getFY()}`],
      [`ประจำเดือน ${U.thaiMonthYear(m)}`], [],
      ['วัน เดือน ปี', 'ใบสั่งซื้อ', 'ใบสั่งจ้าง', 'เลขบันทึกข้อความ', 'โครงการ', 'ระดับ', 'เช็คล้างหนี้', 'ไม่ทำ', 'ครูที่รับผิดชอบ'],
    ];
    let last = null;
    rows.forEach(t => {
      const teacher = Store.teacherById(t.teacher_id);
      const showDate = t.txn_date !== last; last = t.txn_date;
      aoa.push([showDate ? U.thaiDate(t.txn_date) : '', t.po_no || '', t.hire_no || '', t.memo_no || '',
        (t.project || t.description || '') + (t.travel ? ' (ไปราชการ)' : ''), t.level || '',
        t.clear_status === 'cleared' ? '✔' : '', t.clear_status === 'none' ? '✔' : '', teacher ? teacher.name : '']);
    });
    return aoa;
  }
  function opts() { return { cols: [12, 10, 10, 12, 36, 8, 10, 8, 18], merges: ['A1:I1', 'A2:I2'] }; }

  function exportMonth(m) {
    const s = Store.data().school || {};
    Exporter.download(`ทะเบียนใบสั่งซื้อสั่งจ้าง_${m}.xlsx`, U.thaiMonthYear(m), aoaOf(rowsOf(m), m, s), opts());
  }
  function exportAll() {
    const s = Store.data().school || {};
    const months = Array.from(new Set(Store.txnsFY().filter(isOrder).map(t => U.ymOf(t.txn_date)))).sort();
    if (!months.length) { U.toast('ยังไม่มีข้อมูล', 'err'); return; }
    Exporter.downloadMulti(`ทะเบียนใบสั่งซื้อสั่งจ้าง_ทั้งปี.xlsx`,
      months.map(m => ({ name: U.thaiMonthYear(m), aoa: aoaOf(rowsOf(m), m, s), opts: opts() })));
  }

  App.register('reg-orders', {
    title: 'ทะเบียนคุม ใบสั่งซื้อ/สั่งจ้าง/ไปราชการ',
    subtitle: 'สร้างอัตโนมัติจากรายการที่มีเลขใบสั่งซื้อ/สั่งจ้าง/โครงการ/ไปราชการ',
    render,
  });
})();
