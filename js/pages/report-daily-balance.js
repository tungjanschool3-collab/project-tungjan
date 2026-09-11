// ============================================================
//  รายงานเงินคงเหลือประจำวัน
// ============================================================
(function () {
  let reportDate = U.todayISO();

  function normalize(v) { return String(v || '').toLowerCase().replace(/\s+/g, ''); }
  function isBudgetAccount(a) {
    const text = normalize(`${a.category || ''} ${a.name || ''} ${a.code || ''}`);
    return text.includes('เงินงบประมาณ') || text.includes('budget');
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
    const s = Store.data().school || {}, rows = rowsAt(date), grand = totals(rows);
    const node = U.el(`<section class="daily-balance-page" id="dailyBalanceDocument">
      <div class="report-top"><div class="report-fy">ปีงบประมาณ ${Store.getFY()}</div>
        <div class="report-org">ส่วนราชการ ${U.esc(s.name || '')}</div>
        <div class="report-title">รายงานเงินคงเหลือประจำวัน</div>
        <div class="report-date">ประจำวันที่ ${U.thaiDate(date, { full: true, fullYear: true })}</div></div>
      <table class="daily-balance-table"><thead><tr><th style="width:34%">ประเภท</th><th style="width:13%">เงินสด</th>
        <th style="width:15%">เงินฝากธนาคาร</th><th style="width:16%">เงินฝาก<br>ส่วนราชการผู้เบิก</th><th style="width:13%">รวม</th><th>หมายเหตุ</th></tr></thead><tbody></tbody></table>
      <div class="daily-balance-words"><b>รวมเป็นเงิน</b>&nbsp;&nbsp; (${U.esc(thaiBahtText(grand.total))})</div>
      <div class="daily-balance-signatures"><div class="sign-two">
        <div>ลงชื่อ........................................ ผู้จัดทำรายการ<br>(${U.esc(s.finance_officer || '')})<br>ตำแหน่ง ครู</div>
        <div>ลงชื่อ........................................ ผู้ตรวจ<br>(${U.esc(s.auditor || '')})<br>ตำแหน่ง ครู</div></div>
        <div>คณะกรรมการเก็บรักษาเงินได้ตรวจนับเงินสดคงเหลือประจำวันถูกต้องตามรายงานข้างต้นแล้ว</div>
        <div class="committee">${[1,2,3].map(() => '<div><div class="line"></div>กรรมการ</div>').join('')}</div>
        <div class="sign-one">ลงชื่อ........................................ หัวหน้าหน่วยงานย่อย<br>(${U.esc(s.director || '')})<br>ตำแหน่ง ผู้อำนวยการ${U.esc(s.name || 'โรงเรียน')}</div></div>
    </section>`);
    const body = node.querySelector('tbody');
    [['เงินงบประมาณ', rows.filter(r => isBudgetAccount(r.account))],
      ['เงินนอกงบประมาณ', rows.filter(r => !isBudgetAccount(r.account))]].forEach(([label, group]) => {
      body.appendChild(U.el(`<tr class="section"><td colspan="6">${label}</td></tr>`));
      if (!group.length) body.appendChild(U.el('<tr><td>ไม่มีรายการ</td><td class="num">-</td><td class="num">-</td><td class="num">-</td><td class="num">-</td><td></td></tr>'));
      group.forEach(r => body.appendChild(U.el(`<tr><td>${U.esc(r.account.name)}</td><td class="num">${U.money0(r.cash) || '-'}</td>
        <td class="num">${U.money0(r.bank) || '-'}</td><td class="num">${U.money0(r.gov) || '-'}</td><td class="num">${U.money0(r.total) || '-'}</td><td></td></tr>`)));
    });
    body.appendChild(U.el(`<tr class="total"><td class="c">รวมเป็นเงิน</td><td class="num">${U.money(grand.cash)}</td><td class="num">${U.money(grand.bank)}</td>
      <td class="num">${U.money(grand.gov)}</td><td class="num">${U.money(grand.total)}</td><td></td></tr>`));
    return node;
  }

  async function downloadPdf(node) {
    if (!window.html2pdf) { U.toast('ยังโหลดตัวสร้าง PDF ไม่สำเร็จ', 'err'); return; }
    U.toast('กำลังสร้างไฟล์ PDF...');
    await html2pdf().set({ margin: [8, 9, 8, 9], filename: `รายงานเงินคงเหลือประจำวัน_${reportDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(node).save();
  }

  function render(c) {
    const toolbar = U.el(`<div class="toolbar no-print"><div class="field"><label>วันที่รายงาน</label><input type="date" id="balanceDate" value="${reportDate}"></div>
      <button class="btn ghost" id="refreshBalance">🔄 คำนวณใหม่</button><div class="spacer"></div>
      <button class="btn print" id="printBalance">🖨️ พิมพ์ A4</button><button class="btn primary" id="pdfBalance">⬇️ ดาวน์โหลด PDF</button></div>`);
    const card = U.el('<div class="card daily-balance-card"></div>');
    const rebuild = () => { card.innerHTML = ''; card.appendChild(reportNode(reportDate)); };
    toolbar.querySelector('#balanceDate').onchange = e => { reportDate = e.target.value || U.todayISO(); rebuild(); };
    toolbar.querySelector('#refreshBalance').onclick = async () => { await App.reload(true); rebuild(); U.toast('ซิงค์และคำนวณยอดใหม่แล้ว'); };
    toolbar.querySelector('#printBalance').onclick = () => window.print();
    toolbar.querySelector('#pdfBalance').onclick = () => downloadPdf(card.querySelector('#dailyBalanceDocument'));
    c.append(toolbar, card); rebuild();
  }

  App.register('report-daily-balance', {
    title: 'รายงานเงินคงเหลือประจำวัน',
    subtitle: 'ซิงค์ยอดจากทุกบัญชี คำนวณถึงวันที่เลือก และดาวน์โหลดเป็น PDF A4',
    render,
  });
})();
