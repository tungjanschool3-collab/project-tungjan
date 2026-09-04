// ============================================================
//  ทะเบียนคุม บค./บจ./บย./บร.
// ============================================================
(function () {
  let filterMonth = '';

  function rowsOf(m) {
    return Store.txnsFY()
      .filter(t => t.doc_type && (!m || U.ymOf(t.txn_date) === m))
      .sort((a, b) => (a.doc_no || 0) - (b.doc_no || 0) || (a.txn_date < b.txn_date ? -1 : 1));
  }
  const amountOf = t => Number(t.amount_in || 0) > 0 ? Number(t.amount_in) : Number(t.amount_out || 0);

  function render(c) {
    const months = App.monthOptions();
    if (!filterMonth) filterMonth = months[0] || U.ymOf(U.todayISO());
    const s = Store.data().school || {};

    const tools = U.el(`<div class="toolbar no-print">
      <div class="field"><label>เดือน</label><select id="mSel"></select></div>
      <div class="spacer"></div>
      <button class="btn print" id="printBtn">🖨️ พิมพ์ A4</button>
      <button class="btn excel" id="xlsBtn">⬇️ Excel เดือนนี้</button>
      <button class="btn excel" id="xlsAllBtn">⬇️ Excel ทั้งปี (แยกชีตรายเดือน)</button>
    </div>`);
    const mSel = tools.querySelector('#mSel');
    months.forEach(m => mSel.appendChild(U.el(`<option value="${m}" ${m === filterMonth ? 'selected' : ''}>${U.thaiMonthYear(m)}</option>`)));
    mSel.onchange = () => { filterMonth = mSel.value; App.go('reg-vouchers'); };
    tools.querySelector('#printBtn').onclick = () => window.print();
    tools.querySelector('#xlsBtn').onclick = () => exportMonth(filterMonth);
    tools.querySelector('#xlsAllBtn').onclick = exportAll;
    c.appendChild(tools);

    c.appendChild(buildSheet(rowsOf(filterMonth), filterMonth, s));
  }

  function buildSheet(rows, m, s) {
    const wrap = U.el('<div class="card"><div class="sheet"></div></div>');
    const sheet = wrap.querySelector('.sheet');
    const fy = String((Store.getFY())).slice(-2);
    sheet.appendChild(U.el(`<div class="doc-head">
      <div class="fy">ปีงบประมาณ ${Store.getFY()}</div>
      <div class="t1">ทะเบียนคุม บค./บจ./บย./บร.</div>
      <div class="t2">${U.esc(s.name || '')} ${U.esc(s.district || '')} จังหวัด${U.esc(s.province || '')}</div>
      <div class="t3">ประจำเดือน ${U.thaiMonthYear(m)}</div>
    </div>`));
    const table = U.el(`<table class="reg"><thead>
      <tr><th rowspan="2" style="width:12%">วัน เดือน ปี</th><th colspan="2">เลขที่เอกสาร</th>
      <th rowspan="2">รายการ</th><th rowspan="2" style="width:13%">จำนวนเงิน</th>
      <th rowspan="2" style="width:15%">บัญชี</th><th rowspan="2" style="width:12%">หมายเหตุ</th></tr>
      <tr><th style="width:8%">บค./บจ./บย./บร.</th><th style="width:7%">.../${fy}</th></tr>
      </thead><tbody></tbody></table>`);
    const tb = table.querySelector('tbody');
    let last = null, total = 0;
    rows.forEach(t => {
      const acc = Store.accountById(t.account_id);
      const showDate = t.txn_date !== last; last = t.txn_date;
      const amt = amountOf(t); total += amt;
      tb.appendChild(U.el(`<tr>
        <td class="c">${showDate ? U.esc(U.thaiDate(t.txn_date)) : ''}</td>
        <td class="c">${U.esc(t.doc_type || '')}</td>
        <td class="c">${t.doc_no ?? ''}</td>
        <td>${U.esc(t.description || '')}</td>
        <td class="num">${U.money0(amt)}</td>
        <td class="c">${acc ? U.esc(acc.name) : ''}</td>
        <td>${U.esc(t.notes || '')}</td></tr>`));
    });
    if (!rows.length) tb.appendChild(U.el('<tr><td colspan="7" class="c" style="padding:20px;color:#999">— ไม่มีรายการในเดือนนี้ —</td></tr>'));
    tb.appendChild(U.el(`<tr class="sum"><td colspan="4" class="c">รวมทั้งสิ้น</td><td class="num">${U.money(total)}</td><td colspan="2"></td></tr>`));
    sheet.appendChild(table);
    sheet.appendChild(window.TxnEditor.signRow(s));
    return wrap;
  }

  function aoaOf(rows, m, s) {
    const fy = String((Store.getFY())).slice(-2);
    const aoa = [
      [`ทะเบียนคุม บค./บจ./บย./บร.  ${s.name || ''}  ปีงบประมาณ ${Store.getFY()}`],
      [`ประจำเดือน ${U.thaiMonthYear(m)}`], [],
      ['วัน เดือน ปี', 'บค./บจ./บย./บร.', `.../${fy}`, 'รายการ', 'จำนวนเงิน', 'บัญชี', 'หมายเหตุ'],
    ];
    let last = null, total = 0;
    rows.forEach(t => {
      const acc = Store.accountById(t.account_id);
      const showDate = t.txn_date !== last; last = t.txn_date;
      const amt = amountOf(t); total += amt;
      aoa.push([showDate ? U.thaiDate(t.txn_date) : '', t.doc_type || '', t.doc_no || '', t.description || '', amt, acc ? acc.name : '', t.notes || '']);
    });
    aoa.push(['', '', '', 'รวมทั้งสิ้น', total, '', '']);
    return aoa;
  }

  function exportMonth(m) {
    const s = Store.data().school || {};
    Exporter.download(`ทะเบียนคุม_บคบจบยบร_${m}.xlsx`, U.thaiMonthYear(m), aoaOf(rowsOf(m), m, s),
      { cols: [14, 12, 8, 42, 14, 18, 16], numCols: [4], merges: ['A1:G1', 'A2:G2'] });
  }
  function exportAll() {
    const s = Store.data().school || {};
    const months = Array.from(new Set(Store.txnsFY().filter(t => t.doc_type).map(t => U.ymOf(t.txn_date)))).sort();
    if (!months.length) { U.toast('ยังไม่มีข้อมูล', 'err'); return; }
    Exporter.downloadMulti(`ทะเบียนคุม_บคบจบยบร_ทั้งปี.xlsx`,
      months.map(m => ({ name: U.thaiMonthYear(m), aoa: aoaOf(rowsOf(m), m, s), opts: { cols: [14, 12, 8, 42, 14, 18, 16], numCols: [4], merges: ['A1:G1', 'A2:G2'] } })));
  }

  App.register('reg-vouchers', {
    title: 'ทะเบียนคุม บค./บจ./บย./บร.',
    subtitle: 'สร้างอัตโนมัติจากรายการที่มีเลขที่เอกสาร',
    render,
  });
})();
