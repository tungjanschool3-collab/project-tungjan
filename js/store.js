// ============================================================
//  Store — ชั้นเชื่อมต่อ Supabase + แคชข้อมูลในหน่วยความจำ
// ============================================================
window.Store = (function () {
  let sb = null;                 // supabase client
  let configured = false;
  const cache = {                // แคชข้อมูลทั้งหมด
    school: null,
    positions: [],
    teachers: [],
    accounts: [],
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
    const [school, positions, teachers, accounts, events, txns] = await Promise.all([
      sb.from('school_info').select('*').eq('id', 1).maybeSingle(),
      sb.from('positions').select('*').order('sort'),
      sb.from('teachers').select('*').order('sort'),
      sb.from('accounts').select('*').order('sort'),
      sb.from('calendar_events').select('*').order('event_date'),
      sb.from('transactions').select('*').order('txn_date').order('doc_no', { nullsFirst: true }).order('created_at'),
    ]);
    const err = [school, positions, teachers, accounts, events, txns].find(r => r.error);
    if (err && err.error) { console.error(err.error); throw err.error; }
    cache.school = school.data || null;
    cache.positions = positions.data || [];
    cache.teachers = teachers.data || [];
    cache.accounts = accounts.data || [];
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

  // เลขที่เอกสารถัดไป (running number) ต่อปีงบ
  function nextDocNo() {
    const nums = cache.transactions.map(t => t.doc_no).filter(n => Number.isFinite(n));
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }

  return { init, isConfigured, client, data, loadAll, insert, update, remove,
    upsertSchool, accountById, teacherById, positionById, nextDocNo };
})();
