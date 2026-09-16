// ============================================================
//  Store — ชั้นเชื่อมต่อ Supabase + แคชข้อมูลในหน่วยความจำ
// ============================================================
window.Store = (function () {
  let sb = null;                 // supabase client
  let configured = false;
  let session = null;
  let currentFY = null;          // ปีงบประมาณที่กำลังดู/บันทึก (พ.ศ.)
  const START_FY = 2569;
  const cache = {                // แคชข้อมูลทั้งหมด
    school: null,
    positions: [],
    teachers: [],
    schoolAccounts: [],
    accounts: [],
    projects: [],
    projectActivities: [],
    utilityBills: [],
    events: [],
    transactions: [],
  };

  function init() {
    const c = window.APP_CONFIG || {};
    try { session = JSON.parse(sessionStorage.getItem('appSession') || 'null'); } catch (e) { session = null; }
    if (c.SUPABASE_URL && c.SUPABASE_ANON_KEY && window.supabase) {
      const headers = session && session.token ? { 'x-app-session': session.token } : {};
      sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, { global: { headers } });
      configured = true;
    }
    return configured;
  }

  function isConfigured() { return configured; }
  function client() { return sb; }
  function getSession() { return session; }
  async function login(code, password, admin = false) {
    if (!sb) init();
    const { data, error } = await sb.rpc('app_login', { p_code: code || '', p_password: password, p_admin: admin });
    if (error) throw error;
    session = data;
    sessionStorage.setItem('appSession', JSON.stringify(session));
    init();
    return session;
  }
  async function validateSession() {
    if (!session || !session.token) return false;
    const { data, error } = await sb.rpc('app_whoami');
    if (error || !data) { clearSession(); return false; }
    return true;
  }
  function clearSession() { session = null; sessionStorage.removeItem('appSession'); }
  async function logout() { try { if (sb && session) await sb.rpc('app_logout'); } finally { clearSession(); } }
  function data() { return cache; }

  async function loadAll() {
    if (!configured) return false;
    window.dispatchEvent(new CustomEvent('app:data-loading', { detail: { loading: true } }));
    try {
    const [school, positions, teachers, schoolAccounts, accounts, projects, activities, utilities, events, txns] = await Promise.all([
      sb.from('school_info').select('*').eq('id', 1).maybeSingle(),
      sb.from('positions').select('*').order('sort'),
      sb.from('teachers').select('*').order('sort'),
      sb.from('school_accounts').select('*').order('sort'),
      sb.from('accounts').select('*').order('sort'),
      sb.from('projects').select('*').order('sort'),
      sb.from('project_activities').select('*').order('sort'),
      sb.from('utility_bills').select('*').order('bill_month'),
      sb.from('calendar_events').select('*').order('event_date'),
      sb.from('transactions').select('*').order('txn_date').order('doc_no', { nullsFirst: true }).order('created_at'),
    ]);
    const err = [school, positions, teachers, schoolAccounts, accounts, projects, activities, utilities, events, txns].find(r => r.error);
    if (err && err.error) {
      console.error(err.error);
      throw err.error;
    }
    cache.school = school.data || null;
    cache.positions = positions.data || [];
    cache.teachers = teachers.data || [];
    cache.schoolAccounts = schoolAccounts.data || [];
    cache.accounts = accounts.data || [];
    cache.projects = projects.data || [];
    cache.projectActivities = activities.data || [];
    cache.utilityBills = utilities.data || [];
    cache.events = events.data || [];
    // รายการนำเข้าเก่าบางชุดมีแถวซ้ำกันทุกช่อง โดยแถวหนึ่งไม่ได้ผูกบัญชี
    // ใช้แถวที่ผูกบัญชีแล้วเพียงครั้งเดียว เพื่อไม่ให้ทะเบียนและรายงานรวมยอดซ้ำ
    const loadedTransactions = txns.data || [];
    const coreKey = t => [
      t.txn_date || '', String(t.doc_type || '').replace(/\./g, '').trim(), t.doc_no ?? '',
      String(t.description || '').trim(), Number(t.amount_out || 0), Number(t.amount_in || 0)
    ].join('|');
    const assignedKeys = new Set(loadedTransactions.filter(t => t.account_id).map(coreKey));
    cache.transactions = loadedTransactions.filter(t => t.account_id || !assignedKeys.has(coreKey(t)));
    return true;
    } finally {
      window.dispatchEvent(new CustomEvent('app:data-loading', { detail: { loading: false } }));
    }
  }

  // ---------- generic CRUD ----------
  async function insert(table, row) {
    const payload = Object.assign({}, row, { school_id: session.school_id });
    const { data, error } = await sb.from(table).insert(payload).select().single();
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
    const row = Object.assign({ id: 1, school_id: session.school_id }, patch, { updated_at: new Date().toISOString() });
    const { data, error } = await sb.from('school_info').upsert(row, { onConflict: 'school_id,id' }).select().single();
    if (error) throw error;
    cache.school = data;
    return data;
  }

  // ---------- ตัวช่วยค้นหา ----------
  const accountById = id => cache.accounts.find(a => a.id === id);
  const teacherById = id => cache.teachers.find(t => t.id === id);
  const positionById = id => cache.positions.find(p => p.id === id);
  const schoolAccountById = id => cache.schoolAccounts.find(a => a.id === id);
  const projectById = id => cache.projects.find(p => p.id === id);
  const projectByName = name => cache.projects.find(p => (p.name || '').trim() === (name || '').trim());
  // เพิ่มหลายแถวพร้อมกัน (ใช้ตอนนำเข้า CSV)
  async function insertMany(table, rows) {
    if (!rows || !rows.length) return [];
    const payload = rows.map(row => Object.assign({}, row, { school_id: session.school_id }));
    const { data, error } = await sb.from(table).insert(payload).select();
    if (error) throw error;
    return data || [];
  }

  // ---------- ปีงบประมาณ (fiscal year) ----------
  // รองรับข้อมูลเก่าบางชุดที่เคยบวก 543 กับปี พ.ศ. ซ้ำ (เช่น 3112 -> 2569)
  function normalizeFY(value) {
    let fy = Number(value);
    if (!Number.isFinite(fy)) return 0;
    while (fy > 2800) fy -= 543;
    return fy;
  }

  // ปีงบไทยของรายการ = คำนวณจากวันที่ (ต.ค.–ก.ย.)
  const fyOfTxn = t => window.U ? normalizeFY(U.fiscalYearOf(t.txn_date)) : START_FY;

  // รายชื่อปีงบที่มีข้อมูล (รวมปีเริ่มต้น + ปีงบปัจจุบันตามปฏิทิน) เรียงมาก→น้อย
  function fyList() {
    const set = new Set([START_FY]);
    cache.transactions.forEach(t => { if (t.txn_date) set.add(fyOfTxn(t)); });
    cache.projects.forEach(p => { if (p.fiscal_year) set.add(normalizeFY(p.fiscal_year)); });
    if (window.U) set.add(U.fiscalYearOf(U.todayISO()));
    if (currentFY) set.add(currentFY);
    return Array.from(set).filter(Boolean).sort((a, b) => b - a);
  }

  function getFY() {
    if (currentFY == null) {
      let saved = null;
      try { saved = normalizeFY(localStorage.getItem('currentFY')); } catch (e) {}
      const list = fyList();
      currentFY = (saved && list.includes(saved)) ? saved : (list[0] || START_FY);
    }
    return currentFY;
  }
  function setFY(fy) {
    currentFY = normalizeFY(fy) || START_FY;
    try { localStorage.setItem('currentFY', String(currentFY)); } catch (e) {}
  }

  // ตัวกรองตามปีงบ
  function txnsFY(fy = getFY()) { return cache.transactions.filter(t => fyOfTxn(t) === fy); }
  function projectsFY(fy = getFY()) { return cache.projects.filter(p => normalizeFY(p.fiscal_year || START_FY) === fy); }
  const fyOfMonth = ym => window.U ? normalizeFY(U.fiscalYearOf(String(ym || '').slice(0, 7) + '-01')) : START_FY;
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

  async function adminSchools() {
    const { data, error } = await sb.rpc('app_admin_list_schools');
    if (error) throw error; return data || [];
  }
  async function adminCreateSchool(v) {
    const { data, error } = await sb.rpc('app_admin_create_school', {
      p_code: v.code, p_name: v.name, p_password: v.password,
      p_office: v.office || '', p_district: v.district || '', p_province: v.province || ''
    });
    if (error) throw error; return data;
  }
  async function adminSetSchool(v) {
    const { data, error } = await sb.rpc('app_admin_set_school', {
      p_school_id: v.id, p_name: v.name, p_active: v.active, p_password: v.password || null
    });
    if (error) throw error; return data;
  }

  // เลขที่เอกสารถัดไป (running number) ต่อปีงบ
  function nextDocNo() {
    const nums = txnsFY().map(t => t.doc_no).filter(n => Number.isFinite(n));
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }

  return { init, isConfigured, client, getSession, login, validateSession, logout, data, loadAll, insert, insertMany, update, remove,
    upsertSchool, accountById, teacherById, positionById, schoolAccountById, projectById, projectByName, nextDocNo,
    adminSchools, adminCreateSchool, adminSetSchool,
    START_FY, fyList, getFY, setFY, txnsFY, projectsFY, utilitiesFY, deleteFY };
})();
