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
    c.appendChild(buildActivitySummary(acc, filterMonth));
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

  // รวมยอดรายการรับ-จ่ายของกิจกรรมย่อยในบัญชีและเดือนที่เลือก
  function activityName(t) {
    const line = String(t.notes || '').split('\n').find(x => x.startsWith('[กิจกรรม] '));
    return line ? line.slice('[กิจกรรม] '.length).trim() : '';
  }

  function itemText(t) {
    const activity = activityName(t);
    return String(t.description || '') + (activity ? ` — ${activity}` : '');
  }

  function plainNotes(t) {
    return String(t.notes || '').split('\n').filter(x => !x.startsWith('[กิจกรรม] ')).join('\n');
  }

  // เลขปี พ.ศ. 2 หลักตามเดือนที่แสดง เช่น 2025-10 -> 68
  function shortThaiYear(m) {
    const year = Number(String(m || '').slice(0, 4));
    return year ? String(year + 543).slice(-2) : '';
  }

  function activityTotals(acc, m) {
    const grouped = new Map();
    accTxns(acc.id).filter(t => U.ymOf(t.txn_date) === m).forEach(t => {
      const activity = activityName(t);
      if (!activity) return;
      const project = String(t.project || 'ไม่ระบุโครงการ').trim();
      const key = `${project}\u0000${activity}`;
      const row = grouped.get(key) || { project, activity, amountIn: 0, amountOut: 0 };
      row.amountIn += Number(t.amount_in || 0);
      row.amountOut += Number(t.amount_out || 0);
      grouped.set(key, row);
    });
    return Array.from(grouped.values()).sort((a, b) =>
      a.project.localeCompare(b.project, 'th') || a.activity.localeCompare(b.activity, 'th'));
  }

  function buildActivitySummary(acc, m) {
    const rows = activityTotals(acc, m);
    const card = U.el(`<div class="card">
      <h3>สรุปเงินตามกิจกรรม</h3>
      <div class="sub">รวมยอดกิจกรรมย่อยของบัญชี ${U.esc(acc.name)} · ${U.thaiMonthYear(m)}</div>
      <div class="table-wrap"><table class="data"><thead><tr>
        <th>โครงการ</th><th>กิจกรรมย่อย</th><th class="num">รับ</th><th class="num">จ่าย</th><th class="num">สุทธิ</th>
      </tr></thead><tbody></tbody><tfoot></tfoot></table></div>
    </div>`);
    const tb = card.querySelector('tbody');
    if (!rows.length) {
      tb.appendChild(U.el('<tr><td colspan="5"><div class="empty">ยังไม่มีรายการที่ระบุกิจกรรมในเดือนนี้</div></td></tr>'));
    } else {
      rows.forEach(r => tb.appendChild(U.el(`<tr>
        <td>${U.esc(r.project)}</td><td>${U.esc(r.activity)}</td>
        <td class="num money-in">${U.money0(r.amountIn)}</td>
        <td class="num money-out">${U.money0(r.amountOut)}</td>
        <td class="num"><b>${U.money(r.amountIn - r.amountOut)}</b></td>
      </tr>`)));
    }
    const totalIn = rows.reduce((sum, r) => sum + r.amountIn, 0);
    const totalOut = rows.reduce((sum, r) => sum + r.amountOut, 0);
    card.querySelector('tfoot').appendChild(U.el(`<tr class="sum">
      <td colspan="2" class="c">รวมทุกกิจกรรม</td>
      <td class="num">${U.money(totalIn)}</td><td class="num">${U.money(totalOut)}</td>
      <td class="num">${U.money(totalIn - totalOut)}</td>
    </tr>`));
    return card;
  }

  function buildSheet(acc, m, s) {
    const data = computeMonth(acc, m);
    const wrap = U.el('<div class="card"><div class="sheet"></div></div>');
    const sheet = wrap.querySelector('.sheet');
    sheet.appendChild(U.el(`<div class="doc-head">
      <div class="fy">ปีงบประมาณ ${Store.getFY()}</div><img class="doc-logo" src="assets/logo.png" alt="">
      <div class="t1">ทะเบียนคุมเงินนอกงบประมาณ</div>
      <div class="t2">ประเภทเงิน: ${U.esc(acc.name)}&nbsp;&nbsp;${U.esc(s.name || '')} ${U.esc(s.office || '')}</div>
      <div class="t3">${U.thaiMonthYear(m)}</div>
    </div>`));
    const table = U.el(`<table class="reg offbudget-reg"><thead>
      <tr><th rowspan="2" style="width:7%">วัน เดือน ปี</th>
      <th colspan="2" style="width:10%">เลขที่เอกสาร</th>
      <th rowspan="2">รายการ/โครงการ/กิจกรรม</th><th rowspan="2" style="width:8%">รับ</th>
      <th colspan="2">จ่าย</th><th colspan="3">คงเหลือ</th><th rowspan="2" style="width:8%">หมายเหตุ</th></tr>
      <tr><th style="width:6%">บค./บจ./<br>บย./บร.</th><th style="width:4%">${shortThaiYear(m)}</th>
      <th style="width:7%">ลูกหนี้</th><th style="width:7%">ใบสำคัญ</th>
      <th style="width:7%">เงินสด</th><th style="width:8%">เงินฝากธนาคาร</th><th style="width:8%">เงินฝากส่วนราชการ</th></tr>
      </thead><tbody></tbody></table>`);
    const tb = table.querySelector('tbody');
    // แถวยอดยกมา
    tb.appendChild(U.el(`<tr class="sum"><td colspan="4">ยอดยกมา ${U.thaiMonthYear(m)}</td>
      <td class="num"></td><td class="num"></td><td class="num"></td>
      <td class="num">${U.money(data.start.b.cash)}</td><td class="num">${U.money(data.start.b.bank)}</td><td class="num">${U.money(data.start.b.gov)}</td><td></td></tr>`));
    let last = null, i = 0;
    data.rows.forEach(({ t, ps, bal }) => {
      const showDate = t.txn_date !== last; last = t.txn_date; i++;
      tb.appendChild(U.el(`<tr>
        <td class="c">${showDate ? U.esc(U.thaiDate(t.txn_date)) : ''}</td>
        <td class="c">${U.esc(t.doc_type || '')}</td>
        <td class="c">${U.esc(t.doc_no ?? '')}</td>
        <td>${U.esc(itemText(t))}</td>
        <td class="num">${U.money0(t.amount_in)}</td>
        <td class="num">${U.money0(ps.debtor)}</td>
        <td class="num">${U.money0(ps.voucher)}</td>
        <td class="num">${U.money0(bal.cash)}</td>
        <td class="num">${U.money(bal.bank)}</td>
        <td class="num">${U.money0(bal.gov)}</td>
        <td>${U.esc(plainNotes(t))}</td></tr>`));
    });
    if (!data.rows.length) tb.appendChild(U.el('<tr><td colspan="11" class="c" style="padding:16px;color:#999">— ไม่มีรายการในเดือนนี้ —</td></tr>'));
    // รวมเดือนนี้
    const mt = data.monthTotals;
    tb.appendChild(U.el(`<tr class="sum"><td colspan="4" class="c">รวมเดือนนี้</td>
      <td class="num">${U.money(mt.rin)}</td><td class="num">${U.money(mt.debtor)}</td><td class="num">${U.money(mt.voucher)}</td>
      <td class="num">${U.money(data.endBal.cash)}</td><td class="num">${U.money(data.endBal.bank)}</td><td class="num">${U.money(data.endBal.gov)}</td><td></td></tr>`));
    // รวมตั้งแต่ต้นปี
    const ct = data.cumTotals;
    tb.appendChild(U.el(`<tr class="sum"><td colspan="4" class="c">รวมตั้งแต่ต้นปี</td>
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
      [`${s.name || ''} ${s.office || ''}  ปีงบประมาณ ${Store.getFY()}  ${U.thaiMonthYear(m)}`],
      [],
      ['วัน เดือน ปี', 'เลขที่เอกสาร', '', 'รายการ/โครงการ/กิจกรรม', 'รับ', 'จ่าย', '', 'คงเหลือ', '', '', 'หมายเหตุ'],
      ['', 'บค./บจ./บย./บร.', shortThaiYear(m), '', '', 'ลูกหนี้', 'ใบสำคัญ', 'เงินสด', 'เงินฝากธนาคาร', 'เงินฝากส่วนราชการ', ''],
      [`ยอดยกมา ${U.thaiMonthYear(m)}`, '', '', '', '', '', '', data.start.b.cash, data.start.b.bank, data.start.b.gov, ''],
    ];
    let last = null, i = 0;
    data.rows.forEach(({ t, ps, bal }) => {
      const showDate = t.txn_date !== last; last = t.txn_date; i++;
      aoa.push([showDate ? U.thaiDate(t.txn_date) : '', t.doc_type || '', t.doc_no ?? '', itemText(t),
        Number(t.amount_in || 0), ps.debtor, ps.voucher, bal.cash, bal.bank, bal.gov, plainNotes(t)]);
    });
    const mt = data.monthTotals;
    aoa.push(['', '', '', 'รวมเดือนนี้', mt.rin, mt.debtor, mt.voucher, data.endBal.cash, data.endBal.bank, data.endBal.gov, '']);
    aoa.push(['', '', '', 'รวมตั้งแต่ต้นปี', data.cumTotals.rin, data.cumTotals.rout, '', data.endBal.cash, data.endBal.bank, data.endBal.gov, '']);
    return aoa;
  }
  function opts() { return {
    cols: [12, 12, 6, 38, 12, 12, 12, 12, 14, 15, 12],
    numCols: [4, 5, 6, 7, 8, 9],
    merges: ['A1:K1', 'A2:K2', 'A4:A5', 'B4:C4', 'D4:D5', 'E4:E5', 'F4:G4', 'H4:J4', 'K4:K5']
  }; }

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
