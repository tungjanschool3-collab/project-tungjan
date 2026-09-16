// ============================================================
//  ทะเบียนคุมใบเสร็จรับเงิน — ดึงรายรับทั้งหมด ยกเว้นดอกเบี้ย
//  เลขใบเสร็จเก็บใน notes ด้วยแท็กภายใน เพื่อรองรับฐานข้อมูลเดิม
// ============================================================
(function () {
  const RECEIPT_TAG = '[เลขใบเสร็จ] ';

  function receiptNoOf(t) {
    const line = String(t.notes || '').split(/\r?\n/).find(x => x.startsWith(RECEIPT_TAG));
    return line ? line.slice(RECEIPT_TAG.length).trim() : '';
  }

  function plainNoteOf(t) {
    return String(t.notes || '').split(/\r?\n/)
      .filter(line => !line.startsWith(RECEIPT_TAG) && !line.startsWith('[กิจกรรม] '))
      .join('\n').trim();
  }

  function notesWithReceipt(notes, receiptNo) {
    const lines = String(notes || '').split(/\r?\n/).filter(line => !line.startsWith(RECEIPT_TAG));
    if (receiptNo) lines.push(RECEIPT_TAG + receiptNo.trim());
    return lines.filter(Boolean).join('\n') || null;
  }

  function isInterest(t) {
    const acc = Store.accountById(t.account_id) || {};
    const haystack = [t.description, t.project, t.notes, t.doc_type, acc.name, acc.code]
      .map(v => String(v || '').toLocaleLowerCase('th')).join(' ');
    return haystack.includes('ดอกเบี้ย') || /\binterest\b/i.test(haystack);
  }

  function rowsOf() {
    return Store.txnsFY()
      .filter(t => Number(t.amount_in || 0) > 0 && !isInterest(t))
      .sort((a, b) => (a.txn_date < b.txn_date ? -1 : a.txn_date > b.txn_date ? 1 : 0) ||
        Number(a.doc_no || 0) - Number(b.doc_no || 0) ||
        String(a.created_at || '').localeCompare(String(b.created_at || '')));
  }

  function render(c) {
    const s = Store.data().school || {};
    const tools = U.el(`<div class="toolbar no-print">
      <div class="spacer"></div>
      <button class="btn print" id="printBtn">🖨️ พิมพ์ A4</button>
      <button class="btn excel" id="xlsBtn">⬇️ Excel ทั้งปี</button>
    </div>`);
    tools.querySelector('#printBtn').onclick = () => window.print();
    tools.querySelector('#xlsBtn').onclick = exportYear;
    c.appendChild(tools);
    c.appendChild(U.el('<div class="receipt-help no-print">แสดงรายรับทั้งปีงบประมาณเรียงตามวันที่ โดยไม่แยกเดือน · กรอกเลขใบเสร็จแล้วกด Enter หรือคลิกออกจากช่องเพื่อบันทึก · รายการดอกเบี้ยจะไม่ถูกนำมาแสดง</div>'));
    c.appendChild(buildSheet(rowsOf(), s));
  }

  function buildSheet(rows, s) {
    const wrap = U.el('<div class="card"><div class="sheet receipt-sheet"></div></div>');
    const sheet = wrap.querySelector('.sheet');
    sheet.appendChild(U.el(`<div class="doc-head">
      <div class="fy">ปีงบประมาณ ${Store.getFY()}</div><img class="doc-logo" src="assets/logo.png" alt="">
      <div class="t1">ทะเบียนคุมใบเสร็จรับเงิน</div>
      <div class="t2">${U.esc(s.name || '')} ${U.esc(s.district || '')} จังหวัด${U.esc(s.province || '')} ${U.esc(s.office || '')}</div>
    </div>`));
    const table = U.el(`<table class="reg receipt-reg"><colgroup>
      <col style="width:14%"><col style="width:18%"><col style="width:41%"><col style="width:14%"><col style="width:13%">
      </colgroup><thead><tr><th>วัน เดือน ปี</th><th>เลขที่ใบเสร็จรับเงิน</th><th>รายการ</th><th>จำนวนเงิน</th><th>หมายเหตุ</th></tr></thead><tbody></tbody></table>`);
    const tb = table.querySelector('tbody');
    let total = 0;
    rows.forEach(t => {
      const amount = Number(t.amount_in || 0); total += amount;
      const receiptNo = receiptNoOf(t);
      const tr = U.el(`<tr>
        <td class="c receipt-date">${U.esc(U.thaiDate(t.txn_date))}</td>
        <td class="receipt-no-cell"><input class="receipt-no-input no-print" type="text" value="${U.esc(receiptNo)}" aria-label="เลขที่ใบเสร็จของ ${U.esc(t.description || 'รายการรับเงิน')}"><span class="receipt-print-value">${U.esc(receiptNo)}</span></td>
        <td class="item-project-activity">${U.esc(U.itemProjectActivityText(t))}</td>
        <td class="num">${U.money(amount)}</td>
        <td class="receipt-note">${U.esc(plainNoteOf(t))}</td></tr>`);
      const input = tr.querySelector('.receipt-no-input');
      let savedValue = receiptNo;
      input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } };
      input.onchange = async () => {
        const next = input.value.trim();
        if (next === savedValue) return;
        input.disabled = true;
        try {
          const notes = notesWithReceipt(t.notes, next);
          await Store.update('transactions', t.id, { notes });
          t.notes = notes;
          savedValue = next;
          tr.querySelector('.receipt-print-value').textContent = next;
          U.toast('บันทึกเลขใบเสร็จแล้ว');
        } catch (e) {
          console.error(e);
          input.value = savedValue;
          U.toast('บันทึกเลขใบเสร็จไม่สำเร็จ: ' + (e.message || e), 'err');
        } finally { input.disabled = false; }
      };
      tb.appendChild(tr);
    });
    if (!rows.length) tb.appendChild(U.el('<tr><td colspan="5" class="c" style="padding:20px;color:#999">— ไม่มีรายการรายรับ (ไม่รวมดอกเบี้ย) ในปีงบประมาณนี้ —</td></tr>'));
    tb.appendChild(U.el(`<tr class="sum"><td colspan="3" class="c">รวมทั้งสิ้น</td><td class="num">${U.money(total)}</td><td></td></tr>`));
    sheet.appendChild(table);
    sheet.appendChild(window.TxnEditor.signRow(s));
    return wrap;
  }

  function aoaOf(rows, s) {
    const aoa = [
      [`ทะเบียนคุมใบเสร็จรับเงิน  ${s.name || ''}  ปีงบประมาณ ${Store.getFY()}`],
      [],
      ['วัน เดือน ปี', 'เลขที่ใบเสร็จรับเงิน', 'รายการ', 'จำนวนเงิน', 'หมายเหตุ'],
    ];
    let total = 0;
    rows.forEach(t => {
      const amount = Number(t.amount_in || 0); total += amount;
      aoa.push([U.thaiDate(t.txn_date), receiptNoOf(t), U.itemProjectActivityText(t), amount, plainNoteOf(t)]);
    });
    aoa.push(['', '', 'รวมทั้งสิ้น', total, '']);
    return aoa;
  }

  function exportYear() {
    const s = Store.data().school || {};
    const rows = rowsOf();
    if (!rows.length) { U.toast('ยังไม่มีข้อมูลรายรับที่ไม่ใช่ดอกเบี้ย', 'err'); return; }
    Exporter.download(`ทะเบียนคุมใบเสร็จรับเงิน_ปีงบประมาณ_${Store.getFY()}.xlsx`, 'ทะเบียนใบเสร็จ', aoaOf(rows, s),
      { cols: [16, 22, 58, 16, 20], numCols: [3], merges: ['A1:E1'] });
  }

  App.register('reg-receipts', {
    title: 'ทะเบียนคุมใบเสร็จรับเงิน',
    subtitle: 'แสดงรายรับทั้งปีงบประมาณเรียงต่อเนื่อง ยกเว้นดอกเบี้ย และกรอกเลขใบเสร็จได้เอง',
    render,
  });
})();
