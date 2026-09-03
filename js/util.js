// ============================================================
//  Utilities — วันที่แบบไทย (พ.ศ.), การจัดรูปแบบตัวเลข, ตัวช่วย DOM
// ============================================================
window.U = (function () {
  const TH_MONTH_ABBR = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const TH_MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  // "2026-04-04" -> "4 เม.ย. 69"
  function thaiDate(iso, opt = {}) {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d)) return iso;
    const day = d.getDate();
    const m = opt.full ? TH_MONTH_FULL[d.getMonth()] : TH_MONTH_ABBR[d.getMonth()];
    const be = d.getFullYear() + 543;
    const y = opt.fullYear ? be : String(be).slice(-2);
    return `${day} ${m} ${y}`;
  }

  // "2026-04" -> "เมษายน 2569"
  function thaiMonthYear(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-').map(Number);
    return `${TH_MONTH_FULL[m - 1]} ${y + 543}`;
  }

  // number -> "1,234.00"
  function money(n, dp = 2) {
    const v = Number(n || 0);
    return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  // ซ่อน 0 (แสดงช่องว่างแทน 0.00 ให้เหมือนกระดาษราชการ)
  function money0(n, dp = 2) {
    const v = Number(n || 0);
    return v === 0 ? '' : money(v, dp);
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function ymOf(iso) { return iso ? iso.slice(0, 7) : ''; }

  // ปีงบประมาณไทย (ต.ค.–ก.ย.) จากวันที่ ISO -> พ.ศ.
  function fiscalYearOf(iso) {
    const d = new Date(iso + 'T00:00:00');
    const be = d.getFullYear() + 543;
    return d.getMonth() >= 9 ? be + 1 : be; // ต.ค.(index9) ขึ้นไป = ปีงบถัดไป
  }

  // escape html
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // DOM helper
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  // toast
  function toast(msg, type = 'ok') {
    const box = document.getElementById('toast');
    const t = el(`<div class="toast ${type}">${esc(msg)}</div>`);
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.4s'; }, 2200);
    setTimeout(() => t.remove(), 2700);
  }

  function uid() { return 'id' + Math.random().toString(36).slice(2, 9); }

  // เดือนไทยเต็มจาก 1-12
  function monthFull(m) { return TH_MONTH_FULL[m - 1] || ''; }

  return { TH_MONTH_ABBR, TH_MONTH_FULL, thaiDate, thaiMonthYear, money, money0,
    todayISO, ymOf, fiscalYearOf, esc, el, $, $$, toast, uid, monthFull };
})();
