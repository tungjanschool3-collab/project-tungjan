// ============================================================
//  ทะเบียนคุมเงินนอกงบประมาณ (แยกตามบัญชี, ยอดคงเหลือสะสม)
// ============================================================
(function () {
  let accId = '';
  let filterMonth = '';

  function paySplit(t) {
    const debtor = Number(t.pay_debtor || 0);
    const voucher = Number(t.pay_voucher || 0) > 0 ? Number(t.pay_voucher) : Math.max(0, Number(t.amount_out || 0) - debtor);
    return { debtor, voucher };
  }

  // รายการของบัญชี เรียงตามวันที่/เลขที่
  function accTxns(id) {
    return Store.txnsFY()
      .filter(t => t.account_id === id)
      .sort((a, b) => (a.txn_date < b.txn_date ? -1 : a.txn_date > b.txn_date ? 1 : (a.doc_no || 0) - (b.doc_no || 0)));
  }

  // คำนวณคงเหลือ (cash/bank/gov) สะสมถึงก่อนวันที่ boundary (ไม่รวม)
  function balanceBefore(acc, txns, boundaryYm) {
    const b = { cash: Number(acc.opening_cash || 0), bank: Number(acc.opening_bank || 0), gov: Number(acc.opening_govdeposit || 0) };
    let rin = 0, rout = 0;
    txns.forEach(t => {
      if (boundaryYm && U.ymOf(t.txn_date) >= boundaryYm) return;
      const col = t.bal_type === 'cash' ? 'cash' : t.bal_type === 'govdeposit' ? 'gov' : 'bank';
      b[col] += Number(t.amount_in || 0) - Number(t.amount_out || 0);
      rin += Number(t.amount_in || 0); rout += Number(t.amount_out || 0);
    });
    return { b, rin, rout };
  }

  function render(c) {
    const D = Store.data();
    if (!D.accounts.length) { c.appendChild(U.el('<div class="card"><div class="empty">ยังไม่มีบัญชี — เพิ่มได้ที่ “ข้อมูลหลัก → บัญชี”</div></div>')); return; }
    if (!accId || !Store.accountById(accId)) accId = D.accounts[0].id;
    const months = App.monthOptions();
    if (!filterMonth) filterMonth = months[0] || U.ymOf(U.todayISO());
    const acc = Store.accountById(accId);
    const s = D.school || {};

    // ----- เลือกบัญชี -----
    const chips = U.el('<div class="card no-print"><div class="sub">เลือกบัญชี</div><div class="chips" id="accChips"></div></div>');
    const box = chips.querySelector('#accChips');
    D.accounts.forEach(a => {
      const chip = U.el(`<div class="chip ${a.id === accId ? 'active' : ''}">${U.esc(a.name)}</div>`);
      chip.onclick = () => { accId = a.id; App.go('reg-offbudget'); };
      box.appendChild(chip);
    });
    c.appendChild(chips);

    // ----- toolbar -----
    const tools = U.el(`<div class="toolbar no-print">
      <div class="field"><label>เดือน</label><select id="mSel"></select></div>
      <div class="spacer"></div>
      <button class="btn print" id="printBtn">🖨️ พิมพ์ A4</button>
      <button class="btn excel" id="xlsBtn">⬇️ Excel เดือนนี้</button>
      <button class="btn excel" id="xlsAllBtn">⬇️ Excel ทั้งปี</button>
    </div>`);
    const mSel = tools.querySelector('#mSel');
    months.forEach(m => mSel.appendChild(U.el(`<option value="${m}" ${m === filterMonth ? 'selected' : ''}>${U.thaiMonthYear(m)}</option>`)));
    mSel.onchange = () => { filterMonth = mSel.value; App.go('reg-offbudget'); };
    tools.querySelector('#printBtn').onclick = () => window.print();
    tools.querySelector('#xlsBtn').onclick = () => exportMonth(acc, filterMonth);
    tools.querySelector('#xlsAllBtn').onclick = () => exportAll(acc);
    c.appendChild(tools);

    c.appendChild(buildSheet(acc, filterMonth, s));
  }

  // สร้างข้อมูลแถวของเดือน (ใช้ทั้งแสดงและ export)
  function computeMonth(acc, m) {
    const txns = accTxns(acc.id);
    const start = balanceBefore(acc, txns, m);      // คงเหลือต้นเดือน
    const bal = Object.assign({}, start.b);
    const rows = [];
    let mIn = 0, mDebt = 0, mVou = 0;
    txns.filter(t => U.ymOf(t.txn_date) === m).forEach(t => {
      const col = t.bal_type === 'cash' ? 'cash' : t.bal_type === 'govdeposit' ? 'gov' : 'bank';
      bal[col] += Number(t.amount_in || 0) - Number(t.amount_out || 0);
      const ps = paySplit(t);
      mIn += Number(t.amount_in || 0); mDebt += ps.debtor; mVou += ps.voucher;
      rows.push({ t, ps, bal: Object.assign({}, bal) });
    });
    // ยอดสะสมถึงสิ้นเดือน
    const endAll = balanceBefore(acc, txns, nextYm(m));
    return { start, rows, monthTotals: { rin: mIn, debtor: mDebt, voucher: mVou },
      cumTotals: { rin: endAll.rin, rout: endAll.rout }, endBal: endAll.b };
  }
  function nextYm(m) { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

  function buildSheet(acc, m, s) {
    const data = computeMonth(acc, m);
    const wrap = U.el('<div class="card"><div class="sheet"></div></div>');
    const sheet = wrap.querySelector('.sheet');
    sheet.appendChild(U.el(`<div class="doc-head">
      <div class="fy">ปีงบประมาณ ${Store.getFY()}</div>
      <div class="t1">ทะเบียนคุมเงินนอกงบประมาณ</div>
      <div class="t2">ประเภทเงิน: ${U.esc(acc.name)}&nbsp;&nbsp;${U.esc(s.name || '')} ${U.esc(s.office || '')}</div>
      <div class="t3">ประจำเดือน ${U.thaiMonthYear(m)}</div>
    </div>`));
    const table = U.el(`<table class="reg"><thead>
      <tr><th rowspan="2" style="width:9%">วัน เดือน ปี</th><th rowspan="2" style="width:5%">ที่</th>
      <th rowspan="2">รายการ</th><th rowspan="2" style="width:9%">รับ</th>
      <th colspan="2">จ่าย</th><th colspan="3">คงเหลือ</th><th rowspan="2" style="width:8%">หมายเหตุ</th></tr>
      <tr><th style="width:8%">ลูกหนี้</th><th style="width:8%">ใบสำคัญ</th>
      <th style="width:8%">เงินสด</th><th style="width:9%">เงินฝากธนาคาร</th><th style="width:9%">เงินฝากส่วนราชการ</th></tr>
      </thead><tbody></tbody></table>`);
    const tb = table.querySelector('tbody');
    // แถวยอดยกมา
    tb.appendChild(U.el(`<tr class="sum"><td colspan="3">ยอดยกมา ${U.thaiMonthYear(m)}</td>
      <td class="num"></td><td class="num"></td><td class="num"></td>
      <td class="num">${U.money(data.start.b.cash)}</td><td class="num">${U.money(data.start.b.bank)}</td><td class="num">${U.money(data.start.b.gov)}</td><td></td></tr>`));
    let last = null, i = 0;
    data.rows.forEach(({ t, ps, bal }) => {
      const showDate = t.txn_date !== last; last = t.txn_date; i++;
      tb.appendChild(U.el(`<tr>
        <td class="c">${showDate ? U.esc(U.thaiDate(t.txn_date)) : ''}</td>
        <td class="c">${t.doc_no ?? i}</td>
        <td>${U.esc(t.description || '')}</td>
        <td class="num">${U.money0(t.amount_in)}</td>
        <td class="num">${U.money0(ps.debtor)}</td>
        <td class="num">${U.money0(ps.voucher)}</td>
        <td class="num">${U.money0(bal.cash)}</td>
        <td class="num">${U.money(bal.bank)}</td>
        <td class="num">${U.money0(bal.gov)}</td>
        <td>${U.esc(t.notes || '')}</td></tr>`));
    });
    if (!data.rows.length) tb.appendChild(U.el('<tr><td colspan="10" class="c" style="padding:16px;color:#999">— ไม่มีรายการในเดือนนี้ —</td></tr>'));
    // รวมเดือนนี้
    const mt = data.monthTotals;
    tb.appendChild(U.el(`<tr class="sum"><td colspan="3" class="c">รวมเดือนนี้</td>
      <td class="num">${U.money(mt.rin)}</td><td class="num">${U.money(mt.debtor)}</td><td class="num">${U.money(mt.voucher)}</td>
      <td class="num">${U.money(data.endBal.cash)}</td><td class="num">${U.money(data.endBal.bank)}</td><td class="num">${U.money(data.endBal.gov)}</td><td></td></tr>`));
    // รวมตั้งแต่ต้นปี
    const ct = data.cumTotals;
    tb.appendChild(U.el(`<tr class="sum"><td colspan="3" class="c">รวมตั้งแต่ต้นปี</td>
      <td class="num">${U.money(ct.rin)}</td><td colspan="2" class="num">จ่ายสะสม ${U.money(ct.rout)}</td>
      <td class="num">${U.money(data.endBal.cash)}</td><td class="num">${U.money(data.endBal.bank)}</td><td class="num">${U.money(data.endBal.gov)}</td><td></td></tr>`));
    sheet.appendChild(table);
    sheet.appendChild(signRow3(s));
    return wrap;
  }

  function signRow3(s) {
    return U.el(`<div class="sign-row">
      <div class="s">ลงชื่อ.................... ผู้ลงบัญชี<br>(${U.esc(s.finance_officer || '')})</div>
      <div class="s">ลงชื่อ.................... ผู้ตรวจสอบ<br>(${U.esc(s.auditor || '')})</div>
      <div class="s">ลงชื่อ.................... ผู้บริหารสถานศึกษา<br>(${U.esc(s.director || '')})</div>
    </div>`);
  }

  // ---------- export ----------
  function aoaOf(acc, m, s) {
    const data = computeMonth(acc, m);
    const aoa = [
      [`ทะเบียนคุมเงินนอกงบประมาณ  ประเภท: ${acc.name}`],
      [`${s.name || ''} ${s.office || ''}  ปีงบประมาณ ${Store.getFY()}  ประจำเดือน ${U.thaiMonthYear(m)}`],
      [],
      ['วัน เดือน ปี', 'ที่', 'รายการ', 'รับ', 'จ่าย-ลูกหนี้', 'จ่าย-ใบสำคัญ', 'คงเหลือ-เงินสด', 'คงเหลือ-ธนาคาร', 'คงเหลือ-ส่วนราชการ', 'หมายเหตุ'],
      [`ยอดยกมา ${U.thaiMonthYear(m)}`, '', '', '', '', '', data.start.b.cash, data.start.b.bank, data.start.b.gov, ''],
    ];
    let last = null, i = 0;
    data.rows.forEach(({ t, ps, bal }) => {
      const showDate = t.txn_date !== last; last = t.txn_date; i++;
      aoa.push([showDate ? U.thaiDate(t.txn_date) : '', t.doc_no || i, t.description || '',
        Number(t.amount_in || 0), ps.debtor, ps.voucher, bal.cash, bal.bank, bal.gov, t.notes || '']);
    });
    const mt = data.monthTotals;
    aoa.push(['', '', 'รวมเดือนนี้', mt.rin, mt.debtor, mt.voucher, data.endBal.cash, data.endBal.bank, data.endBal.gov, '']);
    aoa.push(['', '', 'รวมตั้งแต่ต้นปี', data.cumTotals.rin, data.cumTotals.rout, '', data.endBal.cash, data.endBal.bank, data.endBal.gov, '']);
    return aoa;
  }
  function opts() { return { cols: [12, 5, 34, 12, 12, 12, 12, 13, 14, 12], numCols: [3, 4, 5, 6, 7, 8], merges: ['A1:J1', 'A2:J2'] }; }

  function exportMonth(acc, m) {
    Exporter.download(`เงินนอกงบ_${acc.name}_${m}.xlsx`, U.thaiMonthYear(m), aoaOf(acc, m, Store.data().school || {}), opts());
  }
  function exportAll(acc) {
    const s = Store.data().school || {};
    const months = Array.from(new Set(accTxns(acc.id).map(t => U.ymOf(t.txn_date)))).sort();
    if (!months.length) { U.toast('บัญชีนี้ยังไม่มีรายการ', 'err'); return; }
    Exporter.downloadMulti(`เงินนอกงบ_${acc.name}_ทั้งปี.xlsx`,
      months.map(m => ({ name: U.thaiMonthYear(m).slice(0, 20), aoa: aoaOf(acc, m, s), opts: opts() })));
  }

  window.RegOffbudget = { select: id => { accId = id; } };

  App.register('reg-offbudget', {
    title: 'ทะเบียนคุมเงินนอกงบประมาณ',
    subtitle: 'เลือกบัญชี → ดูยอดรับ/จ่าย/คงเหลือแบบสะสม',
    render,
  });
})();
