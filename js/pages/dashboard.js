// ============================================================
//  แดชบอร์ดสาธารณะ — เปอร์เซ็นต์การใช้เงินแยกตามบัญชีหลัก
// ============================================================
(function () {
  function usagePercent(main, D) {
    const ledgers = D.accounts.filter(a => a.school_account_id === main.id && a.active !== false);
    const ids = new Set(ledgers.map(a => a.id));
    const opening = ledgers.reduce((sum, a) => sum + Number(a.opening_cash || 0) + Number(a.opening_bank || 0) + Number(a.opening_govdeposit || 0) + Number(a.opening_debtor || 0), 0);
    const txns = Store.txnsFY().filter(t => ids.has(t.account_id));
    const received = txns.reduce((sum, t) => sum + Number(t.amount_in || 0), 0);
    const spent = txns.reduce((sum, t) => sum + Number(t.amount_out || 0), 0);
    return opening + received > 0 ? Math.max(0, spent / (opening + received) * 100) : (spent > 0 ? 100 : 0);
  }

  function render(c) {
    const D = Store.data();
    const colors = [
      ['#6655e8','#a78bfa'], ['#0284c7','#22d3ee'], ['#f97316','#facc15'],
      ['#db2777','#fb7185'], ['#059669','#34d399'], ['#7c3aed','#d946ef'],
      ['#dc2626','#fb923c'], ['#2563eb','#60a5fa']
    ];
    const section = U.el(`<section class="card main-usage-section public-usage"><div class="main-usage-head"><div><span class="account-kicker">แดชบอร์ดสาธารณะ</span><h3>สัดส่วนการใช้เงินแต่ละบัญชีหลัก</h3></div><span class="usage-fy">ปีงบประมาณ ${Store.getFY()}</span></div><div class="main-usage-grid"></div></section>`);
    const grid = section.querySelector('.main-usage-grid');
    const accounts = D.schoolAccounts.filter(a => a.active !== false);
    if (!accounts.length) grid.appendChild(U.el('<div class="empty main-usage-empty">ยังไม่มีบัญชีหลัก</div>'));
    accounts.forEach((main, i) => {
      const percent = usagePercent(main, D), shown = Math.min(100, percent), palette = colors[i % colors.length];
      grid.appendChild(U.el(`<article class="main-usage-card" style="--usage:${shown};--ring-a:${palette[0]};--ring-b:${palette[1]}"><h4>${U.esc(main.name)}</h4><div class="usage-donut" role="img" aria-label="${U.esc(main.name)} ใช้ไปแล้ว ${percent.toFixed(1)} เปอร์เซ็นต์"><div><strong>${percent.toFixed(1)}%</strong><span>ใช้ไปแล้ว</span></div></div></article>`));
    });
    c.appendChild(section);
  }

  App.register('dashboard', { title: 'แดชบอร์ด', subtitle: () => (Store.data().school || {}).name || 'ภาพรวมการเงิน', render });
})();
