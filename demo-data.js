// Limpiempo DEMO: a pretend database that lives only in this browser.
// Nothing here touches the real Limpiempo database.
(function () {
'use strict';
window.LIMPIEMPO_DEMO = true;
window.LIMPIEMPO_BILL_PAGE = 'demo-bill.html';
window.LIMPIEMPO_CONFIG = { url: 'https://demo.local', anonKey: 'demo' };
const KEY = 'limpiempo-demo-db-v3', ROLE_KEY = 'limpiempo-demo-role';
const BIZ = 'biz-demo', ROSA = 'u-rosa', ANA = 'u-ana', LUIS = 'u-luis';
let n = 0; const uid = () => 'd' + Date.now().toString(36) + (++n).toString(36) + Math.random().toString(36).slice(2, 6);
const tok = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = off => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + off); return d; };
const at = (off, h, m = 0) => { const d = day(off); d.setHours(h, m, 0, 0); return d.toISOString(); };
const ago = hrs => new Date(Date.now() - hrs * 36e5).toISOString();
const parseD = s => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };

function seed() {
  const today = new Date(); const dow = today.getDay();
  const c = (name, phone, address, sqft) => ({ id: uid(), business_id: BIZ, name, phone, address, sqft, notes: '', created_at: ago(500) });
  const clients = [
    c('Dr. Patel', '(919) 555-0111', '1204 Lassiter Mill Rd, Raleigh', 2200),
    c('The Johnsons', '(919) 555-0142', '310 Kildaire Farm Rd, Cary', 2600),
    c('Gómez', '(919) 555-0177', '8800 Brier Creek Pkwy, Raleigh', 3400),
    c('Williams', '(919) 555-0123', '515 Glenwood Ave, Raleigh', 1800),
    c('Chen', '(919) 555-0164', '2010 Salem St, Apex', 2900),
    c('Rivera', '(919) 555-0188', '45 Wait Ave, Wake Forest', 2400),
    c('Okafor', '(919) 555-0199', '1000 Davis Dr, Morrisville', 3100)
  ];
  const id = name => clients.find(x => x.name === name).id;
  const j = (off, time, name, hours, crew, notes = '') => ({ id: uid(), business_id: BIZ, client_id: id(name), job_date: ymd(day(off)), start_time: time, hours, crew, notes, created_at: ago(200) });
  const jobs = [
    j(0, '08:00:00', 'Dr. Patel', 2.5, [ROSA, ANA]),
    j(0, '11:00:00', 'The Johnsons', 3, [ROSA, ANA], 'Gate code 4417. Dog is friendly.'),
    j(0, '14:00:00', 'Gómez', 4, [ANA, LUIS]),
    j(1, '09:00:00', 'Williams', 3, [ANA, LUIS]),
    j(1, '13:00:00', 'Chen', 3.5, [ROSA, LUIS]),
    j(2, '08:30:00', 'Rivera', 3, [ROSA, ANA]),
    j(2, '12:30:00', 'Okafor', 4, [ANA, LUIS]),
    j(3, '10:00:00', 'Dr. Patel', 2, [ROSA]),
    j(4, '09:00:00', 'Gómez', 3, [ANA, LUIS])
  ];
  const bill = (name, off, items, status, extra = {}) => {
    const sub = items.reduce((x, i) => x + i.amount, 0);
    return Object.assign({ id: uid(), business_id: BIZ, client_id: id(name), job_id: null, token: tok(), items, subtotal: sub, allow_tip: true, tip: 0, supplies: 0,
      note: 'Thank you! Your home is sparkling.', status, method: null, reported_method: null, sent_at: at(off, 15), opened_at: null, reported_at: null,
      paid_at: null, reminders: [], created_by: ROSA, created_at: at(off, 15) }, extra);
  };
  const te = []; const bills = [];
  const work = (job, who, h1, m1, h2, m2) => te.push({ id: uid(), business_id: BIZ, user_id: who, job_id: job.id, clock_in: at(0, 0) && (() => { const d = parseD(job.job_date); d.setHours(h1, m1, 0, 0); return d.toISOString(); })(), clock_out: (() => { const d = parseD(job.job_date); d.setHours(h2, m2, 0, 0); return d.toISOString(); })(), note: '', edited: false, created_at: ago(1) });
  // Past days of this week: jobs with bills and real hours (so Performance has numbers)
  const past = [
    ['Gómez', '08:30:00', 4, [ANA, LUIS], [{ label: 'Deep clean', amount: 240 }, { label: 'Windows', amount: 48 }], [[ANA, 8, 30, 12, 40], [LUIS, 8, 30, 12, 25]], 'paid', 'cashapp', 30, 18],
    ['Williams', '13:30:00', 3, [ANA, LUIS], [{ label: 'Cleaning – 1,800 sq ft', amount: 120 }], [[ANA, 13, 5, 17, 50], [LUIS, 13, 5, 17, 45]], 'opened', null, 0, 0],
    ['Rivera', '09:00:00', 3, [ROSA, ANA], [{ label: 'Standard clean', amount: 160 }, { label: 'Inside fridge', amount: 25 }], [[ROSA, 9, 0, 11, 15], [ANA, 9, 0, 11, 15]], 'paid', 'applecash', 37, 12],
    ['Okafor', '12:30:00', 4, [ROSA, LUIS], [{ label: 'Deep clean', amount: 240 }, { label: 'Inside oven', amount: 25 }], [[ROSA, 12, 30, 16, 5], [LUIS, 12, 30, 16, 20]], 'reported', null, 40, 15]
  ];
  const pastDays = []; for (let off = -dow; off < 0; off++) pastDays.push(off);
  const extraJobs = [];
  past.forEach((p, k) => {
    if (!pastDays.length) return;
    const off = pastDays[k % pastDays.length];
    const job = j(off, p[1], p[0], p[2], p[3]); extraJobs.push(job);
    p[5].forEach(w => work(job, w[0], w[1], w[2], w[3], w[4]));
    bills.push(bill(p[0], off, p[4], p[6], { job_id: job.id, method: p[6] === 'paid' ? p[7] : null, reported_method: p[6] === 'reported' ? 'zelle' : null, tip: p[8], supplies: p[9],
      opened_at: at(off, 18), reported_at: p[6] === 'reported' ? at(off, 19) : null, paid_at: p[6] === 'paid' ? at(off, 19) : null, sent_at: at(off, 17) }));
  });
  jobs.push(...extraJobs);
  // Today: Patel done and paid, Johnsons done (no bill yet), Luis on his way to Gómez
  work(jobs[0], ROSA, 8, 0, 10, 5); work(jobs[0], ANA, 8, 0, 10, 5);
  bills.push(bill('Dr. Patel', 0, [{ label: 'Standard clean', amount: 165 }], 'paid', { tip: 25, method: 'venmo', supplies: 10, sent_at: ago(5), opened_at: ago(4.8), paid_at: ago(4.7), job_id: jobs[0].id }));
  bills.push(bill('Chen', -10, [{ label: 'Cleaning – 2,900 sq ft', amount: 195 }], 'opened', { opened_at: at(-9, 9), reminders: [at(-4, 9)] }));
  te.push({ id: uid(), business_id: BIZ, user_id: LUIS, job_id: jobs[2].id, clock_in: ago(1.25), clock_out: null, note: '', edited: false, created_at: ago(1.25) });
  return {
    businesses: [{ id: BIZ, name: 'Rosa’s Cleaning', join_code: 'ROSA24', phone: '(919) 555-0100', pay_instructions: 'Checks payable to Rosa Martínez',
      pay_venmo: 'rosas-cleaning', pay_cashapp: 'rosascleaning', pay_paypal: '', pay_zelle: '(919) 555-0100', pay_applecash: '(919) 555-0100',
      services: [{ label: 'Standard clean', amount: 160 }, { label: 'Deep clean', amount: 240 }, { label: 'Move-out clean', amount: 320 }, { label: 'Inside fridge', amount: 25 }, { label: 'Inside oven', amount: 25 }, { label: 'Windows', amount: 40 }, { label: 'Laundry', amount: 20 }],
      sqft_price: 160, sqft_base: 2400, min_price: 120, created_at: ago(900) }],
    members: [
      { user_id: ROSA, business_id: BIZ, name: 'Rosa', role: 'owner', color: '#D6245E', phone: '(919) 555-0100', active: true, created_at: ago(900) },
      { user_id: ANA, business_id: BIZ, name: 'Ana', role: 'crew', color: '#0E7C7B', phone: '(919) 555-0155', active: true, created_at: ago(800) },
      { user_id: LUIS, business_id: BIZ, name: 'Luis', role: 'crew', color: '#7C4DDB', phone: '(919) 555-0166', active: true, created_at: ago(700) }
    ],
    clients, jobs, bills, time_entries: te,
    member_pay: [{ user_id: ROSA, business_id: BIZ, hourly_rate: 25 }, { user_id: ANA, business_id: BIZ, hourly_rate: 18 }, { user_id: LUIS, business_id: BIZ, hourly_rate: 17 }]
  };
}
let db; try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!db || !db.businesses) db = seed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
save();
window.LimpiempoDemo = {
  reset() { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); },
  role() { try { return localStorage.getItem(ROLE_KEY) || 'owner'; } catch (e) { return 'owner'; } },
  setRole(r) { try { localStorage.setItem(ROLE_KEY, r); } catch (e) {} location.reload(); }
};
let me = window.LimpiempoDemo.role() === 'crew' ? ANA : ROSA;
let signedIn = true;
const sessionObj = () => signedIn ? { user: { id: me, email: me === ROSA ? 'rosa@demo' : 'ana@demo' } } : null;
const listeners = [];

function builder(table) {
  let op = 'select', payload = null, filters = [], single = false, maybe = false, orders = [], lim = null, conflict = null;
  const api = {
    select() { return api; },
    eq(k, v) { filters.push(r => r[k] === v); return api; },
    gte(k, v) { filters.push(r => r[k] >= v); return api; },
    lte(k, v) { filters.push(r => r[k] <= v); return api; },
    lt(k, v) { filters.push(r => r[k] < v); return api; },
    is(k, v) { filters.push(r => (r[k] ?? null) === v); return api; },
    order(k, o) { orders.push([k, !(o && o.ascending === false)]); return api; },
    limit(x) { lim = x; return api; },
    insert(p) { op = 'insert'; payload = p; return api; },
    update(p) { op = 'update'; payload = p; return api; },
    upsert(p, o) { op = 'upsert'; payload = p; conflict = (o && o.onConflict) || 'id'; return api; },
    delete() { op = 'delete'; return api; },
    single() { single = true; return api; },
    maybeSingle() { maybe = true; return api; },
    then(res, rej) {
      try {
        const T = db[table] || (db[table] = []);
        let out;
        if (op === 'insert') {
          const r = Object.assign({ id: uid(), created_at: new Date().toISOString() }, table === 'bills' ? { token: tok(), status: 'sent', sent_at: new Date().toISOString(), reminders: [], tip: 0 } : {}, payload);
          T.push(r); out = [r];
        } else if (op === 'upsert') {
          const ex = T.find(r => r[conflict] === payload[conflict]);
          if (ex) Object.assign(ex, payload); else T.push(Object.assign({}, payload));
          out = [ex || payload];
        } else if (op === 'update') {
          out = T.filter(r => filters.every(f => f(r))); out.forEach(r => Object.assign(r, payload));
        } else if (op === 'delete') {
          out = T.filter(r => filters.every(f => f(r))); db[table] = T.filter(r => !out.includes(r));
        } else {
          out = T.filter(r => filters.every(f => f(r)));
          if (table === 'bills' || table === 'member_pay') out = me === ROSA ? out : [];
          if (table === 'time_entries' && me !== ROSA) out = out.filter(r => r.user_id === me);
          out = out.slice();
          orders.slice().reverse().forEach(([k, asc]) => out.sort((a, b) => ((a[k] ?? '') > (b[k] ?? '') ? 1 : (a[k] ?? '') < (b[k] ?? '') ? -1 : 0) * (asc ? 1 : -1)));
          if (lim) out = out.slice(0, lim);
        }
        if (op !== 'select') save();
        const copy = JSON.parse(JSON.stringify(out));
        res({ data: (single || maybe) ? (copy[0] || null) : copy, error: (single && !copy[0]) ? { message: 'not found' } : null });
      } catch (e) { rej(e); }
    }
  };
  return api;
}
async function rpc(name, a) {
  const done = data => { save(); return { data, error: null }; };
  if (name === 'get_bill') {
    const x = db.bills.find(b => b.token === a.p_token && b.status !== 'void'); if (!x) return { data: null, error: null };
    if (x.status === 'sent') { x.status = 'opened'; x.opened_at = new Date().toISOString(); }
    const b = db.businesses[0]; const c = db.clients.find(k => k.id === x.client_id) || {};
    return done({ business: b.name, business_phone: b.phone, pay_instructions: b.pay_instructions, pay_venmo: b.pay_venmo, pay_cashapp: b.pay_cashapp,
      pay_paypal: b.pay_paypal, pay_zelle: b.pay_zelle, pay_applecash: b.pay_applecash, client: c.name, items: x.items, subtotal: x.subtotal,
      allow_tip: x.allow_tip, tip: x.tip, note: x.note, status: x.status, method: x.method, reported_method: x.reported_method, sent_at: x.sent_at, paid_at: x.paid_at });
  }
  if (name === 'report_paid') {
    const x = db.bills.find(b => b.token === a.p_token); if (!x || !['sent', 'opened'].includes(x.status)) return { data: false, error: null };
    Object.assign(x, { status: 'reported', reported_at: new Date().toISOString(), reported_method: a.p_method, tip: x.allow_tip ? Math.max(0, Math.min(Number(a.p_tip) || 0, x.subtotal)) : 0 });
    return done(true);
  }
  if (name === 'clock_in') {
    if (db.time_entries.some(e => e.user_id === me && !e.clock_out)) return { data: null, error: { message: 'Already clocked in' } };
    db.time_entries.push({ id: uid(), business_id: BIZ, user_id: me, job_id: (a && a.p_job) || null, clock_in: new Date().toISOString(), clock_out: null, note: '', edited: false });
    return done('ok');
  }
  if (name === 'switch_job') {
    const e = db.time_entries.find(x => x.user_id === me && !x.clock_out); if (e) e.clock_out = new Date().toISOString();
    db.time_entries.push({ id: uid(), business_id: BIZ, user_id: me, job_id: a.p_job || null, clock_in: new Date().toISOString(), clock_out: null, note: '', edited: false });
    return done('ok');
  }
  if (name === 'clock_out') {
    const e = db.time_entries.find(x => x.user_id === me && !x.clock_out); if (!e) return { data: null, error: { message: 'Not clocked in' } };
    e.clock_out = new Date().toISOString(); return done(e.id);
  }
  return { data: null, error: { message: 'Not available in the demo' } };
}
window.supabase = {
  createClient() {
    return {
      from: builder, rpc,
      auth: {
        getSession: async () => ({ data: { session: sessionObj() } }),
        onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
        signInWithPassword: async () => { signedIn = true; listeners.forEach(l => l('SIGNED_IN', sessionObj())); return { data: { session: sessionObj() }, error: null }; },
        signUp: async () => ({ data: { session: null }, error: { message: 'demo' } }),
        signOut: async () => { signedIn = false; listeners.forEach(l => l('SIGNED_OUT', null)); return {}; },
        resetPasswordForEmail: async () => ({}), updateUser: async () => ({ error: null })
      }
    };
  }
};
// Demo banner
function banner() {
  if (document.getElementById('demoBar')) return;
  const es = (localStorage.getItem('limpiempo-lang') || 'en') === 'es';
  const role = window.LimpiempoDemo.role();
  const bar = document.createElement('div'); bar.id = 'demoBar';
  bar.setAttribute('style', 'position:sticky;top:0;z-index:50;background:#2A1F3D;color:#fff;font-family:Nunito,sans-serif;font-size:13px;padding:8px 12px;padding-top:calc(8px + env(safe-area-inset-top));display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap');
  const isBill = /demo-bill/.test(location.pathname);
  bar.innerHTML = `<b style="color:#FFC93C">DEMO</b><span>${es ? 'Datos de ejemplo · nada es real' : 'Sample data · nothing is real'}</span>` +
    (isBill ? `<a href="demo.html" style="color:#fff;font-weight:800">${es ? '← Volver a la app' : '← Back to the app'}</a>` :
    `<span style="display:inline-flex;background:#4A3D60;border-radius:999px;padding:2px">
      <button data-demo-role="owner" style="border:none;border-radius:999px;padding:5px 10px;font-weight:800;font-size:12px;${role === 'owner' ? 'background:#FFC93C;color:#2A1F3D' : 'background:none;color:#fff'}">${es ? 'Dueña' : 'Owner'}</button>
      <button data-demo-role="crew" style="border:none;border-radius:999px;padding:5px 10px;font-weight:800;font-size:12px;${role === 'crew' ? 'background:#FFC93C;color:#2A1F3D' : 'background:none;color:#fff'}">${es ? 'Equipo' : 'Crew'}</button></span>
    <button data-demo-reset style="border:1px solid #8C80A3;background:none;color:#fff;border-radius:999px;padding:4px 10px;font-weight:800;font-size:12px">${es ? 'Reiniciar' : 'Reset'}</button>`);
  document.body.insertBefore(bar, document.body.firstChild);
  bar.addEventListener('click', e => {
    const r = e.target.closest('[data-demo-role]'); if (r) { e.stopPropagation(); window.LimpiempoDemo.setRole(r.dataset.demoRole); }
    if (e.target.closest('[data-demo-reset]')) { e.stopPropagation(); window.LimpiempoDemo.reset(); }
  }, true);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner); else banner();
})();
