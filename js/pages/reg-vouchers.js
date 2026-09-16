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
  function activityOf(t) {
    const lines = String(t.notes || '').split(/\r?\n/);
    return lines.find(line => line.startsWith('[กิจกรรม] '))?.slice('[กิจกรรม] '.length) || '';
  }
  function plainNoteOf(t) {
    return String(t.notes || '').split(/\r?\n/).filter(line => !line.startsWith('[กิจกรรม] ')).join('\n').trim();
  }

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
    const wrap = U.el('<div class="card"><div class="sheet voucher-sheet"></div></div>');
    const sheet = wrap.querySelector('.sheet');
    const fy = String((Store.getFY())).slice(-2);
    sheet.appendChild(U.el(`<div class="doc-head">
      <div class="fy">ปีงบประมาณ ${Store.getFY()}</div><img class="doc-logo" src="assets/logo.png" alt="">
      <div class="t1">ทะเบียนคุม บค./บจ./บย./บร.</div>
      <div class="t2">${U.esc(s.name || '')} ${U.esc(s.district || '')} จังหวัด${U.esc(s.province || '')}</div>
    </div>`));
    const table = U.el(`<table class="reg voucher-reg"><colgroup>
      <col style="width:9%"><col style="width:8%"><col style="width:6%"><col style="width:45%">
      <col style="width:11%"><col style="width:13%"><col style="width:8%">
      </colgroup><thead>
      <tr><th rowspan="2" class="voucher-date">วัน เดือน ปี</th><th colspan="2">เลขที่เอกสาร</th>
      <th rowspan="2">รายการ/โครงการ/กิจกรรม</th><th rowspan="2">จำนวนเงิน</th>
      <th rowspan="2" class="voucher-account">บัญชี</th><th rowspan="2">หมายเหตุ</th></tr>
      <tr><th class="voucher-doc-type">บค./<br>บจ./<br>บย./<br>บร.</th><th>.../${fy}</th></tr>
      </thead><tbody></tbody></table>`);
    const tb = table.querySelector('tbody');
    let last = null, total = 0;
    rows.forEach(t => {
      const acc = Store.accountById(t.account_id);
      const showDate = t.txn_date !== last; last = t.txn_date;
      const amt = amountOf(t); total += amt;
      tb.appendChild(U.el(`<tr>
        <td class="c voucher-date">${showDate ? U.esc(U.thaiDate(t.txn_date)) : ''}</td>
        <td class="c">${U.esc(t.doc_type || '')}</td>
        <td class="c">${t.doc_no ?? ''}</td>
        <td class="item-project-activity">${U.esc(U.itemProjectActivityText(t))}</td>
        <td class="num">${U.money0(amt)}</td>
        <td class="c voucher-account">${acc ? U.esc(acc.name) : ''}</td>
        <td class="voucher-note">${U.esc(plainNoteOf(t))}</td></tr>`));
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
      ['วัน เดือน ปี', 'บค./บจ./บย./บร.', `.../${fy}`, 'รายการ/โครงการ/กิจกรรม', 'จำนวนเงิน', 'บัญชี', 'หมายเหตุ'],
    ];
    let last = null, total = 0;
    rows.forEach(t => {
      const acc = Store.accountById(t.account_id);
      const showDate = t.txn_date !== last; last = t.txn_date;
      const amt = amountOf(t); total += amt;
      aoa.push([showDate ? U.thaiDate(t.txn_date) : '', t.doc_type || '', t.doc_no || '', U.itemProjectActivityText(t), amt, acc ? acc.name : '', plainNoteOf(t)]);
    });
    aoa.push(['', '', '', 'รวมทั้งสิ้น', total, '', '']);
    return aoa;
  }

  function exportMonth(m) {
    const s = Store.data().school || {};
    Exporter.download(`ทะเบียนคุม_บคบจบยบร_${m}.xlsx`, U.thaiMonthYear(m), aoaOf(rowsOf(m), m, s),
      { cols: [14, 12, 8, 68, 14, 18, 16], numCols: [4], merges: ['A1:G1', 'A2:G2'] });
  }
  function exportAll() {
    const s = Store.data().school || {};
    const months = Array.from(new Set(Store.txnsFY().filter(t => t.doc_type).map(t => U.ymOf(t.txn_date)))).sort();
    if (!months.length) { U.toast('ยังไม่มีข้อมูล', 'err'); return; }
    Exporter.downloadMulti(`ทะเบียนคุม_บคบจบยบร_ทั้งปี.xlsx`,
      months.map(m => ({ name: U.thaiMonthYear(m), aoa: aoaOf(rowsOf(m), m, s), opts: { cols: [14, 12, 8, 68, 14, 18, 16], numCols: [4], merges: ['A1:G1', 'A2:G2'] } })));
  }

  App.register('reg-vouchers', {
    title: 'ทะเบียนคุม บค./บจ./บย./บร.',
    subtitle: 'สร้างอัตโนมัติจากรายการที่มีเลขที่เอกสาร',
    render,
  });
})();
