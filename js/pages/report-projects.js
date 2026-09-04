// ============================================================
//  รายงานงบโครงการ — งบที่ได้รับ vs รายจ่ายจริง vs คงเหลือ (ต่อโครงการ)
//  "ใช้ไปจริง" = ผลรวมรายจ่าย (amount_out) ของรายการที่ผูกกับโครงการนั้น
// ============================================================
(function () {

  // ผูกกับโครงการ: ตรง project_id หรือ (ไม่มี id แต่ชื่อ project ตรง) เพื่อครอบคลุมรายการเดิม
  function spentOf(p, txns) {
    const nm = (p.name || '').trim();
    return txns.reduce((s, t) => {
      const linked = t.project_id === p.id || (!t.project_id && (t.project || '').trim() === nm);
      return linked ? s + Number(t.amount_out || 0) : s;
    }, 0);
  }

  function computeRows() {
    const txns = Store.txnsFY();
    return Store.projectsFY().map((p, i) => {
      const budget = Number(p.budget || 0) + Number(p.budget_adjust || 0); // งบสุทธิ = รวม + เพิ่ม/ปรับ
      const spent = spentOf(p, txns);
      return { no: i + 1, p, budget, spent, remain: budget - spent };
    });
  }

  function render(c) {
    const s = Store.data().school || {};
    const rows = computeRows();

    const tools = U.el(`<div class="toolbar no-print">
      <div class="spacer"></div>
      <button class="btn print" id="printBtn">🖨️ พิมพ์ A4</button>
      <button class="btn excel" id="xlsBtn">⬇️ Excel</button>
    </div>`);
    tools.querySelector('#printBtn').onclick = () => window.print();
    tools.querySelector('#xlsBtn').onclick = () => exportExcel(rows, s);
    c.appendChild(tools);

    c.appendChild(buildScreen(rows));
    c.appendChild(buildPrintSheet(rows, s));
  }

  // ----- ตารางบนจอ -----
  function buildScreen(rows) {
    const tBudget = rows.reduce((a, r) => a + r.budget, 0);
    const tSpent = rows.reduce((a, r) => a + r.spent, 0);
    const tRemain = tBudget - tSpent;

    const card = U.el(`<div class="card no-print"><div class="table-wrap"><table class="data">
      <thead><tr>
        <th style="width:44px">ที่</th><th>โครงการ</th>
        <th class="num">งบสุทธิ</th><th class="num">ใช้ไป (จ่ายจริง)</th><th class="num">คงเหลือ</th><th style="width:150px">ใช้ไป %</th>
      </tr></thead><tbody id="rb"></tbody>
      <tfoot><tr style="font-weight:700;background:#f7f9fe">
        <td colspan="2" style="text-align:right">รวมทั้งสิ้น (${rows.length} โครงการ)</td>
        <td class="num">${U.money(tBudget)}</td><td class="num">${U.money(tSpent)}</td>
        <td class="num" style="color:${tRemain < 0 ? '#c0392b' : 'inherit'}">${U.money(tRemain)}</td><td></td>
      </tr></tfoot>
      </table></div></div>`);
    const b = card.querySelector('#rb');
    if (!rows.length) {
      b.appendChild(U.el('<tr><td colspan="6"><div class="empty">ยังไม่มีโครงการ — ไปที่ ข้อมูลหลัก → 📁 โครงการ เพื่อเพิ่มหรือนำเข้า CSV</div></td></tr>'));
      return card;
    }
    rows.forEach(r => {
      const pct = r.budget > 0 ? Math.min(100, Math.round(r.spent / r.budget * 100)) : 0;
      const over = r.remain < 0;
      const barColor = over ? '#c0392b' : pct >= 90 ? '#e67e22' : '#2e86de';
      const tr = U.el(`<tr>
        <td class="c">${r.no}</td>
        <td><b>${U.esc(r.p.name)}</b>${r.p.note ? `<div class="sub" style="font-size:12px">${U.esc(r.p.note)}</div>` : ''}</td>
        <td class="num">${U.money(r.budget)}</td>
        <td class="num money-out">${U.money(r.spent)}</td>
        <td class="num" style="color:${over ? '#c0392b' : 'inherit'};font-weight:600">${U.money(r.remain)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:8px;background:#eef1f6;border-radius:5px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${barColor}"></div>
            </div>
            <span style="font-size:12px;min-width:34px;text-align:right">${r.budget > 0 ? pct + '%' : '—'}</span>
          </div>
        </td></tr>`);
      b.appendChild(tr);
    });
    return card;
  }

  // ----- แผ่นพิมพ์ A4 -----
  function buildPrintSheet(rows, s) {
    const sheet = U.el('<div class="print-only sheet"></div>');
    sheet.appendChild(U.el(`<div class="doc-head">
      <div class="fy">ปีงบประมาณ ${Store.getFY()}</div>
      <div class="t1">รายงานงบโครงการ (งบที่ได้รับ / จ่ายจริง / คงเหลือ)</div>
      <div class="t2">${U.esc(s.name || '')} ${U.esc(s.district || '')} จังหวัด${U.esc(s.province || '')}</div>
    </div>`));
    const table = U.el(`<table class="reg"><thead><tr>
      <th style="width:6%">ที่</th><th>โครงการ</th>
      <th style="width:18%">งบสุทธิ</th><th style="width:18%">จ่ายจริง</th><th style="width:18%">คงเหลือ</th>
    </tr></thead><tbody></tbody></table>`);
    const tb = table.querySelector('tbody');
    let tB = 0, tS = 0;
    rows.forEach(r => {
      tB += r.budget; tS += r.spent;
      tb.appendChild(U.el(`<tr>
        <td class="c">${r.no}</td>
        <td>${U.esc(r.p.name)}</td>
        <td class="num">${U.money(r.budget)}</td>
        <td class="num">${U.money(r.spent)}</td>
        <td class="num">${U.money(r.remain)}</td></tr>`));
    });
    if (!rows.length) tb.appendChild(U.el('<tr><td colspan="5" class="c" style="padding:20px;color:#999">— ไม่มีโครงการ —</td></tr>'));
    tb.appendChild(U.el(`<tr class="sum"><td colspan="2" class="c">รวมทั้งสิ้น</td>
      <td class="num">${U.money(tB)}</td><td class="num">${U.money(tS)}</td><td class="num">${U.money(tB - tS)}</td></tr>`));
    sheet.appendChild(table);
    if (window.TxnEditor && window.TxnEditor.signRow) sheet.appendChild(window.TxnEditor.signRow(s));
    return sheet;
  }

  // ----- ส่งออก Excel -----
  function exportExcel(rows, s) {
    const aoa = [
      [`รายงานงบโครงการ  ${s.name || ''}  ปีงบประมาณ ${Store.getFY()}`],
      [],
      ['ที่', 'โครงการ', 'งบสุทธิ', 'จ่ายจริง', 'คงเหลือ'],
    ];
    let tB = 0, tS = 0;
    rows.forEach(r => {
      tB += r.budget; tS += r.spent;
      aoa.push([r.no, r.p.name, r.budget, r.spent, r.remain]);
    });
    aoa.push(['', 'รวมทั้งสิ้น', tB, tS, tB - tS]);
    Exporter.download('รายงานงบโครงการ.xlsx', 'งบโครงการ', aoa,
      { cols: [5, 40, 16, 16, 16], numCols: [2, 3, 4], merges: ['A1:E1'] });
  }

  App.register('report-projects', {
    title: 'รายงานงบโครงการ',
    subtitle: 'เปรียบเทียบงบที่ได้รับ กับ รายจ่ายจริง และคงเหลือ ต่อโครงการ',
    render,
  });
})();
