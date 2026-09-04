// ============================================================
//  ทะเบียนรับเงินอุดหนุน (รายงวด) — สรุปเงินรับเข้า แยกตามประเภท(บัญชี) × งวด
//  ใช้รายการที่มี "รายรับ" (amount_in) ในปีงบที่เลือก
// ============================================================
(function () {
  const inOf = t => Number(t.amount_in || 0);
  const hasRound = t => t.round_no != null && t.round_no !== '' && Number.isFinite(Number(t.round_no));

  function build() {
    const rx = Store.txnsFY().filter(t => inOf(t) > 0);
    const roundSet = new Set();
    let noRound = false;
    rx.forEach(t => { if (hasRound(t)) roundSet.add(Number(t.round_no)); else noRound = true; });
    const rounds = Array.from(roundSet).sort((a, b) => a - b);
    const cols = rounds.map(r => ({ key: r, label: 'งวดที่ ' + r }));
    if (noRound) cols.push({ key: '_none', label: 'ไม่ระบุงวด' });

    const roundDate = {};
    rounds.forEach(r => {
      const ds = rx.filter(t => Number(t.round_no) === r).map(t => t.txn_date).filter(Boolean).sort();
      roundDate[r] = ds[0] || '';
    });

    const accounts = Store.data().accounts.filter(a => rx.some(t => t.account_id === a.id));
    const cell = (accId, key) => rx.filter(t => t.account_id === accId &&
      (key === '_none' ? !hasRound(t) : Number(t.round_no) === key)).reduce((s, t) => s + inOf(t), 0);
    const rowTotal = accId => rx.filter(t => t.account_id === accId).reduce((s, t) => s + inOf(t), 0);

    return { rx, cols, roundDate, accounts, cell, rowTotal };
  }

  function render(c) {
    const s = Store.data().school || {};
    const d = build();

    const tools = U.el(`<div class="toolbar no-print">
      <div class="spacer"></div>
      <button class="btn print" id="printBtn">🖨️ พิมพ์ A4</button>
      <button class="btn excel" id="xlsBtn">⬇️ Excel</button>
    </div>`);
    tools.querySelector('#printBtn').onclick = () => window.print();
    tools.querySelector('#xlsBtn').onclick = () => exportExcel(d, s);
    c.appendChild(tools);

    c.appendChild(buildScreen(d));
    c.appendChild(buildPrintSheet(d, s));
  }

  // ----- ตารางบนจอ -----
  function buildScreen(d) {
    const card = U.el('<div class="card no-print"><div class="table-wrap"></div></div>');
    if (!d.accounts.length) {
      card.querySelector('.table-wrap').appendChild(U.el('<div class="empty">ยังไม่มีรายการรับเงินในปีงบนี้ — บันทึกที่ “บันทึกรับ–จ่าย” โดยกรอกช่อง “รายรับ” และ “งวดที่”</div>'));
      return card;
    }
    const head = ['<th style="width:44px">ที่</th><th>ประเภท (บัญชี)</th>']
      .concat(d.cols.map(col => `<th class="num">${U.esc(col.label)}${col.key !== '_none' && d.roundDate[col.key] ? `<div class="sub" style="font-weight:400;font-size:11px">${U.esc(U.thaiDate(d.roundDate[col.key]))}</div>` : ''}</th>`))
      .concat(['<th class="num">รวม</th>']).join('');
    const table = U.el(`<table class="data"><thead><tr>${head}</tr></thead><tbody id="rb"></tbody><tfoot></tfoot></table>`);
    const tb = table.querySelector('#rb');
    const colTotals = {}; d.cols.forEach(col => colTotals[col.key] = 0);
    let grand = 0;
    d.accounts.forEach((a, i) => {
      const cells = d.cols.map(col => { const v = d.cell(a.id, col.key); colTotals[col.key] += v; return `<td class="num money-in">${U.money0(v)}</td>`; }).join('');
      const rt = d.rowTotal(a.id); grand += rt;
      tb.appendChild(U.el(`<tr><td class="c">${i + 1}</td><td><b>${U.esc(a.name)}</b> <span style="color:#999">${U.esc(a.category || '')}</span></td>${cells}<td class="num"><b>${U.money(rt)}</b></td></tr>`));
    });
    const foot = table.querySelector('tfoot');
    const footCells = d.cols.map(col => `<td class="num">${U.money(colTotals[col.key])}</td>`).join('');
    foot.appendChild(U.el(`<tr style="font-weight:700;background:#f7f9fe"><td colspan="2" style="text-align:right">รวมทั้งสิ้น</td>${footCells}<td class="num">${U.money(grand)}</td></tr>`));
    card.querySelector('.table-wrap').appendChild(table);
    return card;
  }

  // ----- แผ่นพิมพ์ A4 -----
  function buildPrintSheet(d, s) {
    const sheet = U.el('<div class="print-only sheet"></div>');
    sheet.appendChild(U.el(`<div class="doc-head">
      <div class="fy">ปีงบประมาณ ${Store.getFY()}</div>
      <img class="doc-logo" src="assets/logo.png" alt="">
      <div class="t1">ทะเบียนคุมการรับเงินอุดหนุน (รายงวด)</div>
      <div class="t2">${U.esc(s.name || '')} ${U.esc(s.district || '')} จังหวัด${U.esc(s.province || '')}</div>
    </div>`));
    const head = ['<th style="width:6%">ที่</th><th>ประเภท (บัญชี)</th>']
      .concat(d.cols.map(col => `<th>${U.esc(col.label)}${col.key !== '_none' && d.roundDate[col.key] ? '<br>' + U.esc(U.thaiDate(d.roundDate[col.key])) : ''}</th>`))
      .concat(['<th>รวม</th>']).join('');
    const table = U.el(`<table class="reg"><thead><tr>${head}</tr></thead><tbody></tbody></table>`);
    const tb = table.querySelector('tbody');
    const colTotals = {}; d.cols.forEach(col => colTotals[col.key] = 0);
    let grand = 0;
    if (!d.accounts.length) tb.appendChild(U.el(`<tr><td colspan="${d.cols.length + 3}" class="c" style="padding:20px;color:#999">— ไม่มีรายการรับเงิน —</td></tr>`));
    d.accounts.forEach((a, i) => {
      const cells = d.cols.map(col => { const v = d.cell(a.id, col.key); colTotals[col.key] += v; return `<td class="num">${U.money0(v)}</td>`; }).join('');
      const rt = d.rowTotal(a.id); grand += rt;
      tb.appendChild(U.el(`<tr><td class="c">${i + 1}</td><td>${U.esc(a.name)}</td>${cells}<td class="num">${U.money(rt)}</td></tr>`));
    });
    if (d.accounts.length) {
      const footCells = d.cols.map(col => `<td class="num">${U.money(colTotals[col.key])}</td>`).join('');
      tb.appendChild(U.el(`<tr class="sum"><td colspan="2" class="c">รวมทั้งสิ้น</td>${footCells}<td class="num">${U.money(grand)}</td></tr>`));
    }
    sheet.appendChild(table);
    if (window.TxnEditor && window.TxnEditor.signRow) sheet.appendChild(window.TxnEditor.signRow(s));
    return sheet;
  }

  // ----- ส่งออก Excel -----
  function exportExcel(d, s) {
    const header = ['ที่', 'ประเภท (บัญชี)'].concat(d.cols.map(c => c.label + (c.key !== '_none' && d.roundDate[c.key] ? ' (' + U.thaiDate(d.roundDate[c.key]) + ')' : ''))).concat(['รวม']);
    const aoa = [[`ทะเบียนคุมการรับเงินอุดหนุน  ${s.name || ''}  ปีงบประมาณ ${Store.getFY()}`], [], header];
    const colTotals = {}; d.cols.forEach(col => colTotals[col.key] = 0);
    let grand = 0;
    d.accounts.forEach((a, i) => {
      const cells = d.cols.map(col => { const v = d.cell(a.id, col.key); colTotals[col.key] += v; return v; });
      const rt = d.rowTotal(a.id); grand += rt;
      aoa.push([i + 1, a.name].concat(cells).concat([rt]));
    });
    aoa.push(['', 'รวมทั้งสิ้น'].concat(d.cols.map(col => colTotals[col.key])).concat([grand]));
    const nCols = 2 + d.cols.length + 1;
    const numCols = []; for (let i = 2; i < nCols; i++) numCols.push(i);
    const cols = [5, 28].concat(d.cols.map(() => 14)).concat([14]);
    const lastCol = XLSX.utils.encode_col(nCols - 1);
    Exporter.download('ทะเบียนรับเงินอุดหนุน.xlsx', 'รับเงินอุดหนุน', aoa,
      { cols, numCols, merges: ['A1:' + lastCol + '1'] });
  }

  App.register('reg-subsidy', {
    title: 'ทะเบียนรับเงินอุดหนุน (รายงวด)',
    subtitle: 'สรุปเงินรับเข้าแยกตามประเภทบัญชี และงวดที่รับ',
    render,
  });
})();
