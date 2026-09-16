// ============================================================
//  รายงานเงินคงเหลือประจำวัน
// ============================================================
(function () {
  let reportDate = U.todayISO();
  let reportNote = '';

  function normalize(v) { return String(v || '').toLowerCase().replace(/\s+/g, ''); }
  const REPORT_NAMES = [
    ['เงินรายได้แผ่นดิน', ['raidai_pandin', 'รายได้แผ่นดิน']],
    ['ดอกเบี้ยเงินอุดหนุน', ['ดอกเบี้ยเงินอุดหนุน']],
    ['ดอกเบี้ยเงินอาหารกลางวัน', ['ดอกเบี้ยเงินอาหารกลางวัน', 'ดอกเบี้ยอาหารกลางวัน']],
    ['ภาษีหัก ณ ที่จ่าย', ['ภาษีหักณที่จ่าย', 'ภาษีหัก']],
    ['เงินประกันสัญญา (เงินส่วนราชการเป็นผู้เบิก)', ['เงินประกันสัญญา', 'ประกันสัญญา']],
    ['เงินรายได้สถานศึกษา', ['raidai', 'เงินรายได้สถานศึกษา', 'รายได้สถานศึกษา']],
    ['เงินบริจาคกองทุนเพื่อการศึกษา', ['kongtun', 'เงินบริจาคกองทุน', 'กองทุนเพื่อการศึกษา']],
    ['เงินอุดหนุนรายหัวอนุบาล', ['anuban_udnun', 'อนุบาลอุดหนุน', 'อุดหนุนรายหัวอนุบาล']],
    ['เงินอุดหนุนรายหัวประถม', ['prathom_udnun', 'ประถมอุดหนุน', 'อุดหนุนรายหัวประถม']],
    ['เงินกิจกรรมพัฒนาผู้เรียน', ['pattana', 'กิจกรรมพัฒนาผู้เรียน']],
    ['เงินค่าหนังสือเรียน', ['book', 'หนังสือเรียน']],
    ['เงินค่าเครื่องแบบนักเรียน', ['uniform', 'เครื่องแบบนักเรียน']],
    ['เงินค่าอุปกรณ์การเรียน', ['upakorn', 'อุปกรณ์การเรียน']],
    ['เงินอุดหนุนปัจจัยพื้นฐานนักเรียนยากจน', ['yakjon', 'ปัจจัยพื้นฐานนักเรียนยากจน']],
    ['เงินอุดหนุนนักเรียนยากจนพิเศษแบบมีเงื่อนไข', ['yakjon_special', 'ยากจนพิเศษ', 'แบบมีเงื่อนไข']],
    ['เงินอุดหนุนโครงการอาหารกลางวัน', ['ahan_klangwan', 'โครงการอาหารกลางวัน', 'อาหารกลางวัน']],
  ];
  const MAPPING_KEY = 'dailyBalanceAccountMapping';
  function mappingData() {
    try { return JSON.parse(localStorage.getItem(MAPPING_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveMapping(data) {
    localStorage.setItem(MAPPING_KEY, JSON.stringify(data));
  }
  function inferredName(a) {
    const text = normalize(`${a.code || ''} ${a.name || ''}`);
    return (REPORT_NAMES.find(([, keys]) => keys.some(k => text.includes(normalize(k)))) || [a.name || 'ไม่ระบุชื่อบัญชี'])[0];
  }
  function officialName(a) {
    const setting = mappingData()[a.id] || {};
    return String(setting.label || setting.target || inferredName(a)).trim();
  }
  function isBudgetAccount(a) {
    const target = (mappingData()[a.id] || {}).target;
    if (target) return REPORT_NAMES.slice(0, 3).some(([name]) => name === target);
    const text = normalize(`${a.category || ''} ${a.name || ''} ${a.code || ''}`);
    return text.includes('เงินงบประมาณ') || text.includes('budget') || text.includes('รายได้แผ่นดิน') ||
      text.includes('raidai_pandin') || text.includes('ดอกเบี้ยเงินอุดหนุน') || text.includes('ดอกเบี้ยอาหารกลางวัน') ||
      text.includes('ดอกเบี้ยเงินอาหารกลางวัน');
  }

  function rowsAt(date) {
    const D = Store.data();
    return D.accounts.filter(a => a.active !== false).map(a => {
      const useOpening = !a.opening_date || a.opening_date <= date;
      const bal = {
        cash: useOpening ? Number(a.opening_cash || 0) : 0,
        bank: useOpening ? Number(a.opening_bank || 0) : 0,
        gov: useOpening ? Number(a.opening_govdeposit || 0) : 0,
      };
      D.transactions.filter(t => t.account_id === a.id && t.txn_date <= date &&
        (!a.opening_date || t.txn_date >= a.opening_date)).forEach(t => {
        const key = t.bal_type === 'cash' ? 'cash' : t.bal_type === 'govdeposit' ? 'gov' : 'bank';
        bal[key] += Number(t.amount_in || 0) - Number(t.amount_out || 0);
      });
      return { account: a, ...bal, total: bal.cash + bal.bank + bal.gov };
    }).sort((a, b) => Number(a.account.sort || 0) - Number(b.account.sort || 0));
  }

  function totals(rows) {
    return rows.reduce((s, r) => ({ cash: s.cash + r.cash, bank: s.bank + r.bank,
      gov: s.gov + r.gov, total: s.total + r.total }), { cash: 0, bank: 0, gov: 0, total: 0 });
  }

  function accountHierarchy(rows) {
    const D = Store.data();
    const byParent = new Map();
    rows.forEach(r => {
      const parentId = r.account.school_account_id || '';
      if (!byParent.has(parentId)) byParent.set(parentId, []);
      byParent.get(parentId).push(r);
    });
    const parentIds = new Set(D.schoolAccounts.map(a => a.id));
    const parents = [...D.schoolAccounts]
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
      .map(account => {
        const children = byParent.get(account.id) || [];
        return { account, children, ...totals(children) };
      });
    const unassigned = [...(byParent.get('') || [])];
    byParent.forEach((children, parentId) => {
      if (parentId && !parentIds.has(parentId)) unassigned.push(...children);
    });
    return { parents, unassigned, all: totals(rows) };
  }

  function groupedRows(rows) {
    const grouped = new Map();
    rows.forEach(r => {
      const name = officialName(r.account);
      const key = `${isBudgetAccount(r.account) ? 'budget' : 'other'}|${name}`;
      if (!grouped.has(key)) grouped.set(key, { account: r.account, name, budget: isBudgetAccount(r.account), cash: 0, bank: 0, gov: 0, total: 0 });
      const g = grouped.get(key);
      g.cash += r.cash; g.bank += r.bank; g.gov += r.gov; g.total += r.total;
    });
    const order = new Map(REPORT_NAMES.map(([name], i) => [name, i]));
    return [...grouped.values()].sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999) || Number(a.account.sort || 0) - Number(b.account.sort || 0));
  }

  function thaiBahtText(value) {
    const number = Math.abs(Number(value || 0)).toFixed(2);
    const [integer, satang] = number.split('.');
    const digit = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const unit = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
    function underMillion(text) {
      const chars = text.replace(/^0+/, '').split('');
      if (!chars.length) return '';
      return chars.map((c, i) => {
        const n = Number(c), pos = chars.length - i - 1;
        if (!n) return '';
        if (pos === 1 && n === 1) return 'สิบ';
        if (pos === 1 && n === 2) return 'ยี่สิบ';
        if (pos === 0 && n === 1 && chars.length > 1) return 'เอ็ด';
        return digit[n] + unit[pos];
      }).join('');
    }
    function integerText(text) {
      if (text === '0') return 'ศูนย์';
      if (text.length <= 6) return underMillion(text);
      return integerText(text.slice(0, -6)) + 'ล้าน' + underMillion(text.slice(-6));
    }
    const prefix = Number(value) < 0 ? 'ลบ' : '';
    return prefix + integerText(integer) + 'บาท' + (satang === '00' ? 'ถ้วน' : underMillion(satang) + 'สตางค์');
  }

  function reportNode(date) {
    const s = Store.data().school || {}, rows = groupedRows(rowsAt(date)), grand = totals(rows);
    const node = U.el(`<section class="daily-balance-page" id="dailyBalanceDocument">
      <div class="report-top"><div class="report-fy">ปีงบประมาณ ${Store.getFY()}</div>
        <div class="report-org">ส่วนราชการ ${U.esc(s.name || '')}</div>
        <div class="report-title">รายงานเงินคงเหลือประจำวัน</div></div>
    <table class="daily-balance-table"><thead><tr><th style="width:38%">ประเภท</th><th style="width:10%">เงินสด</th>
        <th style="width:13%">เงินฝากธนาคาร</th><th style="width:11%">เงินฝาก<br>ส่วนราชการผู้เบิก</th><th style="width:11%">รวม</th><th style="width:17%">หมายเหตุ</th></tr></thead><tbody></tbody></table>
      <div class="daily-balance-words"><b>รวมเป็นเงิน</b>&nbsp;&nbsp; (${U.esc(thaiBahtText(grand.total))})</div>
      <div class="daily-balance-signatures"><div class="sign-two">
        <div>ลงชื่อ........................................ ผู้จัดทำรายการ<br>(${U.esc(s.finance_officer || '')})<br>ตำแหน่ง ครู</div>
        <div>ลงชื่อ........................................ ผู้ตรวจ<br>(${U.esc(s.auditor || '')})<br>ตำแหน่ง ครู</div></div>
        <div>คณะกรรมการเก็บรักษาเงินได้ตรวจนับเงินสดคงเหลือประจำวันถูกต้อง ตามรายการข้างต้นแล้ว และได้นำเงินสดเก็บรักษาไว้ในตู้นิรภัยเป็นที่เรียบร้อยแล้ว</div>
        <div class="committee">${[1,2,3].map(() => '<div><div class="line"></div>กรรมการ</div>').join('')}</div>
        <div class="sign-one">ลงชื่อ........................................ หัวหน้าหน่วยงานย่อย<br>(${U.esc(s.director || '')})<br>ตำแหน่ง ผู้อำนวยการ${U.esc(s.name || 'โรงเรียน')}</div></div>
    </section>`);
    const body = node.querySelector('tbody');
    const noteLines = String(reportNote || '').split(/\r?\n/);
    [['เงินงบประมาณ', rows.filter(r => isBudgetAccount(r.account)), false],
      ['เงินนอกงบประมาณ', rows.filter(r => !isBudgetAccount(r.account)), true]].forEach(([label, group, showNote]) => {
      body.appendChild(U.el(`<tr class="section"><td colspan="6">${label}</td></tr>`));
      if (!group.length) body.appendChild(U.el('<tr><td>ไม่มีรายการ</td><td class="num">-</td><td class="num">-</td><td class="num">-</td><td class="num">-</td><td></td></tr>'));
      group.forEach((r, i) => {
        const note = showNote ? (i === group.length - 1 ? noteLines.slice(i).join('\n') : (noteLines[i] || '')) : '';
        body.appendChild(U.el(`<tr><td>${U.esc(r.name)}</td><td class="num">${U.money0(r.cash) || '-'}</td>
          <td class="num">${U.money0(r.bank) || '-'}</td><td class="num">${U.money0(r.gov) || '-'}</td><td class="num">${U.money0(r.total) || '-'}</td>
          <td class="daily-report-note">${U.esc(note)}</td></tr>`));
      });
    });
    body.appendChild(U.el(`<tr class="total"><td class="c">รวมเป็นเงิน</td><td class="num">${U.money(grand.cash)}</td><td class="num">${U.money(grand.bank)}</td>
      <td class="num">${U.money(grand.gov)}</td><td class="num">${U.money(grand.total)}</td><td></td></tr>`));
    return node;
  }

  function mappingPanel(date, rebuild) {
    const rows = rowsAt(date), saved = mappingData(), hierarchy = accountHierarchy(rows);
    const panel = U.el(`<div class="card no-print daily-mapping-panel">
      <div class="daily-mapping-head"><div><h3>ตั้งค่าบัญชีโรงเรียนสำหรับรายงาน</h3>
        <div class="sub">บัญชีหลักดึงจากข้อมูลโรงเรียน โดยทะเบียนคุมจะแสดงเป็นรายการย่อย ยอดบัญชีหลักคำนวณจากผลรวมทะเบียนย่อยโดยไม่นับซ้ำ</div></div>
        <button class="btn ghost sm" id="resetMapping">คืนค่าจับคู่อัตโนมัติ</button></div>
      <div class="table-wrap"><table class="data daily-mapping-table"><thead><tr>
        <th>บัญชีหลัก / ทะเบียนคุมย่อย</th><th>นำไปรวมในรายการ</th><th>ชื่อที่แสดงในรายงาน</th>
        <th class="num">เงินสด</th><th class="num">เงินฝากธนาคาร</th><th class="num">ฝากส่วนราชการ</th><th class="num">รวม</th>
      </tr></thead><tbody></tbody></table></div>
      <div class="mapping-hint">ยอดแถวบัญชีหลักเป็นผลรวมเพื่อการตรวจสอบเท่านั้น สูตรรายงานจะรวมจากทะเบียนคุมย่อยแต่ละรายการเพียงครั้งเดียว</div>
    </div>`);
    const body = panel.querySelector('tbody');
    const appendLedger = r => {
      const current = saved[r.account.id] || {};
      const target = current.target || inferredName(r.account);
      const label = current.label || target;
      const tr = U.el(`<tr class="mapping-ledger-row"><td><div class="mapping-ledger-name"><span class="mapping-tree">└</span><div><b>${U.esc(r.account.name || '')}</b><div class="sub">ทะเบียนคุม · ${U.esc(r.account.code || r.account.id || '')}</div></div></div></td>
        <td><select class="mapping-target"></select></td>
        <td><input class="mapping-label" value="${U.esc(label)}" aria-label="ชื่อที่แสดงของ ${U.esc(r.account.name || '')}"></td>
        <td class="num">${U.money(r.cash)}</td><td class="num">${U.money(r.bank)}</td><td class="num">${U.money(r.gov)}</td><td class="num"><b>${U.money(r.total)}</b></td></tr>`);
      const select = tr.querySelector('.mapping-target');
      REPORT_NAMES.forEach(([name]) => select.appendChild(U.el(`<option value="${U.esc(name)}" ${name === target ? 'selected' : ''}>${U.esc(name)}</option>`)));
      const storeRow = () => {
        const data = mappingData();
        data[r.account.id] = { target: select.value, label: tr.querySelector('.mapping-label').value.trim() || select.value };
        saveMapping(data); rebuild();
      };
      select.onchange = () => { tr.querySelector('.mapping-label').value = select.value; storeRow(); };
      tr.querySelector('.mapping-label').onchange = storeRow;
      body.appendChild(tr);
    };
    const appendParent = (parent, children, sum) => {
      body.appendChild(U.el(`<tr class="mapping-parent-row"><td><div class="mapping-parent-name"><span>🏦</span><div><b>${U.esc(parent.name || '')}</b><div class="sub">บัญชีหลัก${parent.account_no ? ` · ${U.esc(parent.account_no)}` : ''}</div></div></div></td>
        <td colspan="2"><span class="mapping-child-count">${children.length} ทะเบียนคุมย่อย</span></td>
        <td class="num">${U.money(sum.cash)}</td><td class="num">${U.money(sum.bank)}</td><td class="num">${U.money(sum.gov)}</td><td class="num"><b>${U.money(sum.total)}</b></td></tr>`));
      if (!children.length) body.appendChild(U.el('<tr class="mapping-empty-row"><td colspan="7">ยังไม่มีทะเบียนคุมภายใต้บัญชีหลักนี้</td></tr>'));
      children.forEach(appendLedger);
    };
    hierarchy.parents.forEach(p => appendParent(p.account, p.children, p));
    if (hierarchy.unassigned.length) {
      const sum = totals(hierarchy.unassigned);
      appendParent({ name: 'ยังไม่จัดเข้าบัญชีหลัก' }, hierarchy.unassigned, sum);
    }
    if (!hierarchy.parents.length && !hierarchy.unassigned.length) {
      body.appendChild(U.el('<tr><td colspan="7"><div class="empty">ยังไม่มีบัญชีหลักหรือทะเบียนคุม</div></td></tr>'));
    }
    body.appendChild(U.el(`<tr class="mapping-grand-row"><td colspan="3">รวมทุกบัญชีหลัก</td><td class="num">${U.money(hierarchy.all.cash)}</td>
      <td class="num">${U.money(hierarchy.all.bank)}</td><td class="num">${U.money(hierarchy.all.gov)}</td><td class="num"><b>${U.money(hierarchy.all.total)}</b></td></tr>`));
    panel.querySelector('#resetMapping').onclick = () => { localStorage.removeItem(MAPPING_KEY); rebuild(); U.toast('คืนค่าการจับคู่อัตโนมัติแล้ว'); };
    return panel;
  }

  async function downloadPdf(node) {
    if (!window.html2pdf) { U.toast('ยังโหลดตัวสร้าง PDF ไม่สำเร็จ', 'err'); return; }
    U.toast('กำลังสร้างไฟล์ PDF...');
    // รอให้ Sarabun โหลดครบก่อน html2canvas วาดข้อความลง PDF
    if (document.fonts) {
      await Promise.all([
        document.fonts.load('400 16px Sarabun'),
        document.fonts.load('500 16px Sarabun'),
        document.fonts.load('600 16px Sarabun'),
        document.fonts.load('700 16px Sarabun'),
        document.fonts.ready
      ]);
    }
    await html2pdf().set({ margin: [8, 9, 8, 9], filename: `รายงานเงินคงเหลือประจำวัน_${reportDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(node).save();
  }

  function render(c) {
    const toolbar = U.el(`<div class="toolbar no-print"><div class="field"><label>วันที่รายงาน</label><input type="date" id="balanceDate" value="${reportDate}"></div>
      <div class="field daily-note-field"><label>หมายเหตุ (พิมพ์แยกบรรทัดได้)</label><textarea id="balanceNote" rows="3" placeholder="เช่น ไม่มีการรับจ่ายเงิน&#10;15 ส.ค. 69&#10;ถึง&#10;27 ส.ค. 69&#10;(ชื่อผู้รับผิดชอบ)"></textarea></div>
      <button class="btn ghost" id="refreshBalance">🔄 คำนวณใหม่</button><div class="spacer"></div>
      <button class="btn print" id="printBalance">🖨️ พิมพ์ A4</button><button class="btn primary" id="pdfBalance">⬇️ ดาวน์โหลด PDF</button></div>`);
    const card = U.el('<div class="card daily-balance-card"></div>');
    const mapping = U.el('<div></div>');
    const rebuild = () => {
      card.innerHTML = ''; card.appendChild(reportNode(reportDate));
      mapping.innerHTML = ''; mapping.appendChild(mappingPanel(reportDate, rebuild));
    };
    toolbar.querySelector('#balanceDate').onchange = e => { reportDate = e.target.value || U.todayISO(); rebuild(); };
    toolbar.querySelector('#balanceNote').oninput = e => { reportNote = e.target.value; rebuild(); };
    toolbar.querySelector('#refreshBalance').onclick = async () => { await App.reload(true); rebuild(); U.toast('ซิงค์และคำนวณยอดใหม่แล้ว'); };
    toolbar.querySelector('#printBalance').onclick = () => window.print();
    toolbar.querySelector('#pdfBalance').onclick = () => downloadPdf(card.querySelector('#dailyBalanceDocument'));
    c.append(toolbar, card, mapping); rebuild();
  }

  App.register('report-daily-balance', {
    title: 'รายงานเงินคงเหลือประจำวัน',
    subtitle: 'ซิงค์ยอดจากทุกบัญชี คำนวณถึงวันที่เลือก และดาวน์โหลดเป็น PDF A4',
    render,
  });
})();
