// ============================================================
//  ทะเบียนค่าสาธารณูปโภค — ค่าน้ำ / ค่าไฟฟ้า / ค่าโทรศัพท์ (รายเดือน)
//  บันทึก หน่วยที่ใช้ + จำนวนเงิน แยกตามเดือนของปีงบที่เลือก
// ============================================================
(function () {
  const TYPES = [
    { v: 'water', l: 'ค่าน้ำ' },
    { v: 'electric', l: 'ค่าไฟฟ้า' },
    { v: 'phone', l: 'ค่าโทรศัพท์' },
  ];
  const typeLabel = v => (TYPES.find(t => t.v === v) || {}).l || v;

  // เดือนทั้ง 12 ของปีงบ (ต.ค. ปีก่อน → ก.ย. ปีงบ) เป็น 'YYYY-MM'
  function fyMonths(fy) {
    const endY = fy - 543, startY = endY - 1, arr = [];
    for (let m = 10; m <= 12; m++) arr.push(startY + '-' + String(m).padStart(2, '0'));
    for (let m = 1; m <= 9; m++) arr.push(endY + '-' + String(m).padStart(2, '0'));
    return arr;
  }

  function cell(bills, ym, type) {
    return bills.filter(b => (b.bill_month || '').slice(0, 7) === ym && b.type === type)
      .reduce((a, b) => ({ units: a.units + Number(b.units || 0), amount: a.amount + Number(b.amount || 0) }), { units: 0, amount: 0 });
  }

  async function reload() { await Store.loadAll(); App.go('reg-utility'); }

  function render(c) {
    const s = Store.data().school || {};
    const bills = Store.utilitiesFY();

    const tools = U.el(`<div class="toolbar no-print">
      <div class="spacer"></div>
      <button class="btn primary" id="addBtn">+ เพิ่มบิล</button>
      <button class="btn print" id="printBtn">🖨️ พิมพ์ A4</button>
      <button class="btn excel" id="xlsBtn">⬇️ Excel</button>
    </div>`);
    tools.querySelector('#addBtn').onclick = () => editBill(null);
    tools.querySelector('#printBtn').onclick = () => window.print();
    tools.querySelector('#xlsBtn').onclick = () => exportExcel(bills, s);
    c.appendChild(tools);

    c.appendChild(buildManage(bills));
    c.appendChild(buildRegister(bills, false));
    c.appendChild(buildRegister(bills, true));
  }

  // ----- รายการบิล (แก้ไข/ลบ) -----
  function buildManage(bills) {
    const card = U.el(`<div class="card no-print"><h3>รายการบิลค่าสาธารณูปโภค (ปีงบ ${Store.getFY()})</h3>
      <div class="sub">บันทึกแต่ละเดือน — กด “+ เพิ่มบิล” เพื่อเพิ่ม</div>
      <div class="table-wrap"><table class="data"><thead><tr>
      <th style="width:150px">เดือน</th><th>ประเภท</th><th class="num">หน่วยที่ใช้</th><th class="num">จำนวนเงิน</th><th>หมายเหตุ</th><th style="width:90px"></th>
      </tr></thead><tbody></tbody></table></div></div>`);
    const tb = card.querySelector('tbody');
    const sorted = bills.slice().sort((a, b) => (a.bill_month < b.bill_month ? 1 : a.bill_month > b.bill_month ? -1 : 0));
    if (!sorted.length) tb.appendChild(U.el('<tr><td colspan="6"><div class="empty">ยังไม่มีบิล — กด “+ เพิ่มบิล”</div></td></tr>'));
    sorted.forEach(b => {
      const tr = U.el(`<tr>
        <td><b>${U.esc(U.thaiMonthYear(b.bill_month))}</b></td>
        <td>${U.esc(typeLabel(b.type))}</td>
        <td class="num">${U.money0(b.units)}</td>
        <td class="num money-out">${U.money(b.amount)}</td>
        <td>${U.esc(b.note || '')}</td>
        <td><div class="row-actions"><button class="icon-btn">✏️</button><button class="icon-btn del">🗑️</button></div></td></tr>`);
      tr.querySelectorAll('button')[0].onclick = () => editBill(b);
      tr.querySelectorAll('button')[1].onclick = () => {
        App.confirmDialog(`ลบบิล ${typeLabel(b.type)} เดือน ${U.thaiMonthYear(b.bill_month)} ?`, async () => {
          try { await Store.remove('utility_bills', b.id); U.toast('ลบแล้ว'); await reload(); }
          catch (e) { U.toast('ลบไม่สำเร็จ: ' + (e.message || e), 'err'); }
        });
      };
      tb.appendChild(tr);
    });
    return card;
  }

  function editBill(b) {
    App.formModal({
      width: '560px',
      title: b ? 'แก้ไขบิล' : 'เพิ่มบิลค่าสาธารณูปโภค',
      fields: [
        { name: 'bill_month', label: 'เดือนของบิล', type: 'month', required: true },
        { name: 'type', label: 'ประเภท', type: 'select', options: TYPES.map(t => ({ value: t.v, label: t.l })) },
        { name: 'units', label: 'หน่วยที่ใช้', type: 'number', step: '0.01' },
        { name: 'amount', label: 'จำนวนเงิน (บาท)', type: 'number', step: '0.01' },
        { name: 'note', label: 'หมายเหตุ', col: 1 },
      ],
      values: b ? Object.assign({}, b, { bill_month: (b.bill_month || '').slice(0, 7) })
        : { bill_month: U.ymOf(U.todayISO()), type: 'electric', units: 0, amount: 0 },
      onSubmit: async (v) => {
        v.bill_month = (v.bill_month || '').slice(0, 7);
        if (!v.bill_month) { U.toast('กรุณาเลือกเดือน', 'err'); throw new Error('no month'); }
        if (b) await Store.update('utility_bills', b.id, v); else await Store.insert('utility_bills', v);
        U.toast('บันทึกบิลแล้ว'); await reload();
      },
    });
  }

  // ----- ทะเบียนรายเดือน (จอ/พิมพ์) -----
  function buildRegister(bills, forPrint) {
    const months = fyMonths(Store.getFY());
    const wrap = forPrint
      ? U.el('<div class="print-only sheet"></div>')
      : U.el('<div class="card no-print"><h3>ทะเบียนคุมค่าสาธารณูปโภค (รายเดือน)</h3><div class="table-wrap"></div></div>');
    if (forPrint) {
      const s = Store.data().school || {};
      wrap.appendChild(U.el(`<div class="doc-head">
        <div class="fy">ปีงบประมาณ ${Store.getFY()}</div>
        <img class="doc-logo" src="assets/logo.png" alt="">
        <div class="t1">ทะเบียนคุมค่าสาธารณูปโภค (ค่าน้ำ / ค่าไฟฟ้า / ค่าโทรศัพท์)</div>
        <div class="t2">${U.esc(s.name || '')} ${U.esc(s.district || '')} จังหวัด${U.esc(s.province || '')}</div>
      </div>`));
    }
    const cls = forPrint ? 'reg' : 'data';
    const subHead = TYPES.map(() => '<th class="num">หน่วย</th><th class="num">บาท</th>').join('');
    const typeHead = TYPES.map(t => `<th colspan="2">${U.esc(t.l)}</th>`).join('');
    const table = U.el(`<table class="${cls}">
      <thead>
        <tr><th rowspan="2" style="width:130px">เดือน</th>${typeHead}<th rowspan="2" class="num">รวม (บาท)</th></tr>
        <tr>${subHead}</tr>
      </thead><tbody></tbody><tfoot></tfoot></table>`);
    const tb = table.querySelector('tbody');
    const tot = {}; TYPES.forEach(t => tot[t.v] = { units: 0, amount: 0 }); let grand = 0;
    months.forEach(ym => {
      let rowAmt = 0;
      const cells = TYPES.map(t => {
        const cv = cell(bills, ym, t.v);
        tot[t.v].units += cv.units; tot[t.v].amount += cv.amount; rowAmt += cv.amount;
        return `<td class="num">${U.money0(cv.units)}</td><td class="num">${U.money0(cv.amount)}</td>`;
      }).join('');
      grand += rowAmt;
      tb.appendChild(U.el(`<tr><td${forPrint ? ' class="c"' : ''}>${U.esc(U.thaiMonthYear(ym))}</td>${cells}<td class="num">${U.money0(rowAmt)}</td></tr>`));
    });
    const footCells = TYPES.map(t => `<td class="num">${U.money0(tot[t.v].units)}</td><td class="num">${U.money(tot[t.v].amount)}</td>`).join('');
    table.querySelector('tfoot').appendChild(U.el(`<tr class="sum" style="font-weight:700;background:#f7f9fe"><td${forPrint ? ' class="c"' : ''}>รวมทั้งปี</td>${footCells}<td class="num">${U.money(grand)}</td></tr>`));

    if (forPrint) {
      wrap.appendChild(table);
      if (window.TxnEditor && window.TxnEditor.signRow) wrap.appendChild(window.TxnEditor.signRow(Store.data().school || {}));
    } else {
      wrap.querySelector('.table-wrap').appendChild(table);
    }
    return wrap;
  }

  // ----- ส่งออก Excel -----
  function exportExcel(bills, s) {
    const months = fyMonths(Store.getFY());
    const h1 = ['เดือน']; TYPES.forEach(t => { h1.push(t.l + ' (หน่วย)'); h1.push(t.l + ' (บาท)'); }); h1.push('รวม (บาท)');
    const aoa = [[`ทะเบียนคุมค่าสาธารณูปโภค  ${s.name || ''}  ปีงบประมาณ ${Store.getFY()}`], [], h1];
    const tot = {}; TYPES.forEach(t => tot[t.v] = { units: 0, amount: 0 }); let grand = 0;
    months.forEach(ym => {
      const row = [U.thaiMonthYear(ym)]; let rowAmt = 0;
      TYPES.forEach(t => { const cv = cell(bills, ym, t.v); tot[t.v].units += cv.units; tot[t.v].amount += cv.amount; rowAmt += cv.amount; row.push(cv.units, cv.amount); });
      row.push(rowAmt); grand += rowAmt; aoa.push(row);
    });
    const foot = ['รวมทั้งปี']; TYPES.forEach(t => foot.push(tot[t.v].units, tot[t.v].amount)); foot.push(grand);
    aoa.push(foot);
    const nCols = 1 + TYPES.length * 2 + 1;
    const numCols = []; for (let i = 1; i < nCols; i++) numCols.push(i);
    const cols = [16].concat(TYPES.flatMap(() => [10, 12])).concat([13]);
    const lastCol = XLSX.utils.encode_col(nCols - 1);
    Exporter.download('ทะเบียนค่าสาธารณูปโภค.xlsx', 'ค่าสาธารณูปโภค', aoa, { cols, numCols, merges: ['A1:' + lastCol + '1'] });
  }

  App.register('reg-utility', {
    title: 'ทะเบียนค่าสาธารณูปโภค',
    subtitle: 'ค่าน้ำ / ค่าไฟฟ้า / ค่าโทรศัพท์ รายเดือน (หน่วยที่ใช้ + จำนวนเงิน)',
    render,
  });
})();
