// ============================================================
//  Store — ชั้นเชื่อมต่อ Supabase + แคชข้อมูลในหน่วยความจำ
// ============================================================
window.Store = (function () {
  let sb = null;                 // supabase client
  let configured = false;
  let currentFY = null;          // ปีงบประมาณที่กำลังดู/บันทึก (พ.ศ.)
  const START_FY = 2569;
  const cache = {                // แคชข้อมูลทั้งหมด
    school: null,
    positions: [],
    teachers: [],
    accounts: [],
    projects: [],
    projectActivities: [],
    utilityBills: [],
    events: [],
    transactions: [],
  };

  function init() {
    const c = window.APP_CONFIG || {};
    if (c.SUPABASE_URL && c.SUPABASE_ANON_KEY && window.supabase) {
      sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
      configured = true;
    }
    return configured;
  }

  function isConfigured() { return configured; }
  function client() { return sb; }
  function data() { return cache; }

  async function loadAll() {
    if (!configured) return false;
    const [school, positions, teachers, accounts, projects, activities, utilities, events, txns] = await Promise.all([
      sb.from('school_info').select('*').eq('id', 1).maybeSingle(),
      sb.from('positions').select('*').order('sort'),
      sb.from('teachers').select('*').order('sort'),
      sb.from('accounts').select('*').order('sort'),
      sb.from('projects').select('*').order('sort'),
      sb.from('project_activities').select('*').order('sort'),
      sb.from('utility_bills').select('*').order('bill_month'),
      sb.from('calendar_events').select('*').order('event_date'),
      sb.from('transactions').select('*').order('txn_date').order('doc_no', { nullsFirst: true }).order('created_at'),
    ]);
    const err = [school, positions, teachers, accounts, projects, activities, utilities, events, txns].find(r => r.error);
    if (err && err.error) { console.error(err.error); throw err.error; }
    cache.school = school.data || null;
    cache.positions = positions.data || [];
    cache.teachers = teachers.data || [];
    cache.accounts = accounts.data || [];
    cache.projects = projects.data || [];
    cache.projectActivities = activities.data || [];
    cache.utilityBills = utilities.data || [];
    cache.events = events.data || [];
    cache.transactions = txns.data || [];
    return true;
  }

  // ---------- generic CRUD ----------
  async function insert(table, row) {
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) throw error;
    return data;
  }
  async function update(table, id, patch) {
    const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
  async function remove(table, id) {
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw error;
  }
  async function upsertSchool(patch) {
    const row = Object.assign({ id: 1 }, patch, { updated_at: new Date().toISOString() });
    const { data, error } = await sb.from('school_info').upsert(row).select().single();
    if (error) throw error;
    cache.school = data;
    return data;
  }

  // ---------- ตัวช่วยค้นหา ----------
  const accountById = id => cache.accounts.find(a => a.id === id);
  const teacherById = id => cache.teachers.find(t => t.id === id);
  const positionById = id => cache.positions.find(p => p.id === id);
  const projectById = id => cache.projects.find(p => p.id === id);
  const projectByName = name => cache.projects.find(p => (p.name || '').trim() === (name || '').trim());
  // เพิ่มหลายแถวพร้อมกัน (ใช้ตอนนำเข้า CSV)
  async function insertMany(table, rows) {
    if (!rows || !rows.length) return [];
    const { data, error } = await sb.from(table).insert(rows).select();
    if (error) throw error;
    return data || [];
  }

  // ---------- ปีงบประมาณ (fiscal year) ----------
  // ปีงบไทยของรายการ = คำนวณจากวันที่ (ต.ค.–ก.ย.)
  const fyOfTxn = t => window.U ? U.fiscalYearOf(t.txn_date) : START_FY;

  // รายชื่อปีงบที่มีข้อมูล (รวมปีเริ่มต้น + ปีงบปัจจุบันตามปฏิทิน) เรียงมาก→น้อย
  function fyList() {
    const set = new Set([START_FY]);
    cache.transactions.forEach(t => { if (t.txn_date) set.add(fyOfTxn(t)); });
    cache.projects.forEach(p => { if (p.fiscal_year) set.add(Number(p.fiscal_year)); });
    if (window.U) set.add(U.fiscalYearOf(U.todayISO()));
    if (currentFY) set.add(currentFY);
    return Array.from(set).filter(Boolean).sort((a, b) => b - a);
  }

  function getFY() {
    if (currentFY == null) {
      let saved = null;
      try { saved = Number(localStorage.getItem('currentFY')); } catch (e) {}
      const list = fyList();
      currentFY = (saved && list.includes(saved)) ? saved : (list[0] || START_FY);
    }
    return currentFY;
  }
  function setFY(fy) {
    currentFY = Number(fy);
    try { localStorage.setItem('currentFY', String(currentFY)); } catch (e) {}
  }

  // ตัวกรองตามปีงบ
  function txnsFY(fy = getFY()) { return cache.transactions.filter(t => fyOfTxn(t) === fy); }
  function projectsFY(fy = getFY()) { return cache.projects.filter(p => Number(p.fiscal_year || START_FY) === fy); }
  const fyOfMonth = ym => window.U ? U.fiscalYearOf(String(ym || '').slice(0, 7) + '-01') : START_FY;
  function utilitiesFY(fy = getFY()) { return cache.utilityBills.filter(u => fyOfMonth(u.bill_month) === fy); }

  // ลบข้อมูลทั้งปีงบ (รายการในช่วงวันที่ของปีนั้น + โครงการของปีนั้น)
  async function deleteFY(fy) {
    const beY = fy - 543;                 // ค.ศ. ของปลายปีงบ
    const start = `${beY - 1}-10-01`;      // 1 ต.ค. ปีก่อน
    const end = `${beY}-09-30`;            // 30 ก.ย. ปีงบ
    let r = await sb.from('transactions').delete().gte('txn_date', start).lte('txn_date', end);
    if (r.error) throw r.error;
    r = await sb.from('projects').delete().eq('fiscal_year', fy);  // กิจกรรมย่อยลบตาม cascade
    if (r.error) throw r.error;
  }

  // เลขที่เอกสารถัดไป (running number) ต่อปีงบ
  function nextDocNo() {
    const nums = txnsFY().map(t => t.doc_no).filter(n => Number.isFinite(n));
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }

  return { init, isConfigured, client, data, loadAll, insert, insertMany, update, remove,
    upsertSchool, accountById, teacherById, positionById, projectById, projectByName, nextDocNo,
    START_FY, fyList, getFY, setFY, txnsFY, projectsFY, utilitiesFY, deleteFY };
})();
