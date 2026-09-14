// ============================================================
//  แดชบอร์ด — ภาพรวมยอดเงินคงเหลือแต่ละบัญชี และทางลัด
// ============================================================
(function () {
  function accountBalance(a) {
    const open = Number(a.opening_cash || 0) + Number(a.opening_bank || 0) + Number(a.opening_govdeposit || 0);
    let bal = open;
    Store.txnsFY().forEach(t => {
      if (t.account_id === a.id) bal += Number(t.amount_in || 0) - Number(t.amount_out || 0);
    });
    return bal;
  }

  function mainAccountUsage(main, D) {
    const ledgers = D.accounts.filter(a => a.school_account_id === main.id && a.active !== false);
    const ledgerIds = new Set(ledgers.map(a => a.id));
    const opening = ledgers.reduce((sum, a) => sum + Number(a.opening_cash || 0) + Number(a.opening_bank || 0) + Number(a.opening_govdeposit || 0) + Number(a.opening_debtor || 0), 0);
    const txns = Store.txnsFY().filter(t => ledgerIds.has(t.account_id));
    const received = txns.reduce((sum, t) => sum + Number(t.amount_in || 0), 0);
    const spent = txns.reduce((sum, t) => sum + Number(t.amount_out || 0), 0);
    const available = opening + received;
    const percent = available > 0 ? (spent / available) * 100 : (spent > 0 ? 100 : 0);
    return { ledgers, available, spent, remaining: available - spent, percent };
  }

  function render(c) {
    const D = Store.data();
    const thisMonth = U.ymOf(U.todayISO());
    const mTx = Store.txnsFY().filter(t => U.ymOf(t.txn_date) === thisMonth);
    const mIn = mTx.reduce((s, t) => s + Number(t.amount_in || 0), 0);
    const mOut = mTx.reduce((s, t) => s + Number(t.amount_out || 0), 0);
    const grand = D.accounts.reduce((s, a) => s + accountBalance(a), 0);

    // ----- stat tiles -----
    c.appendChild(U.el(`<div class="grid c4" style="margin-bottom:6px">
      <div class="stat"><div class="lab">💼 คงเหลือรวมทุกบัญชี</div><div class="val bal">${U.money(grand)}</div></div>
      <div class="stat"><div class="lab">📥 รับเดือนนี้</div><div class="val in">${U.money(mIn)}</div></div>
      <div class="stat"><div class="lab">📤 จ่ายเดือนนี้</div><div class="val out">${U.money(mOut)}</div></div>
      <div class="stat"><div class="lab">📒 จำนวนบัญชี</div><div class="val bal">${D.accounts.length}</div></div>
    </div>`));

    // ----- การใช้เงินแยกตามบัญชีหลัก -----
    const usage = U.el(`<section class="card main-usage-section"><div class="main-usage-head"><div><span class="account-kicker">ภาพรวมบัญชีหลัก</span><h3>สัดส่วนการใช้เงิน</h3><p>คำนวณจากยอดจ่าย ÷ (ยอดยกมา + ยอดรับ) ของทะเบียนคุมในปีงบประมาณที่เลือก</p></div><span class="usage-fy">ปีงบประมาณ ${Store.getFY()}</span></div><div class="main-usage-grid"></div></section>`);
    const usageGrid = usage.querySelector('.main-usage-grid');
    const colors = [
      ['#6d5dfc','#a78bfa'], ['#0ea5e9','#22d3ee'], ['#f97316','#fbbf24'],
      ['#ec4899','#fb7185'], ['#14b8a6','#34d399'], ['#8b5cf6','#d946ef']
    ];
    if (!D.schoolAccounts.length) usageGrid.appendChild(U.el('<div class="empty main-usage-empty">ยังไม่มีบัญชีหลัก — เพิ่มได้ที่ “ข้อมูลหลัก”</div>'));
    D.schoolAccounts.filter(a => a.active !== false).forEach((main, i) => {
      const x = mainAccountUsage(main, D), shownPercent = Math.max(0, Math.min(100, x.percent)), labelPercent = Math.max(0, x.percent), palette = colors[i % colors.length];
      const item = U.el(`<article class="main-usage-card" style="--usage:${shownPercent};--ring-a:${palette[0]};--ring-b:${palette[1]}">
        <div class="usage-donut" role="img" aria-label="ใช้ไปแล้ว ${labelPercent.toFixed(1)} เปอร์เซ็นต์"><div><strong>${labelPercent.toFixed(1)}%</strong><span>ใช้ไปแล้ว</span></div></div>
        <div class="usage-detail"><span class="usage-ledgers">${x.ledgers.length} ทะเบียนคุม</span><h4>${U.esc(main.name)}</h4>
          <div class="usage-money"><div><span>วงเงินทั้งหมด</span><b>${U.money(x.available)}</b></div><div><span>ใช้ไปแล้ว</span><b class="spent">${U.money(x.spent)}</b></div><div><span>คงเหลือ</span><b class="${x.remaining < 0 ? 'over' : ''}">${U.money(x.remaining)}</b></div></div>
        </div>
      </article>`);
      usageGrid.appendChild(item);
    });
    c.appendChild(usage);

    // ----- ทางลัด -----
    const quick = U.el(`<div class="card"><h3>ทางลัด</h3><div class="btn-row" style="margin-top:10px">
      <button class="btn primary" data-go="daily">✍️ บันทึกรับ–จ่าย</button>
      <button class="btn ghost" data-go="reg-vouchers">📘 ทะเบียน บค./บจ./บย./บร.</button>
      <button class="btn ghost" data-go="reg-orders">📗 ใบสั่งซื้อ/สั่งจ้าง</button>
      <button class="btn ghost" data-go="reg-offbudget">📙 เงินนอกงบประมาณ</button>
      <button class="btn ghost" data-go="settings">⚙️ ข้อมูลหลัก</button>
    </div></div>`);
    quick.querySelectorAll('[data-go]').forEach(b => b.onclick = () => App.go(b.dataset.go));
    c.appendChild(quick);

    // ----- ตารางยอดคงเหลือ -----
    const card = U.el(`<div class="card"><h3>ยอดคงเหลือแยกบัญชี</h3>
      <div class="sub">ยอดยกมา + รับ − จ่าย (เฉพาะปีงบที่เลือก)</div>
      <div class="table-wrap"><table class="data"><thead><tr>
      <th>บัญชี</th><th>ประเภท</th><th class="num">ยอดยกมา</th><th class="num">รับสะสม</th><th class="num">จ่ายสะสม</th><th class="num">คงเหลือ</th>
      </tr></thead><tbody></tbody></table></div></div>`);
    const tb = card.querySelector('tbody');
    if (!D.accounts.length) tb.appendChild(U.el('<tr><td colspan="6"><div class="empty">ยังไม่มีบัญชี — เพิ่มได้ที่ “ข้อมูลหลัก”</div></td></tr>'));
    D.accounts.forEach(a => {
      const open = Number(a.opening_cash || 0) + Number(a.opening_bank || 0) + Number(a.opening_govdeposit || 0);
      const tx = Store.txnsFY().filter(t => t.account_id === a.id);
      const inn = tx.reduce((s, t) => s + Number(t.amount_in || 0), 0);
      const out = tx.reduce((s, t) => s + Number(t.amount_out || 0), 0);
      const tr = U.el(`<tr>
        <td><b>${U.esc(a.name)}</b></td><td>${U.esc(a.category || '')}</td>
        <td class="num">${U.money(open)}</td>
        <td class="num money-in">${U.money0(inn)}</td>
        <td class="num money-out">${U.money0(out)}</td>
        <td class="num"><b>${U.money(open + inn - out)}</b></td></tr>`);
      tr.style.cursor = 'pointer';
      tr.onclick = () => { window.RegOffbudget && window.RegOffbudget.select(a.id); App.go('reg-offbudget'); };
      tb.appendChild(tr);
    });
    c.appendChild(card);

    // ----- ปฏิทินใกล้ถึง -----
    const upcoming = D.events.filter(e => e.event_date >= U.todayISO()).slice(0, 6);
    const ev = U.el(`<div class="card"><h3>📅 ปฏิทินที่จะถึง</h3><div id="evlist" style="margin-top:8px"></div></div>`);
    const list = ev.querySelector('#evlist');
    if (!upcoming.length) list.appendChild(U.el('<div class="empty">ไม่มีกิจกรรมที่จะถึง</div>'));
    upcoming.forEach(e => list.appendChild(U.el(`<div style="display:flex;gap:12px;padding:9px 0;border-bottom:1px solid var(--line2)">
      <div style="min-width:110px;font-weight:700;color:var(--brand-d)">${U.esc(U.thaiDate(e.event_date))}</div>
      <div><b>${U.esc(e.title)}</b>${e.detail ? `<div style="color:var(--muted);font-size:13px">${U.esc(e.detail)}</div>` : ''}</div>
    </div>`)));
    c.appendChild(ev);
  }

  App.register('dashboard', {
    title: 'แดชบอร์ด',
    subtitle: () => (Store.data().school || {}).name || 'ภาพรวมการเงิน',
    render,
  });
})();
