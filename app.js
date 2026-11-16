(function () {
'use strict';
const C = window.LIMPIEMPO_CONFIG;
const sb = window.supabase.createClient(C.url, C.anonKey);
let lang = getLang();
const t = (k, ...a) => { const v = I18N[lang][k] ?? I18N.en[k]; return typeof v === 'function' ? v(...a) : (v ?? k); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Number(n || 0).toFixed(2);
const money0 = n => { const v = Math.round(Number(n || 0) * 100) / 100; return '$' + (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(2)); };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekStart = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -d.getDay());
const loc = () => (lang === 'es' ? 'es-US' : 'en-US');
const fmtTime = s => { if (!s) return ''; const [h, m] = s.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit' }); };
const fmtDate = (d, o) => d.toLocaleDateString(loc(), o || { weekday: 'short', month: 'short', day: 'numeric' });
const fmtDT = s => (s ? new Date(s).toLocaleString(loc(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const billUrl = tok => new URL('bill.html?t=' + tok, location.href).href;
const appUrl = () => new URL('./', location.href).href;
const cleanPhone = p => String(p || '').replace(/[^\d+]/g, '');
const smsHref = (phone, body) => `sms:${cleanPhone(phone)}?&body=${encodeURIComponent(body)}`;
const total = b => Number(b.subtotal) + Number(b.tip || 0);
const handle = v => String(v || '').trim().replace(/\/+$/, '').split('/').pop().replace(/^[@$]+/, '').replace(/[^A-Za-z0-9_.-]/g, '');
const METHODS = ['cash', 'zelle', 'venmo', 'applecash', 'cashapp', 'check', 'card', 'other'];
const PRESETS = [['p_standard', 140], ['p_deep', 220], ['p_move', 300], ['p_fridge', 25], ['p_oven', 25], ['p_windows', 40], ['p_laundry', 20]];
const services = () => (S.biz && Array.isArray(S.biz.services) && S.biz.services.length) ? S.biz.services : PRESETS.map(([k, p]) => ({ label: t(k), amount: p }));
const sqftCfg = () => ({ price: Number(S.biz && S.biz.sqft_price) || 160, base: Number(S.biz && S.biz.sqft_base) || 2400, min: Number(S.biz && S.biz.min_price) || 0 });
const sqftCalc = sq => { const c = sqftCfg(); const n = Number(sq); if (!n || n <= 0) return 0; return Math.max(c.min, Math.round(n * c.price / c.base / 5) * 5); };
const fmtPrice = n => { const v = Number(n || 0); return '$' + (Number.isInteger(v) ? v : v.toFixed(2)); };

const S = {
  session: null, me: null, biz: null, members: [], clients: [], jobs: [], todayJobs: [], bills: [],
  tab: 'today', day: ymd(new Date()), week: ymd(weekStart(new Date())), who: 'all', filter: 'all', q: '',
  modal: null, form: {}, authMode: 'in', loading: true, toast: '',
  entries: [], openEntry: null, pay: [], hoursWeek: ymd(weekStart(new Date())), hoursWho: null
};
const isOwner = () => S.me && S.me.role === 'owner';
const member = id => S.members.find(m => m.user_id === id);
const client = id => S.clients.find(c => c.id === id);
const activeMembers = () => S.members.filter(m => m.active);

// ---------- icons ----------
const I = {
  house: c => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 L12 4 L21 11"/><path d="M5 10 V20 H19 V10"/></svg>`,
  cal: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10 H21 M8 3 V7 M16 3 V7"/></svg>`,
  bill: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3 H18 V21 L15 19 L12 21 L9 19 L6 21 Z"/><path d="M9 8 H15 M9 12 H15"/></svg>`,
  people: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20 C3.5 15.5 14.5 15.5 15.5 20"/><path d="M16 4.5 A3.5 3.5 0 0 1 16 11.5"/><path d="M18 15 C20 15.8 21.2 17.5 21.5 20"/></svg>`,
  clock: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7 V12 L15.5 14"/></svg>`,
  me: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21 C5 15.5 19 15.5 20 21"/></svg>`,
  send: c => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3 L10 14"/><path d="M21 3 L14 21 L10 14 L3 10 Z"/></svg>`,
  plus: c => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5 V19 M5 12 H19"/></svg>`,
  pin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21 C12 21 5 14.5 5 9.5 A7 7 0 0 1 19 9.5 C19 14.5 12 21 12 21 Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`
};
const av = id => { const m = member(id); if (!m) return ''; return `<span class="av" style="background:${esc(m.color)}" title="${esc(m.name)}">${esc((m.name || '?')[0].toUpperCase())}</span>`; };
const sparkle = `<svg width="90" height="90" viewBox="0 0 24 24" aria-hidden="true" style="position:absolute;right:-10px;top:-12px"><path d="M12 2 L13.8 9.2 L21 11 L13.8 12.8 L12 20 L10.2 12.8 L3 11 L10.2 9.2 Z" fill="#FFC93C"/></svg>`;
const langSeg = () => `<div class="seg" role="group" aria-label="${t('language')}"><button class="${lang === 'en' ? 'on' : ''}" data-act="lang" data-v="en">EN</button><button class="${lang === 'es' ? 'on' : ''}" data-act="lang" data-v="es">ES</button></div>`;

// ---------- bill status ----------
const isOverdue = b => ['sent', 'opened'].includes(b.status) && (Date.now() - new Date(b.sent_at)) > 7 * 864e5;
function chip(b) {
  if (b.status === 'paid') return `<span class="chip c-paid">${t('stPaid')}</span>`;
  if (b.status === 'void') return `<span class="chip c-void">${t('stVoid')}</span>`;
  if (b.status === 'reported') return `<span class="chip c-rep">${t('stReported')}</span>`;
  if (isOverdue(b)) return `<span class="chip c-over">${t('overdue')}</span>`;
  return `<span class="chip c-wait">${b.status === 'opened' ? t('stOpened') : t('stSent')}</span>`;
}
function totals() {
  const ws = weekStart(new Date()).getTime();
  const live = S.bills.filter(b => b.status !== 'void');
  const paidWeek = live.filter(b => b.status === 'paid' && new Date(b.paid_at).getTime() >= ws);
  const waiting = live.filter(b => b.status !== 'paid' && !isOverdue(b));
  const over = live.filter(isOverdue);
  const sum = a => a.reduce((x, b) => x + total(b), 0);
  return { paidWeek, waiting, over, pS: sum(paidWeek), wS: sum(waiting), oS: sum(over) };
}

// ---------- data ----------
async function loadMe() {
  if (!S.session) { S.me = null; S.loading = false; render(); return; }
  S.loading = true; render();
  const { data: me } = await sb.from('members').select('*').eq('user_id', S.session.user.id).maybeSingle();
  S.me = me || null;
  if (S.me) {
    const { data: biz } = await sb.from('businesses').select('*').eq('id', S.me.business_id).single();
    S.biz = biz;
    if (S.me.role === 'crew') S.who = S.me.user_id;
    await refresh();
  }
  S.loading = false; render();
}
async function refresh() {
  const ws = parseYmd(S.week);
  const q = [
    sb.from('members').select('*').order('created_at'),
    sb.from('clients').select('*').order('name'),
    sb.from('jobs').select('*').gte('job_date', ymd(ws)).lte('job_date', ymd(addDays(ws, 6))).order('job_date').order('start_time'),
    sb.from('jobs').select('*').eq('job_date', ymd(new Date())).order('start_time')
  ];
  const hw = parseYmd(S.hoursWeek);
  q.push(sb.from('time_entries').select('*').gte('clock_in', hw.toISOString()).lt('clock_in', addDays(hw, 7).toISOString()).order('clock_in'));
  q.push(sb.from('time_entries').select('*').eq('user_id', S.me.user_id).is('clock_out', null).limit(1));
  if (isOwner()) { q.push(sb.from('bills').select('*').order('sent_at', { ascending: false }).limit(1000)); q.push(sb.from('member_pay').select('*')); }
  const r = await Promise.all(q);
  if (r.some(x => x.error)) toast(t('errGeneric'));
  S.members = r[0].data || []; S.clients = r[1].data || []; S.jobs = r[2].data || []; S.todayJobs = r[3].data || [];
  S.entries = r[4].data || []; S.openEntry = (r[5].data || [])[0] || null;
  S.bills = (r[6] && r[6].data) || []; S.pay = (r[7] && r[7].data) || [];
}
async function loadEntries() {
  const hw = parseYmd(S.hoursWeek);
  const { data } = await sb.from('time_entries').select('*').gte('clock_in', hw.toISOString()).lt('clock_in', addDays(hw, 7).toISOString()).order('clock_in');
  S.entries = data || [];
}
// ---------- hours ----------
const entryHours = e => Math.max(0, ((e.clock_out ? new Date(e.clock_out) : new Date()) - new Date(e.clock_in)) / 36e5);
const fmtHM = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
const rateOf = id => Number((S.pay.find(p => p.user_id === id) || {}).hourly_rate || 0);
const fmtClock = s => new Date(s).toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit' });
const toLocalInput = s => { if (!s) return ''; const d = new Date(s); return `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function clockCard() {
  const o = S.openEntry;
  if (o) return `<div class="card col" style="background:#E7F7EF;border-color:#A9DFC3;padding:16px">
    <div class="between"><span class="chip c-paid">● ${t('clockedIn')}</span><span class="muted small">${t('since')} ${esc(fmtClock(o.clock_in))}</span></div>
    <div class="h" style="font-size:40px;line-height:1" id="clockTimer">${fmtHM(entryHours(o))}</div>
    <button class="big ghost" data-act="clockOut">${t('clockOut')}</button></div>`;
  const mineWeek = S.entries.filter(e => e.user_id === S.me.user_id).reduce((x, e) => x + entryHours(e), 0);
  return `<div class="card col" style="padding:16px">
    <div class="between"><b>${t('timeClock')}</b><span class="muted small">${t('thisWeek')}: ${fmtHM(mineWeek)}</span></div>
    <button class="big tealbtn" data-act="clockIn">${t('clockIn')}</button></div>`;
}

// ---------- views ----------
function viewAuth() {
  const up = S.authMode === 'up';
  return `<div class="pad" style="justify-content:center;padding-bottom:40px">
  <div class="between"><div class="h" style="font-size:36px">Limpi<span class="pink">empo</span></div>${langSeg()}</div>
  <h1 class="h" style="font-size:26px">${up ? t('createAccount') : t('signIn')}</h1>
  <form data-form="auth" class="col">
    <label class="f">${t('email')}<input class="in" id="au_email" type="email" autocomplete="email" required></label>
    <label class="f">${t('password')}<input class="in" id="au_pass" type="password" minlength="6" autocomplete="${up ? 'new-password' : 'current-password'}" required></label>
    <button class="big pinkbtn" type="submit">${up ? t('createAccount') : t('signIn')}</button>
  </form>
  <button class="link" data-act="authMode">${up ? t('haveAccount') : t('noAccount')}</button>
  ${up ? '' : `<button class="link" style="color:var(--muted)" data-act="forgot">${t('forgot')}</button>`}
</div>`;
}
function viewOnboard() {
  return `<div class="pad" style="padding-bottom:40px">
  <div class="between"><h1 class="h" style="font-size:32px">${t('welcome')}</h1>${langSeg()}</div>
  <form data-form="start" class="card col" style="padding:18px">
    <h2 class="h" style="font-size:22px">${t('startBiz')}</h2><p class="muted small" style="margin:0">${t('startBizD')}</p>
    <label class="f">${t('bizName')}<input class="in" id="ob_biz" required placeholder="Rosa’s Cleaning"></label>
    <label class="f">${t('yourName')}<input class="in" id="ob_name" required autocomplete="given-name"></label>
    <label class="f">${t('phone')}<input class="in" id="ob_phone" inputmode="tel" autocomplete="tel"></label>
    <button class="big pinkbtn" type="submit">${t('startBtn')}</button>
  </form>
  <form data-form="join" class="card col" style="padding:18px">
    <h2 class="h" style="font-size:22px">${t('joinTeam')}</h2><p class="muted small" style="margin:0">${t('joinTeamD')}</p>
    <label class="f">${t('joinCode')}<input class="in" id="jn_code" required autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.1em"></label>
    <label class="f">${t('yourName')}<input class="in" id="jn_name" required autocomplete="given-name"></label>
    <label class="f">${t('phone')}<input class="in" id="jn_phone" inputmode="tel" autocomplete="tel"></label>
    <button class="big tealbtn" type="submit">${t('joinBtn')}</button>
  </form>
  <button class="link" data-act="signOut">${t('signOut')}</button>
</div>`;
}
function tabs() {
  const list = isOwner()
    ? [['today', I.house('currentColor'), t('tToday')], ['schedule', I.cal, t('tSchedule')], ['bills', I.bill, t('tBills')], ['hours', I.clock, t('tHours')], ['clients', I.people, t('tClients')], ['me', I.me, t('tMe')]]
    : [['today', I.house('currentColor'), t('tToday')], ['schedule', I.cal, t('tSchedule')], ['hours', I.clock, t('tHours')], ['me', I.me, t('tMe')]];
  const rep = S.bills.filter(b => b.status === 'reported').length;
  return `<nav class="tabs" aria-label="Main"><div class="in2" style="--n:${list.length}">${list.map(([k, ic, l]) =>
    `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${ic}${l}${k === 'bills' && rep ? `<span class="badge">${rep}</span>` : ''}</button>`).join('')}</div></nav>`;
}
function jobCard(j, { showBill = false, showDate = false, clickable = false } = {}) {
  const c = client(j.client_id) || {};
  const crewNames = (j.crew || []).map(id => member(id)).filter(Boolean).map(m => esc(m.name)).join(' + ');
  let right = '';
  if (showBill && isOwner()) {
    const b = S.bills.find(x => x.job_id === j.id && x.status !== 'void');
    right = b ? `<button class="chip" style="border:none;background:none;padding:0" data-act="openBill" data-v="${b.id}">${chip(b)}</button>`
      : `<button class="chip" style="background:var(--pink);color:#fff;border:none;padding:10px 14px;font-size:14px" data-act="newBill" data-job="${j.id}">${t('sendBill')}</button>`;
  }
  const inner = `<div style="width:62px;flex-shrink:0"><div class="h" style="font-size:16px">${esc(fmtTime(j.start_time)) || '—'}</div>${showDate ? `<div class="muted small">${esc(fmtDate(parseYmd(j.job_date), { weekday: 'short' }))}</div>` : ''}<div class="muted small" style="font-weight:800">${t('hrs', Number(j.hours || 0))}</div></div>
    <div class="grow"><div style="font-weight:800;font-size:16px">${esc(c.name || '—')}</div>
      ${c.address ? `<a class="small" style="display:inline-flex;align-items:center;gap:4px;color:var(--muted);text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}">${I.pin}${esc(c.address)}</a>` : ''}
      ${j.notes ? `<div class="small" style="margin-top:2px">${esc(j.notes)}</div>` : ''}
      ${(j.crew || []).length ? `<div class="row" style="gap:8px;margin-top:8px"><span class="stack">${j.crew.map(av).join('')}</span><span class="small" style="font-weight:700">${crewNames}</span></div>` : ''}
    </div>${right}`;
  return clickable && isOwner()
    ? `<div class="card row" style="align-items:flex-start;cursor:pointer" data-act="editJob" data-v="${j.id}">${inner}</div>`
    : `<div class="card row" style="align-items:flex-start">${inner}</div>`;
}
function viewToday() {
  const mine = isOwner() ? S.todayJobs : S.todayJobs.filter(j => (j.crew || []).includes(S.me.user_id));
  const tt = totals();
  return `<div class="pad">
  <div class="between"><div class="h" style="font-size:28px">Limpi<span class="pink">empo</span></div>
    <div aria-hidden="true" class="av" style="width:44px;height:44px;border-radius:22px;background:${esc(S.me.color)};font-size:18px">${esc((S.me.name || '?')[0].toUpperCase())}</div></div>
  <div><h1 class="h" style="font-size:30px">${esc(t('hola', S.me.name))}</h1><p class="muted" style="margin:2px 0 0;font-size:16px">${mine.length ? t('jobsToday', mine.length) : t('noJobsToday')}</p></div>
  ${clockCard()}
  ${isOwner() ? `<button data-act="tab" data-v="bills" style="text-align:left;border:none;background:var(--teal);border-radius:24px;padding:20px;color:#fff;position:relative;overflow:hidden">${sparkle}
    <span style="display:block;font-size:14px;font-weight:700;color:#D3F5F3">${t('paidWeek')}</span>
    <span class="h" style="display:block;font-size:42px;line-height:1">${money0(tt.pS)}</span>
    <span class="row" style="gap:8px;margin-top:8px"><span class="chip" style="background:#fff;color:#0B5F5E">${t('nPaid', tt.paidWeek.length)}</span><span class="chip" style="background:var(--sun);color:var(--ink)">${t('nWaiting', tt.waiting.length + tt.over.length)}</span></span>
  </button>` : ''}
  <h2 class="h" style="font-size:22px">${isOwner() ? t('tToday') : t('yourJobs')}</h2>
  <div class="col">${mine.length ? mine.map(j => jobCard(j, { showBill: true })).join('') : `<div class="card muted center" style="padding:22px">${t('noJobsToday')}</div>`}</div>
  ${isOwner() ? `<button class="big pinkbtn" data-act="newBill">${I.plus('#fff')}${t('sendABill')}</button>` : ''}
</div>`;
}
function viewSchedule() {
  const ws = parseYmd(S.week); const days = [...Array(7)].map((_, i) => addDays(ws, i)); const today = ymd(new Date());
  const hours = {}; S.jobs.forEach(j => (j.crew || []).forEach(id => { hours[id] = (hours[id] || 0) + Number(j.hours || 0); }));
  const jobs = S.jobs.filter(j => j.job_date === S.day && (S.who === 'all' || (j.crew || []).includes(S.who)));
  const who = isOwner() ? activeMembers() : activeMembers().filter(m => m.user_id === S.me.user_id);
  const dayBody = t('dayTitle', fmtDate(parseYmd(S.day), { weekday: 'long', month: 'short', day: 'numeric' })) + '\n' +
    S.jobs.filter(j => j.job_date === S.day).map(j => { const c = client(j.client_id) || {}; return `• ${fmtTime(j.start_time)} ${c.name || ''}${c.address ? ' — ' + c.address : ''} (${(j.crew || []).map(id => (member(id) || {}).name).filter(Boolean).join(', ')})`; }).join('\n');
  return `<div class="pad" style="gap:14px">
  <div class="between"><h1 class="h" style="font-size:30px">${t('schedule')}</h1>
    <div class="row" style="gap:4px"><button class="x" aria-label="Previous week" data-act="week" data-v="-1">‹</button><button class="x" aria-label="Next week" data-act="week" data-v="1">›</button></div></div>
  <div class="muted small" style="margin-top:-8px;font-weight:700">${esc(fmtDate(days[0], { month: 'short', day: 'numeric' }))} – ${esc(fmtDate(days[6], { month: 'short', day: 'numeric' }))}</div>
  <div class="days">${days.map(d => { const k = ymd(d); const n = S.jobs.filter(j => j.job_date === k).length; return `<button class="day ${S.day === k ? 'on' : ''} ${k === today ? 'today' : ''}" data-act="day" data-v="${k}" aria-pressed="${S.day === k}"><small>${esc(fmtDate(d, { weekday: 'short' }))}</small><b>${d.getDate()}</b><small style="opacity:.8">${n ? '•'.repeat(Math.min(n, 4)) : '&nbsp;'}</small></button>`; }).join('')}</div>
  <div class="scroller">
    <button class="crew ${S.who === 'all' ? 'on' : ''}" data-act="who" data-v="all" style="padding-left:14px">${t('everyone')}</button>
    ${who.map(m => `<button class="crew ${S.who === m.user_id ? 'on' : ''}" data-act="who" data-v="${m.user_id}">${av(m.user_id)}${esc(m.name)} <span class="muted" style="font-weight:700">${t('hrs', hours[m.user_id] || 0)}</span></button>`).join('')}
  </div>
  <div class="col">${jobs.length ? jobs.map(j => jobCard(j, { clickable: true })).join('') : `<div class="card muted center" style="padding:22px">${t('noJobs')}</div>`}</div>
  ${isOwner() ? `<button class="big pinkbtn" data-act="addJob">${I.plus('#fff')}${t('addJob')}</button>` : ''}
  ${isOwner() && S.jobs.some(j => j.job_date === S.day) ? `<a class="big tealbtn" style="font-size:17px" href="${esc(smsHref('', dayBody))}">${I.send('#fff')}${t('shareDay')}</a>` : ''}
</div>`;
}
function viewBills() {
  const tt = totals();
  const list = S.bills.filter(b => S.filter === 'all' ? b.status !== 'void' : S.filter === 'paid' ? b.status === 'paid' : (b.status !== 'paid' && b.status !== 'void'));
  return `<div class="pad" style="gap:14px">
  <h1 class="h" style="font-size:30px">${t('bills')}</h1>
  <div class="stats">
    <div class="stat c-paid"><small>${t('paid')} · ${t('thisWeek')}</small><b>${money0(tt.pS)}</b></div>
    <div class="stat c-wait"><small>${t('waiting')}</small><b>${money0(tt.wS)}</b></div>
    <div class="stat c-over"><small>${t('overdue')}</small><b>${money0(tt.oS)}</b></div>
  </div>
  <div class="row" style="gap:8px;flex-wrap:wrap">${[['all', t('all')], ['waiting', t('waiting')], ['paid', t('paid')]].map(([k, l]) => `<button class="pill ${S.filter === k ? 'on' : ''}" data-act="filter" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="col">${list.length ? list.map(b => { const c = client(b.client_id) || {}; return `<button class="card row" data-act="openBill" data-v="${b.id}" style="${b.status === 'reported' ? 'border:2px solid #1F6FB2' : ''}">
    <div class="grow"><div style="font-weight:800;font-size:16px">${esc(c.name || '—')}</div><div class="muted small">${esc(fmtDT(b.paid_at || b.reported_at || b.opened_at || b.sent_at))}</div></div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="h" style="font-size:18px">${money(total(b))}</span>${chip(b)}</div></button>`; }).join('') : `<div class="card muted center" style="padding:22px">${t('noBills')}</div>`}</div>
  <button class="big pinkbtn" data-act="newBill">${I.plus('#fff')}${t('sendABill')}</button>
  ${S.bills.length ? `<button class="big ghost" style="font-size:16px" data-act="exportCsv">${t('exportCsv')}</button>` : ''}
</div>`;
}
function viewClients() {
  const q = S.q.trim().toLowerCase();
  const list = S.clients.filter(c => !q || (c.name + ' ' + c.address + ' ' + c.phone).toLowerCase().includes(q));
  return `<div class="pad" style="gap:12px">
  <h1 class="h" style="font-size:30px">${t('clients')}</h1>
  <input class="in" id="cl_search" type="search" placeholder="${t('search')}" value="${esc(S.q)}" data-act-input="search" aria-label="${t('search')}">
  <button class="big pinkbtn" data-act="addClient">${I.plus('#fff')}${t('addClient')}</button>
  <div class="col">${list.length ? list.map(c => { const bs = S.bills.filter(b => b.client_id === c.id && b.status !== 'void');
    const paid = bs.filter(b => b.status === 'paid').reduce((x, b) => x + total(b), 0); const owe = bs.filter(b => b.status !== 'paid').reduce((x, b) => x + total(b), 0);
    return `<button class="card row" data-act="editClient" data-v="${c.id}"><div class="ico" style="border-radius:22px;background:#F3ECF9;color:#5B3B8C">${esc((c.name || '?')[0].toUpperCase())}</div>
      <div class="grow"><div style="font-weight:800">${esc(c.name)}</div><div class="muted small">${esc(c.address || c.phone || '')}</div><div class="muted small">${t('paidSoFar')}: ${money0(paid)}</div></div>
      ${owe ? `<span class="chip c-wait">${t('owes')} ${money0(owe)}</span>` : ''}</button>`; }).join('') : `<div class="card muted center" style="padding:22px">${t('noClients')}</div>`}</div>
</div>`;
}
function viewHours() {
  const ws = parseYmd(S.hoursWeek); const we = addDays(ws, 6);
  const people = isOwner() ? S.members.filter(m => m.active || S.entries.some(e => e.user_id === m.user_id)) : S.members.filter(m => m.user_id === S.me.user_id);
  const rows = people.map(m => { const es = S.entries.filter(e => e.user_id === m.user_id); const h = es.reduce((x, e) => x + entryHours(e), 0); return { m, es, h, rate: rateOf(m.user_id), pay: h * rateOf(m.user_id), open: es.some(e => !e.clock_out) }; });
  const totH = rows.reduce((x, r) => x + r.h, 0), totP = rows.reduce((x, r) => x + r.pay, 0);
  const entryRow = e => `<${isOwner() ? 'button' : 'div'} class="between" style="width:100%;border:none;background:none;padding:8px 0;border-top:1px solid var(--line);text-align:left;font-size:15px" ${isOwner() ? `data-act="editEntry" data-v="${e.id}"` : ''}>
      <span><b>${esc(fmtDate(new Date(e.clock_in)))}</b><br><span class="muted small">${esc(fmtClock(e.clock_in))} – ${e.clock_out ? esc(fmtClock(e.clock_out)) : t('now')}${e.edited ? ' · ' + t('edited') : ''}</span></span>
      <span style="font-weight:800${e.clock_out ? '' : ';color:#136C43'}">${fmtHM(entryHours(e))}</span></${isOwner() ? 'button' : 'div'}>`;
  return `<div class="pad" style="gap:14px">
  <div class="between"><h1 class="h" style="font-size:30px">${t('hours')}</h1>
    <div class="row" style="gap:4px"><button class="x" aria-label="Previous week" data-act="hoursWeek" data-v="-1">‹</button><button class="x" aria-label="Next week" data-act="hoursWeek" data-v="1">›</button></div></div>
  <div class="muted small" style="margin-top:-8px;font-weight:700">${esc(fmtDate(ws, { month: 'short', day: 'numeric' }))} – ${esc(fmtDate(we, { month: 'short', day: 'numeric' }))}</div>
  ${isOwner() ? `<div class="stats" style="grid-template-columns:repeat(2,1fr)"><div class="stat c-rep"><small>${t('totalHours')}</small><b>${fmtHM(totH)}</b></div><div class="stat c-paid"><small>${t('totalPay')}</small><b>${money(totP)}</b></div></div>` : ''}
  <div class="col">${rows.map(r => `<div class="card col" style="gap:6px">
    <button class="between" style="width:100%;border:none;background:none;padding:0;text-align:left" data-act="hoursWho" data-v="${r.m.user_id}" aria-expanded="${S.hoursWho === r.m.user_id || !isOwner()}">
      <span class="row" style="gap:10px">${av(r.m.user_id)}<span><b style="font-size:16px">${esc(r.m.name)}</b>${r.open ? ` <span class="chip c-paid" style="padding:2px 8px;font-size:11px">${t('clockedIn')}</span>` : ''}<br>
        ${isOwner() ? `<span class="muted small">${r.rate ? t('perHour', money(r.rate)) : t('noRate')}</span>` : ''}</span></span>
      <span style="text-align:right"><span class="h" style="font-size:20px">${fmtHM(r.h)}</span>${isOwner() ? `<br><b class="small" style="color:#136C43">${money(r.pay)}</b>` : ''}</span></button>
    ${(S.hoursWho === r.m.user_id || !isOwner()) ? `<div>${r.es.length ? r.es.map(entryRow).join('') : `<div class="muted small" style="padding:8px 0">${t('noHours')}</div>`}</div>
      ${isOwner() ? `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="pill" data-act="editRate" data-v="${r.m.user_id}">${t('setRate')}</button><button class="pill" data-act="addEntry" data-v="${r.m.user_id}">${t('addHours')}</button></div>` : ''}` : ''}
  </div>`).join('') || `<div class="card muted center" style="padding:22px">${t('noHours')}</div>`}</div>
  ${isOwner() ? `<p class="muted small" style="margin:0">${t('hoursTip')}</p><button class="big ghost" style="font-size:16px" data-act="exportHours">${t('exportCsv')}</button>` : ''}
</div>`;
}
function viewMe() {
  const inviteBody = S.biz ? t('smsInvite', S.biz.name, appUrl(), S.biz.join_code) : '';
  return `<div class="pad" style="gap:14px">
  <div class="between"><h1 class="h" style="font-size:30px">${t('settings')}</h1>${langSeg()}</div>
  <form data-form="me" class="card col" style="padding:16px">
    <div class="between"><span style="font-weight:800">${esc(S.session.user.email)}</span><span class="chip ${isOwner() ? 'c-rep' : 'c-paid'}">${isOwner() ? t('owner') : t('crewRole')}</span></div>
    <label class="f">${t('yourName')}<input class="in" id="me_name" value="${esc(S.me.name)}" required></label>
    <label class="f">${t('phone')}<input class="in" id="me_phone" value="${esc(S.me.phone)}" inputmode="tel"></label>
    <button class="big tealbtn" type="submit" style="font-size:17px;min-height:50px">${t('save')}</button>
  </form>
  ${isOwner() ? `<form data-form="biz" class="card col" style="padding:16px">
    <h2 class="h" style="font-size:20px">${t('bizSettings')}</h2>
    <label class="f">${t('bizName')}<input class="in" id="bz_name" value="${esc(S.biz.name)}" required></label>
    <label class="f">${t('phone')}<input class="in" id="bz_phone" value="${esc(S.biz.phone)}" inputmode="tel"></label>
    <div style="font-weight:800">${t('payLinks')}</div><div class="muted small" style="margin-top:-6px">${t('payLinksD')}</div>
    <label class="f">${t('pl_venmo')}<input class="in" id="bz_venmo" value="${esc(S.biz.pay_venmo)}" placeholder="${t('eg')} @rosa-cleaning" autocapitalize="off"></label>
    <label class="f">${t('pl_cashapp')}<input class="in" id="bz_cashapp" value="${esc(S.biz.pay_cashapp)}" placeholder="${t('eg')} $rosacleaning" autocapitalize="off"></label>
    <label class="f">${t('pl_zelle')}<input class="in" id="bz_zelle" value="${esc(S.biz.pay_zelle)}" placeholder="${t('eg')} (919) 555-0100" autocapitalize="off"></label>
    <label class="f">${t('pl_applecash')}<input class="in" id="bz_applecash" value="${esc(S.biz.pay_applecash)}" placeholder="${t('eg')} (919) 555-0100" inputmode="tel"></label>
    <label class="f">${t('pl_paypal')}<input class="in" id="bz_paypal" value="${esc(S.biz.pay_paypal)}" placeholder="${t('eg')} rosacleaning" autocapitalize="off"></label>
    <label class="f">${t('payInstr')}<textarea class="in" id="bz_pay" rows="2">${esc(S.biz.pay_instructions)}</textarea><span class="muted small" style="font-weight:600">${t('payInstrD')}</span></label>
    <button class="big tealbtn" type="submit" style="font-size:17px;min-height:50px">${t('save')}</button>
  </form>
  <div class="card col" style="padding:16px">
    <div class="between"><h2 class="h" style="font-size:20px">${t('myPrices')}</h2><button class="pill" data-act="editPrices">${t('edit')}</button></div>
    ${services().map(s => `<div class="between" style="font-size:15px"><span>${esc(s.label)}</span><b>${fmtPrice(s.amount)}</b></div>`).join('')}
    <div class="muted small" style="border-top:2px dashed var(--line);padding-top:8px">${esc(t('sqftUsing', fmtPrice(sqftCfg().price), sqftCfg().base.toLocaleString('en-US')))}${sqftCfg().min ? ' · ' + t('minPrice').replace(/ \(.*\)/, '') + ' ' + fmtPrice(sqftCfg().min) : ''}</div>
  </div>
  <div class="card col" style="padding:16px">
    <h2 class="h" style="font-size:20px">${t('team')}</h2>
    <div class="between"><span class="muted" style="font-weight:800">${t('joinCodeLbl')}</span><span class="h" style="font-size:30px;letter-spacing:.12em">${esc(S.biz.join_code)}</span></div>
    <a class="big sunbtn" style="font-size:17px" href="${esc(smsHref('', inviteBody))}">${I.send('#2A1F3D')}${t('inviteCrew')}</a>
    ${S.members.map(m => `<div class="row">${av(m.user_id)}<div class="grow"><div style="font-weight:800">${esc(m.name)}</div><div class="muted small">${m.role === 'owner' ? t('owner') : t('crewRole')}${m.phone ? ' · ' + esc(m.phone) : ''}</div></div>
      ${m.role === 'owner' ? '' : `<button class="switch ${m.active ? 'on' : ''}" role="switch" aria-checked="${m.active}" aria-label="${esc(m.name)} ${t('active')}" data-act="memberActive" data-v="${m.user_id}"><span></span></button>`}</div>`).join('')}
  </div>` : ''}
  <button class="big ghost" data-act="signOut" style="font-size:17px">${t('signOut')}</button>
</div>`;
}

// ---------- modals ----------
function modalJob() {
  const f = S.form;
  return `<h2 class="h" style="font-size:24px">${f.id ? t('editJob') : t('addJob')}</h2>
  ${S.clients.length ? `<label class="f">${t('client')}<select class="in" data-bind="client_id"><option value="">${t('chooseClient')}</option>${S.clients.map(c => `<option value="${c.id}" ${f.client_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`
    : `<div class="card muted">${t('noClients')}</div>`}
  <button class="link" style="align-self:flex-start;padding:0" data-act="addClient" data-back="job">${t('newClient')}</button>
  <div class="row" style="gap:10px;align-items:flex-end">
    <label class="f grow">${t('date')}<input class="in" type="date" data-bind="job_date" value="${esc(f.job_date)}"></label>
    <label class="f grow">${t('time')}<input class="in" type="time" data-bind="start_time" value="${esc((f.start_time || '').slice(0, 5))}"></label>
  </div>
  <label class="f">${t('hours')}<input class="in" type="number" min="0.5" step="0.5" data-bind="hours" value="${esc(f.hours)}"></label>
  <div class="f" style="font-weight:800;font-size:14px">${t('crew')}</div>
  <div class="row" style="flex-wrap:wrap;gap:8px">${activeMembers().map(m => `<button class="crew ${f.crew.includes(m.user_id) ? 'on' : ''}" data-act="crewToggle" data-v="${m.user_id}" aria-pressed="${f.crew.includes(m.user_id)}">${av(m.user_id)}${esc(m.name)}</button>`).join('')}</div>
  <label class="f">${t('notes')}<textarea class="in" data-bind="notes" rows="2">${esc(f.notes)}</textarea></label>
  <button class="big pinkbtn" data-act="saveJob">${t('save')}</button>
  <div class="between">${f.id ? `<button class="dangerlink" data-act="deleteJob">${t('delete')}</button>` : '<span></span>'}<button class="link" data-act="closeModal">${t('cancel')}</button></div>`;
}
function draftTotal() { return (S.form.items || []).reduce((x, i) => x + (Number(i.amount) || 0), 0); }
function modalBill() {
  const f = S.form;
  return `<h2 class="h" style="font-size:24px">${t('newBill')}</h2>
  <label class="f">${t('billTo')}<select class="in" data-bind="client_id"><option value="">${t('chooseClient')}</option>${S.clients.map(c => `<option value="${c.id}" ${f.client_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
  <button class="link" style="align-self:flex-start;padding:0" data-act="addClient" data-back="bill">${t('newClient')}</button>
  <div class="f" style="font-weight:800;font-size:14px">${t('quickAdd')}</div>
  <div class="row" style="flex-wrap:wrap;gap:8px">${services().map((s, i) => `<button class="pill" data-act="preset" data-v="${i}">+ ${esc(s.label)} ${fmtPrice(s.amount)}</button>`).join('')}</div>
  <button class="link" style="align-self:flex-start;padding:0" data-act="editPrices" data-back="bill">${t('editPrices')}</button>
  <div class="card col" style="padding:12px 14px;gap:8px;background:#F2FBFA;border-color:#BFE6E3">
    <div style="font-weight:800">${t('sqftTitle')}</div>
    <div class="row" style="gap:8px"><input class="in" style="flex:1" type="number" inputmode="numeric" min="0" step="50" placeholder="${t('sqftEnter')}" aria-label="${t('sqftHome')}" data-bind="sqft" value="${esc(f.sqft || '')}">
      <span class="h" style="font-size:22px;min-width:76px;text-align:right" id="sqftCalc">${f.sqft ? fmtPrice(sqftCalc(f.sqft)) : '—'}</span></div>
    <button class="big tealbtn" style="font-size:16px;min-height:46px" data-act="addSqft">${t('sqftAdd')}</button>
    <div class="muted small">${esc(t('sqftUsing', fmtPrice(sqftCfg().price), sqftCfg().base.toLocaleString('en-US')))}</div>
  </div>
  <div class="col" style="gap:8px">${f.items.map((it, i) => `<div class="lineitem">
    <input class="in" aria-label="${t('item')}" placeholder="${t('item')}" data-bind="items.${i}.label" value="${esc(it.label)}">
    <input class="in" aria-label="${t('amount')}" placeholder="$" type="number" inputmode="decimal" min="0" step="0.01" data-bind="items.${i}.amount" value="${esc(it.amount)}">
    <button class="x" aria-label="${t('delete')}" data-act="rmLine" data-v="${i}">×</button></div>`).join('')}
    <button class="link" style="align-self:flex-start;padding:0" data-act="addLine">${t('addLine')}</button></div>
  <div class="card row" style="padding:10px 14px"><div class="grow"><div style="font-weight:800;font-size:15px">${t('allowTip')}</div><div class="muted small">${t('allowTipD')}</div></div>
    <button class="switch ${f.allow_tip ? 'on' : ''}" role="switch" aria-checked="${f.allow_tip}" aria-label="${t('allowTip')}" data-act="allowTip"><span></span></button></div>
  <label class="f">${t('note')}<textarea class="in" data-bind="note" rows="2">${esc(f.note)}</textarea></label>
  <div class="between"><span style="font-weight:800">${t('total')}</span><span class="h" style="font-size:30px" id="draftTotal">${money(draftTotal())}</span></div>
  <button class="big pinkbtn" data-act="createBill">${I.send('#fff')}${t('sendBillBtn')}</button>
  <button class="link" data-act="closeModal">${t('cancel')}</button>`;
}
function modalSent() {
  const b = S.bills.find(x => x.id === S.modal.id); const c = client(b.client_id) || {};
  const body = t('smsBill', S.biz.name, money(b.subtotal), billUrl(b.token));
  return `<div class="center col" style="align-items:center">
    <div style="width:72px;height:72px;border-radius:36px;background:var(--tealL);display:flex;align-items:center;justify-content:center">${I.send('#fff')}</div>
    <h2 class="h" style="font-size:28px">${t('billCreated')}</h2>
    <div class="muted">${esc(c.name || '')} · ${money(b.subtotal)}</div></div>
  ${c.phone ? `<a class="big pinkbtn" href="${esc(smsHref(c.phone, body))}" data-act="noop">${I.send('#fff')}${t('openMessages')}</a>` : `<div class="card muted">${t('noPhone')}</div>`}
  <button class="big ghost" data-act="copyLink" data-v="${b.token}">${t('copyLink')}</button>
  <button class="link" data-act="closeModal">${t('close')}</button>`;
}
function modalBillDetail() {
  const b = S.bills.find(x => x.id === S.modal.id); if (!b) return '';
  const c = client(b.client_id) || {}; const f = S.form;
  const ev = [[b.sent_at, t('evSent'), '#0E7C7B']];
  if (b.opened_at) ev.push([b.opened_at, t('evOpened'), '#0E7C7B']);
  (b.reminders || []).forEach(r => ev.push([r, t('evReminder'), '#A3152A']));
  if (b.reported_at) ev.push([b.reported_at, t('evReported', t('m_' + (b.reported_method || 'other'))), '#1F6FB2']);
  if (b.paid_at) ev.push([b.paid_at, t('evPaid', t('m_' + (b.method || 'other'))), '#136C43']);
  ev.sort((a, z) => new Date(a[0]) - new Date(z[0]));
  const steps = ev.map(e => ({ when: fmtDT(e[0]), label: e[1], col: e[2] }));
  if (b.status !== 'paid' && b.status !== 'void') steps.push({ when: t('notYet'), label: t('stPaid'), col: '#CFC3B0', pending: true });
  const open = b.status !== 'paid' && b.status !== 'void';
  const remindBody = t('smsReminder', S.biz.name, money(total(b)), billUrl(b.token));
  return `<div class="between"><h2 class="h" style="font-size:24px">${esc(c.name || '—')}</h2>${chip(b)}</div>
  <div class="card col" style="gap:6px">
    ${(b.items || []).map(i => `<div class="between"><span>${esc(i.label)}</span><b>${money(i.amount)}</b></div>`).join('')}
    ${Number(b.tip) ? `<div class="between"><span>${t('tip')}</span><b>${money(b.tip)}</b></div>` : ''}
    <div style="border-top:2px dashed var(--line)"></div>
    <div class="between"><b>${t('total')}</b><span class="h" style="font-size:26px">${money(total(b))}</span></div>
  </div>
  <h3 class="h" style="font-size:18px">${t('history')}</h3>
  <div>${steps.map((s, i) => `<div class="step"><div class="rail"><span class="bead" style="background:${s.col}"></span>${i < steps.length - 1 ? '<span class="stem"></span>' : ''}</div>
    <div style="padding-bottom:10px"><div style="font-weight:800;${s.pending ? 'color:#8A7F9C' : ''}">${esc(s.label)}</div><div class="muted small">${esc(s.when)}</div></div></div>`).join('')}</div>
  ${b.status === 'reported' ? `<button class="big tealbtn" data-act="confirmPay">${t('confirmPay')}</button>` : ''}
  ${open ? `${c.phone ? `<a class="big pinkbtn" style="font-size:17px" href="${esc(smsHref(c.phone, remindBody))}" data-act="remind">${I.send('#fff')}${t('remind')}</a>` : ''}
  <div class="card col" style="padding:14px">
    <div style="font-weight:800">${t('method')}</div>
    <div class="row" style="flex-wrap:wrap;gap:8px">${METHODS.map(m => `<button class="pill ${f.method === m ? 'on' : ''}" data-act="method" data-v="${m}">${t('m_' + m)}</button>`).join('')}</div>
    ${b.allow_tip ? `<label class="f">${t('tip')}<input class="in" type="number" inputmode="decimal" min="0" step="0.01" data-bind="tip" value="${esc(f.tip)}"></label>` : ''}
    <button class="big ghost" style="font-size:17px" data-act="markPaid">${t('markPaid')}</button>
  </div>` : ''}
  ${b.status !== 'void' ? `<button class="big ghost" style="font-size:16px" data-act="copyLink" data-v="${b.token}">${t('copyLink')}</button>` : ''}
  <div class="between">${open ? `<button class="dangerlink" data-act="voidBill">${t('voidBill')}</button>` : '<span></span>'}<button class="link" data-act="closeModal">${t('close')}</button></div>`;
}
function modalClient() {
  const f = S.form;
  return `<h2 class="h" style="font-size:24px">${f.id ? t('editClient') : t('addClient')}</h2>
  <label class="f">${t('clientName')}<input class="in" data-bind="name" value="${esc(f.name)}" required></label>
  <label class="f">${t('phone')}<input class="in" data-bind="phone" inputmode="tel" value="${esc(f.phone)}"></label>
  <label class="f">${t('address')}<input class="in" data-bind="address" value="${esc(f.address)}"></label>
  <label class="f">${t('sqftHome')}<input class="in" type="number" inputmode="numeric" min="0" step="50" data-bind="sqft" value="${esc(f.sqft || '')}"></label>
  <label class="f">${t('notes')}<textarea class="in" data-bind="notes" rows="2">${esc(f.notes)}</textarea></label>
  ${f.id && f.phone ? `<div class="row" style="gap:8px"><a class="big ghost grow" style="font-size:16px;min-height:48px" href="tel:${esc(cleanPhone(f.phone))}">${t('call')}</a><a class="big ghost grow" style="font-size:16px;min-height:48px" href="${esc(smsHref(f.phone, ''))}">${t('text')}</a></div>` : ''}
  <button class="big pinkbtn" data-act="saveClient">${t('save')}</button>
  ${f.id ? `<button class="big tealbtn" style="font-size:17px" data-act="billClient">${I.send('#fff')}${t('sendBill')}</button>` : ''}
  <div class="between">${f.id ? `<button class="dangerlink" data-act="deleteClient">${t('delete')}</button>` : '<span></span>'}<button class="link" data-act="closeModal">${t('cancel')}</button></div>`;
}
function modalNewPass() {
  return `<h2 class="h" style="font-size:24px">${t('newPassword')}</h2>
  <form data-form="newpass" class="col"><input class="in" id="np_pass" type="password" minlength="6" autocomplete="new-password" required>
  <button class="big pinkbtn" type="submit">${t('save')}</button></form>`;
}
function modalPrices() {
  const f = S.form;
  return `<h2 class="h" style="font-size:24px">${t('myPrices')}</h2>
  <p class="muted small" style="margin:0">${t('myPricesD')}</p>
  <div class="col" style="gap:8px">${f.items.map((it, i) => `<div class="lineitem">
    <input class="in" aria-label="${t('item')}" placeholder="${t('serviceName')}" data-bind="items.${i}.label" value="${esc(it.label)}">
    <input class="in" aria-label="${t('amount')}" placeholder="$" type="number" inputmode="decimal" min="0" step="0.01" data-bind="items.${i}.amount" value="${esc(it.amount)}">
    <button class="x" aria-label="${t('delete')}" data-act="rmLine" data-v="${i}">×</button></div>`).join('')}
    <button class="link" style="align-self:flex-start;padding:0" data-act="addLine">${t('addService')}</button></div>
  <div class="card col" style="padding:14px;gap:8px;background:#F2FBFA;border-color:#BFE6E3">
    <div style="font-weight:800">${t('sqftRate')}</div><div class="muted small" style="margin-top:-4px">${t('sqftRateD')}</div>
    <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><span style="font-weight:800">$</span>
      <input class="in" style="width:96px" type="number" inputmode="decimal" min="0" step="1" aria-label="${t('price')}" data-bind="sqft_price" value="${esc(f.sqft_price)}">
      <span style="font-weight:700">${t('sqftFor')}</span>
      <input class="in" style="width:110px" type="number" inputmode="numeric" min="0" step="100" aria-label="${t('sqftHome')}" data-bind="sqft_base" value="${esc(f.sqft_base)}">
      <span style="font-weight:700">${t('sqftUnit')}</span></div>
    <label class="f">${t('minPrice')}<input class="in" type="number" inputmode="decimal" min="0" step="1" data-bind="min_price" value="${esc(f.min_price)}" placeholder="${t('eg')} 120"></label>
  </div>
  <button class="big pinkbtn" data-act="savePrices">${t('save')}</button>
  <button class="link" data-act="closeModal">${t('cancel')}</button>`;
}
function modalEntry() {
  const f = S.form; const m = member(f.user_id) || {};
  return `<h2 class="h" style="font-size:24px">${f.id ? t('fixHours') : t('addHours')}</h2>
  <div class="row" style="gap:10px">${av(f.user_id)}<b>${esc(m.name || '')}</b></div>
  <label class="f">${t('clockInAt')}<input class="in" type="datetime-local" data-bind="clock_in" value="${esc(f.clock_in)}"></label>
  <label class="f">${t('clockOutAt')}<input class="in" type="datetime-local" data-bind="clock_out" value="${esc(f.clock_out)}"></label>
  <label class="f">${t('notes')}<input class="in" data-bind="note" value="${esc(f.note)}"></label>
  <button class="big pinkbtn" data-act="saveEntry">${t('save')}</button>
  <div class="between">${f.id ? `<button class="dangerlink" data-act="deleteEntry">${t('delete')}</button>` : '<span></span>'}<button class="link" data-act="closeModal">${t('cancel')}</button></div>`;
}
function modalRate() {
  const f = S.form; const m = member(f.user_id) || {};
  return `<h2 class="h" style="font-size:24px">${t('setRate')}</h2>
  <div class="row" style="gap:10px">${av(f.user_id)}<b>${esc(m.name || '')}</b></div>
  <label class="f">${t('hourlyRate')}<input class="in" type="number" inputmode="decimal" min="0" step="0.25" data-bind="rate" value="${esc(f.rate)}" placeholder="${t('eg')} 18"></label>
  <p class="muted small" style="margin:0">${t('rateNote')}</p>
  <button class="big pinkbtn" data-act="saveRate">${t('save')}</button>
  <button class="link" data-act="closeModal">${t('cancel')}</button>`;
}
const MODALS = { entry: modalEntry, rate: modalRate, prices: modalPrices, job: modalJob, bill: modalBill, sent: modalSent, billDetail: modalBillDetail, client: modalClient, newpass: modalNewPass };

// ---------- render ----------
function render() {
  document.documentElement.lang = lang;
  const app = document.getElementById('app');
  const focusId = document.activeElement && document.activeElement.id;
  const selStart = focusId && document.activeElement.selectionStart;
  const sheet = app.querySelector('.sheet'); const sheetTop = sheet ? sheet.scrollTop : 0;
  let html;
  if (S.loading) html = `<div class="spinner" role="status" aria-label="${t('loading')}"></div>`;
  else if (!S.session) html = viewAuth();
  else if (!S.me) html = viewOnboard();
  else html = ({ today: viewToday, schedule: viewSchedule, bills: viewBills, hours: viewHours, clients: viewClients, me: viewMe }[S.tab] || viewToday)() + tabs();
  if (S.modal && MODALS[S.modal.type]) html += `<div class="overlay" data-act="overlay"><div class="sheet" role="dialog" aria-modal="true">${MODALS[S.modal.type]()}</div></div>`;
  if (S.toast) html += `<div class="toast" role="status">${esc(S.toast)}</div>`;
  app.innerHTML = `<div class="wrap">${html}</div>`;
  const ns = app.querySelector('.sheet'); if (ns && sheet) ns.scrollTop = sheetTop;
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (selStart != null) el.setSelectionRange(selStart, selStart); } catch (e) {} } }
}
let toastTimer;
function toast(msg) { S.toast = msg; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2800); }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast(t('linkCopied')); }
  catch (e) { window.prompt(t('copyLink'), text); }
}
function setPath(o, path, v) { const p = path.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) x = x[p[i]]; x[p[p.length - 1]] = v; }

// ---------- actions ----------
async function act(a, el) {
  const v = el.dataset.v;
  switch (a) {
    case 'noop': return;
    case 'lang': lang = v; setLang(v); break;
    case 'authMode': S.authMode = S.authMode === 'in' ? 'up' : 'in'; break;
    case 'forgot': {
      const email = (document.getElementById('au_email') || {}).value;
      if (!email) { toast(t('email') + '?'); return; }
      await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() }); toast(t('resetSent')); return;
    }
    case 'signOut': await sb.auth.signOut(); S.me = null; S.biz = null; S.tab = 'today'; S.modal = null; break;
    case 'tab': S.tab = v; S.modal = null; window.scrollTo(0, 0); break;
    case 'day': S.day = v; break;
    case 'week': {
      const ws = addDays(parseYmd(S.week), Number(v) * 7); const dow = parseYmd(S.day).getDay();
      S.week = ymd(ws); S.day = ymd(addDays(ws, dow)); await refresh(); break;
    }
    case 'who': S.who = v; break;
    case 'filter': S.filter = v; break;
    case 'overlay': if (el === lastTarget) S.modal = null; else return; break;
    case 'closeModal': S.modal = S.form._back ? S.form._back.modal : null; if (S.form._back) S.form = S.form._back.form; break;
    // bills
    case 'newBill': {
      const j = el.dataset.job ? (S.todayJobs.find(x => x.id === el.dataset.job) || S.jobs.find(x => x.id === el.dataset.job)) : null;
      S.form = { client_id: j ? j.client_id : '', job_id: j ? j.id : null, items: [], allow_tip: true, note: t('noteDefault') };
      S.modal = { type: 'bill' }; break;
    }
    case 'billClient': { const id = S.form.id; S.form = { client_id: id, job_id: null, items: [], allow_tip: true, note: t('noteDefault') }; S.modal = { type: 'bill' }; break; }
    case 'preset': { const s = services()[Number(v)]; S.form.items.push({ label: s.label, amount: s.amount }); break; }
    case 'editPrices': {
      const back = el.dataset.back ? { modal: S.modal, form: S.form } : null; const c = sqftCfg();
      S.form = { items: services().map(s => ({ label: s.label, amount: s.amount })), sqft_price: c.price, sqft_base: c.base, min_price: c.min || '', _back: back }; S.modal = { type: 'prices' }; break;
    }
    case 'addSqft': {
      const n = Math.round(Number(S.form.sqft)); if (!n || n <= 0) { toast(t('sqftEnter')); return; }
      S.form.items.push({ label: t('sqftLine', n.toLocaleString('en-US')), amount: sqftCalc(n) }); break;
    }
    case 'savePrices': {
      const list = S.form.items.map(i => ({ label: String(i.label || '').trim(), amount: Math.round(Number(i.amount) * 100) / 100 })).filter(i => i.label && i.amount >= 0 && !isNaN(i.amount));
      const f2 = S.form; const sp = Number(f2.sqft_price), sb2 = Math.round(Number(f2.sqft_base)), mp = Number(f2.min_price) || 0;
      const { data, error } = await sb.from('businesses').update({ services: list, sqft_price: sp > 0 ? sp : null, sqft_base: sb2 > 0 ? sb2 : null, min_price: mp > 0 ? mp : null }).eq('id', S.biz.id).select().single();
      if (error) { toast(t('errGeneric')); return; }
      S.biz = data; const back = S.form._back;
      if (back) { S.modal = back.modal; S.form = back.form; } else S.modal = null;
      toast(t('saved')); break;
    }
    case 'addLine': S.form.items.push({ label: '', amount: '' }); break;
    case 'rmLine': S.form.items.splice(Number(v), 1); break;
    case 'allowTip': S.form.allow_tip = !S.form.allow_tip; break;
    case 'createBill': {
      const f = S.form; if (!f.client_id) { toast(t('needClient')); return; }
      const items = f.items.map(i => ({ label: String(i.label || '').trim(), amount: Math.round(Number(i.amount) * 100) / 100 })).filter(i => i.label && i.amount > 0);
      if (!items.length) { toast(t('needItems')); return; }
      const subtotal = Math.round(items.reduce((x, i) => x + i.amount, 0) * 100) / 100;
      const { data, error } = await sb.from('bills').insert({ business_id: S.me.business_id, client_id: f.client_id, job_id: f.job_id || null, items, subtotal, allow_tip: !!f.allow_tip, note: f.note || '', created_by: S.me.user_id }).select().single();
      if (error) { toast(t('errGeneric')); return; }
      S.bills.unshift(data); S.modal = { type: 'sent', id: data.id }; S.form = {}; break;
    }
    case 'openBill': { const b = S.bills.find(x => x.id === v); S.form = { method: b.reported_method || '', tip: Number(b.tip) || '' }; S.modal = { type: 'billDetail', id: v }; break; }
    case 'method': S.form.method = v; break;
    case 'copyLink': copy(billUrl(v)); return;
    case 'remind': {
      const b = S.bills.find(x => x.id === S.modal.id); const reminders = [...(b.reminders || []), new Date().toISOString()];
      const { error } = await sb.from('bills').update({ reminders }).eq('id', b.id); if (!error) b.reminders = reminders; break;
    }
    case 'confirmPay': case 'markPaid': {
      const b = S.bills.find(x => x.id === S.modal.id);
      const patch = a === 'confirmPay' ? { status: 'paid', paid_at: new Date().toISOString(), method: b.reported_method || 'other' }
        : { status: 'paid', paid_at: new Date().toISOString(), method: S.form.method || 'cash', tip: b.allow_tip ? Math.max(0, Number(S.form.tip) || 0) : 0 };
      const { data, error } = await sb.from('bills').update(patch).eq('id', b.id).select().single();
      if (error) { toast(t('errGeneric')); return; } Object.assign(b, data); toast(t('stPaid') + ' · ' + money(total(b))); break;
    }
    case 'voidBill': {
      if (!window.confirm(t('voidConfirm'))) return;
      const b = S.bills.find(x => x.id === S.modal.id);
      const { error } = await sb.from('bills').update({ status: 'void' }).eq('id', b.id); if (!error) b.status = 'void'; S.modal = null; break;
    }
    case 'exportCsv': {
      const rows = [['Client', 'Sent', 'Items', 'Subtotal', 'Tip', 'Total', 'Status', 'Paid on', 'Method']].concat(S.bills.map(b => [
        (client(b.client_id) || {}).name || '', (b.sent_at || '').slice(0, 10), (b.items || []).map(i => i.label).join(' + '),
        Number(b.subtotal).toFixed(2), Number(b.tip || 0).toFixed(2), total(b).toFixed(2), b.status, (b.paid_at || '').slice(0, 10), b.method || '']));
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const aEl = document.createElement('a'); aEl.href = url; aEl.download = `limpiempo-bills-${ymd(new Date())}.csv`; document.body.appendChild(aEl); aEl.click(); aEl.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000); return;
    }
    // jobs
    case 'addJob': S.form = { id: null, client_id: '', job_date: S.day, start_time: '09:00', hours: 3, crew: [], notes: '' }; S.modal = { type: 'job' }; break;
    case 'editJob': { const j = S.jobs.find(x => x.id === v); S.form = { ...j, crew: [...(j.crew || [])], start_time: (j.start_time || '').slice(0, 5) }; S.modal = { type: 'job' }; break; }
    case 'crewToggle': { const c = S.form.crew; const i = c.indexOf(v); if (i >= 0) c.splice(i, 1); else c.push(v); break; }
    case 'saveJob': {
      const f = S.form; if (!f.client_id) { toast(t('needClient')); return; }
      const row = { business_id: S.me.business_id, client_id: f.client_id, job_date: f.job_date, start_time: f.start_time || null, hours: Number(f.hours) || 0, crew: f.crew, notes: f.notes || '' };
      const { error } = f.id ? await sb.from('jobs').update(row).eq('id', f.id) : await sb.from('jobs').insert(row);
      if (error) { toast(t('errGeneric')); return; }
      S.day = f.job_date; S.week = ymd(weekStart(parseYmd(f.job_date))); S.modal = null; await refresh(); toast(t('saved')); break;
    }
    case 'deleteJob': {
      if (!window.confirm(t('confirmDelete'))) return;
      await sb.from('jobs').delete().eq('id', S.form.id); S.modal = null; await refresh(); break;
    }
    // clients
    case 'addClient': {
      const back = el.dataset.back ? { modal: S.modal, form: S.form } : null;
      S.form = { id: null, name: '', phone: '', address: '', notes: '', _back: back }; S.modal = { type: 'client' }; break;
    }
    case 'editClient': { const c = client(v); S.form = { ...c }; S.modal = { type: 'client' }; break; }
    case 'saveClient': {
      const f = S.form; if (!String(f.name || '').trim()) { toast(t('client') + '?'); return; }
      const row = { business_id: S.me.business_id, name: f.name.trim(), phone: f.phone || '', address: f.address || '', notes: f.notes || '', sqft: Math.round(Number(f.sqft)) > 0 ? Math.round(Number(f.sqft)) : null };
      const res = f.id ? await sb.from('clients').update(row).eq('id', f.id).select().single() : await sb.from('clients').insert(row).select().single();
      if (res.error) { toast(t('errGeneric')); return; }
      if (f.id) Object.assign(client(f.id), res.data); else { S.clients.push(res.data); S.clients.sort((x, y) => x.name.localeCompare(y.name)); }
      if (f._back) { S.modal = f._back.modal; S.form = f._back.form; S.form.client_id = res.data.id; } else S.modal = null;
      toast(t('saved')); break;
    }
    case 'deleteClient': {
      if (!window.confirm(t('confirmDelete'))) return;
      await sb.from('clients').delete().eq('id', S.form.id); S.clients = S.clients.filter(c => c.id !== S.form.id); S.modal = null; break;
    }
    case 'memberActive': {
      const m = member(v); const { error } = await sb.from('members').update({ active: !m.active }).eq('user_id', v);
      if (!error) m.active = !m.active; break;
    }
    case 'clockIn': {
      const { error } = await sb.rpc('clock_in'); if (error) { toast(/already/i.test(error.message) ? t('alreadyIn') : t('errGeneric')); }
      await refresh(); if (!error) toast(t('clockedInToast')); break;
    }
    case 'clockOut': {
      const { error } = await sb.rpc('clock_out'); if (error) toast(t('errGeneric'));
      const h = S.openEntry ? entryHours(S.openEntry) : 0; await refresh(); if (!error) toast(t('clockedOutToast', fmtHM(h))); break;
    }
    case 'hoursWeek': S.hoursWeek = ymd(addDays(parseYmd(S.hoursWeek), Number(v) * 7)); await loadEntries(); break;
    case 'hoursWho': S.hoursWho = S.hoursWho === v ? null : v; break;
    case 'editEntry': { const e = S.entries.find(x => x.id === v); S.form = { id: e.id, user_id: e.user_id, clock_in: toLocalInput(e.clock_in), clock_out: toLocalInput(e.clock_out), note: e.note || '' }; S.modal = { type: 'entry' }; break; }
    case 'addEntry': { const d = parseYmd(S.hoursWeek); const day = ymd(new Date()) >= S.hoursWeek && ymd(new Date()) <= ymd(addDays(d, 6)) ? ymd(new Date()) : S.hoursWeek; S.form = { id: null, user_id: v, clock_in: day + 'T09:00', clock_out: day + 'T15:00', note: '' }; S.modal = { type: 'entry' }; break; }
    case 'saveEntry': {
      const f = S.form; if (!f.clock_in) { toast(t('clockInAt') + '?'); return; }
      const ci = new Date(f.clock_in), co = f.clock_out ? new Date(f.clock_out) : null;
      if (co && co <= ci) { toast(t('outAfterIn')); return; }
      const row = { business_id: S.me.business_id, user_id: f.user_id, clock_in: ci.toISOString(), clock_out: co ? co.toISOString() : null, note: f.note || '', edited: true };
      const { error } = f.id ? await sb.from('time_entries').update(row).eq('id', f.id) : await sb.from('time_entries').insert(row);
      if (error) { toast(t('errGeneric')); return; }
      S.hoursWeek = ymd(weekStart(ci)); S.modal = null; await refresh(); toast(t('saved')); break;
    }
    case 'deleteEntry': { if (!window.confirm(t('confirmDelete'))) return; await sb.from('time_entries').delete().eq('id', S.form.id); S.modal = null; await refresh(); break; }
    case 'editRate': S.form = { user_id: v, rate: rateOf(v) || '' }; S.modal = { type: 'rate' }; break;
    case 'saveRate': {
      const r = Math.max(0, Number(S.form.rate) || 0);
      const { error } = await sb.from('member_pay').upsert({ user_id: S.form.user_id, business_id: S.me.business_id, hourly_rate: r }, { onConflict: 'user_id' });
      if (error) { toast(t('errGeneric')); return; } S.modal = null; await refresh(); toast(t('saved')); break;
    }
    case 'exportHours': {
      const ws = parseYmd(S.hoursWeek);
      const rows = [['Name', 'Date', 'Clock in', 'Clock out', 'Hours', 'Rate', 'Pay', 'Edited', 'Note']].concat(S.entries.map(e => { const m = member(e.user_id) || {}; const h = entryHours(e); return [m.name || '', ymd(new Date(e.clock_in)), fmtClock(e.clock_in), e.clock_out ? fmtClock(e.clock_out) : '', h.toFixed(2), rateOf(e.user_id).toFixed(2), (h * rateOf(e.user_id)).toFixed(2), e.edited ? 'yes' : '', e.note || '']; }));
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const aEl = document.createElement('a'); aEl.href = url; aEl.download = `limpiempo-hours-${ymd(ws)}.csv`; document.body.appendChild(aEl); aEl.click(); aEl.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000); return;
    }
    default: return;
  }
  render();
}

// ---------- forms ----------
async function submit(name) {
  const val = id => (document.getElementById(id) || {}).value || '';
  try {
    if (name === 'auth') {
      const email = val('au_email').trim(), password = val('au_pass');
      const r = S.authMode === 'up' ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } }) : await sb.auth.signInWithPassword({ email, password });
      if (r.error) { toast(t('authError')); return; }
      if (S.authMode === 'up' && !r.data.session) { S.authMode = 'in'; toast(t('checkEmail')); }
      return;
    }
    if (name === 'start') {
      const { error } = await sb.rpc('create_business', { p_business: val('ob_biz'), p_name: val('ob_name'), p_phone: val('ob_phone') });
      if (error) { toast(t('errGeneric')); return; } await loadMe(); return;
    }
    if (name === 'join') {
      const { error } = await sb.rpc('join_business', { p_code: val('jn_code'), p_name: val('jn_name'), p_phone: val('jn_phone') });
      if (error) { toast(/code/i.test(error.message) ? t('codeNotFound') : t('errGeneric')); return; } await loadMe(); return;
    }
    if (name === 'me') {
      const { data, error } = await sb.from('members').update({ name: val('me_name').trim(), phone: val('me_phone').trim() }).eq('user_id', S.me.user_id).select().single();
      if (error) { toast(t('errGeneric')); return; } S.me = data; const m = member(data.user_id); if (m) Object.assign(m, data); toast(t('saved')); return;
    }
    if (name === 'biz') {
      const { data, error } = await sb.from('businesses').update({ name: val('bz_name').trim(), phone: val('bz_phone').trim(), pay_instructions: val('bz_pay').trim(), pay_venmo: handle(val('bz_venmo')), pay_cashapp: handle(val('bz_cashapp')), pay_paypal: handle(val('bz_paypal')), pay_zelle: val('bz_zelle').trim(), pay_applecash: val('bz_applecash').trim() }).eq('id', S.biz.id).select().single();
      if (error) { toast(t('errGeneric')); return; } S.biz = data; toast(t('saved')); return;
    }
    if (name === 'newpass') {
      const { error } = await sb.auth.updateUser({ password: val('np_pass') });
      if (error) { toast(t('errGeneric')); return; } S.modal = null; toast(t('saved')); return;
    }
  } catch (e) { console.error(e); toast(t('errGeneric')); }
}

// ---------- wiring ----------
let lastTarget = null;
document.addEventListener('click', e => {
  lastTarget = e.target;
  const link = e.target.closest('a'); if (link && !link.dataset.act) return;
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'overlay' && e.target !== el) return;
  if (el.tagName !== 'A') e.preventDefault();
  act(a, el).catch(err => { console.error(err); toast(t('errGeneric')); });
});
document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); submit(f.dataset.form); });
function onInput(e) {
  const el = e.target;
  if (el.dataset.bind) {
    setPath(S.form, el.dataset.bind, el.value);
    if (el.dataset.bind.startsWith('items.')) { const tEl = document.getElementById('draftTotal'); if (tEl) tEl.textContent = money(draftTotal()); }
    if (el.dataset.bind === 'sqft' && S.modal && S.modal.type === 'bill') { const c = document.getElementById('sqftCalc'); if (c) c.textContent = Number(el.value) > 0 ? fmtPrice(sqftCalc(el.value)) : '—'; }
    if (el.dataset.bind === 'client_id' && S.modal && S.modal.type === 'bill') { const c = client(el.value); if (c && c.sqft) { S.form.sqft = c.sqft; render(); } }
  } else if (el.dataset.actInput === 'search') { S.q = el.value; render(); }
}
document.addEventListener('input', onInput);
document.addEventListener('change', e => { if (e.target.tagName === 'SELECT') onInput(e); });

const APP_VERSION = '10';
async function checkVersion() {
  try {
    const v = (await (await fetch('version.txt?x=' + Date.now(), { cache: 'no-store' })).text()).trim();
    if (v && v !== APP_VERSION && sessionStorage.getItem('lp-upd') !== v) { sessionStorage.setItem('lp-upd', v); location.replace(location.pathname + '?v=' + v); }
  } catch (e) {}
}
(async function boot() {
  if (!C || !C.url || C.url.startsWith('PASTE')) {
    document.getElementById('app').innerHTML = '<div class="pad"><h1 class="h">Limpiempo</h1><p>Setup needed: put your Supabase URL and anon key in <b>config.js</b>.</p></div>';
    return;
  }
  const { data } = await sb.auth.getSession(); S.session = data.session;
  sb.auth.onAuthStateChange((ev, session) => {
    const had = S.session && S.session.user.id; S.session = session;
    if (ev === 'PASSWORD_RECOVERY') { S.modal = { type: 'newpass' }; render(); }
    if ((session && session.user.id) !== had) setTimeout(loadMe, 0);
  });
  await loadMe();
  checkVersion(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersion(); });
  setInterval(() => { const el = document.getElementById('clockTimer'); if (el && S.openEntry) el.textContent = fmtHM(entryHours(S.openEntry)); }, 30000);
  document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && S.me && !S.modal) { await refresh(); render(); } });
})();
})();
