(function () {
'use strict';
const C = window.LIMPIEMPO_CONFIG;
const sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: false } });
let lang = getLang();
const t = (k, ...a) => { const v = I18N[lang][k] ?? I18N.en[k]; return typeof v === 'function' ? v(...a) : (v ?? k); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Number(n || 0).toFixed(2);
const token = new URLSearchParams(location.search).get('t');
const S = { bill: null, tip: 20, method: '', loading: true, error: false, busy: false };
const PAY = ['zelle', 'venmo', 'applecash', 'cashapp', 'cash', 'check', 'other'];
const conf = () => [['#FFC93C', 8, 12, 12, 12, 20, 0], ['#14A3A1', 22, 30, 8, 16, -30, 0], ['#E8336D', 80, 10, 14, 9, 35, 0], ['#8B5CF6', 75, 34, 10, 10, 0, 5], ['#FF8A3D', 14, 70, 10, 10, 0, 5], ['#FFC93C', 84, 64, 9, 15, 50, 0]]
  .map(([c, x, y, w, h, r, br]) => `<span class="conf" aria-hidden="true" style="left:${x}%;top:${y}%;width:${w}px;height:${h}px;background:${c};transform:rotate(${r}deg);border-radius:${br}px"></span>`).join('');
const langSeg = () => `<div class="seg" role="group" aria-label="Language"><button class="${lang === 'en' ? 'on' : ''}" data-act="lang" data-v="en">EN</button><button class="${lang === 'es' ? 'on' : ''}" data-act="lang" data-v="es">ES</button></div>`;
const tipAmt = () => (S.bill && S.bill.allow_tip ? Math.round(Number(S.bill.subtotal) * S.tip) / 100 : 0);
const initial = n => esc((n || '?').trim()[0] || '?').toUpperCase();

function thanks(msg, amount) {
  const b = S.bill;
  const how = b.status === 'paid' ? b.method : b.reported_method;
  const phone = String(b.business_phone || '').replace(/[^\d+]/g, '');
  return `<div class="pad" style="align-items:center;text-align:center;position:relative;padding-bottom:40px">${conf()}
    <div style="align-self:flex-end">${langSeg()}</div>
    <div style="width:96px;height:96px;border-radius:48px;background:var(--tealL);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 10px #D3F5F3;margin-top:8px"><svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7"/></svg></div>
    <h1 class="h" style="font-size:40px;margin-top:8px">${t('bp_thanks')}</h1>
    <p class="muted" style="margin:0;font-size:17px;max-width:320px">${esc(msg)}</p>
    <div class="card col" style="width:100%;text-align:left;gap:8px;padding:16px">
      <div class="between"><b>${t('bp_receipt')}</b><span class="muted small">${esc(b.business)}</span></div>
      ${(b.items || []).map(i => `<div class="between" style="font-size:15px"><span>${esc(i.label)}</span><span>${money(i.amount)}</span></div>`).join('')}
      ${Number(b.tip) ? `<div class="between" style="font-size:15px"><span>${t('tip')}</span><span>${money(b.tip)}</span></div>` : ''}
      <div style="border-top:2px dashed var(--line)"></div>
      <div class="between"><b>${t('bp_total')}</b><span class="h" style="font-size:26px;color:var(--teal)">${money(amount)}</span></div>
      ${how ? `<div class="between muted small"><span>${t('bp_paidWith')}</span><b>${esc(t('m_' + how))}</b></div>` : ''}
    </div>
    ${phone ? `<a class="big ghost" style="font-size:17px" href="sms:${esc(phone)}">${esc(t('bp_textBiz', b.business))}</a>` : ''}
    <p class="muted small" style="margin:0">${t('bp_canClose')}</p>
  </div>`;
}
function view() {
  if (S.loading) return `<div class="spinner" role="status"></div>`;
  if (S.error || !S.bill) return `<div class="pad" style="justify-content:center;text-align:center"><div style="align-self:flex-end">${langSeg()}</div><h1 class="h" style="font-size:28px">Limpi<span class="pink">empo</span></h1><p class="muted" style="font-size:17px">${t('bp_notFound')}</p></div>`;
  const b = S.bill;
  if (b.status === 'paid') return thanks(t('bp_paidMsg'), Number(b.subtotal) + Number(b.tip || 0));
  if (b.status === 'reported') return thanks(t('bp_reportedMsg', b.business), Number(b.subtotal) + Number(b.tip || 0));
  const sub = Number(b.subtotal);
  return `<div class="pad" style="padding-bottom:40px;gap:14px">
  <div class="between"><div class="row" style="gap:10px"><div aria-hidden="true" class="ico" style="width:42px;height:42px;border-radius:21px;background:var(--sun);border:2px solid var(--ink)">${initial(b.business)}</div>
    <div><div class="muted small" style="font-weight:700">${t('bp_from')}</div><div style="font-weight:800">${esc(b.business)}</div></div></div>${langSeg()}</div>
  <h1 class="h" style="font-size:34px;line-height:1.05">${t('bp_sparkle')}</h1>
  ${b.note ? `<p style="margin:0;font-size:16px">${esc(b.note)}</p>` : ''}
  <div class="card col" style="border-radius:20px;padding:14px 16px;gap:8px">
    ${(b.items || []).map(i => `<div class="between" style="font-size:15px"><span>${esc(i.label)}</span><b>${money(i.amount)}</b></div>`).join('')}
    <div style="border-top:2px dashed var(--line)"></div>
    <div class="between muted" style="font-size:15px"><span>${t('bp_subtotal')}</span><b>${money(sub)}</b></div>
  </div>
  ${b.allow_tip ? `<div class="col" style="gap:8px"><h2 style="margin:0;font-size:16px">${esc(t('bp_tipQ', b.business))}</h2>
    <div class="tips">${[0, 15, 20, 25].map(p => `<button class="tip ${S.tip === p ? 'on' : ''}" data-act="tip" data-v="${p}" aria-pressed="${S.tip === p}"><b>${p ? p + '%' : t('bp_none')}</b><small>${p ? money(sub * p / 100) : '$0'}</small></button>`).join('')}</div></div>` : ''}
  <div class="between"><span style="font-weight:800;font-size:17px">${t('bp_total')}</span><span class="h" style="font-size:36px">${money(sub + tipAmt())}</span></div>
  ${b.pay_instructions ? `<div class="card" style="background:#FFF1C7;border-color:#F2D98A"><div style="font-weight:800;margin-bottom:4px">${t('bp_howPay')}</div><div style="white-space:pre-line;font-size:16px">${esc(b.pay_instructions)}</div></div>` : ''}
  <div class="col" style="gap:8px"><div style="font-weight:800">${t('bp_paidWith')}</div>
    <div class="row" style="flex-wrap:wrap;gap:8px">${PAY.map(m => `<button class="pill ${S.method === m ? 'on' : ''}" data-act="method" data-v="${m}" aria-pressed="${S.method === m}">${t('m_' + m)}</button>`).join('')}</div></div>
  <button class="big pinkbtn" data-act="paid" ${S.busy ? 'disabled' : ''}>${t('bp_iPaid')}</button>
  ${b.business_phone ? `<p class="muted center small" style="margin:0">${t('bp_questions')} <a href="tel:${esc(String(b.business_phone).replace(/[^\d+]/g, ''))}">${esc(b.business_phone)}</a></p>` : ''}
</div>`;
}
let toastTimer;
function render(msg) {
  document.documentElement.lang = lang;
  document.getElementById('app').innerHTML = `<div class="wrap">${view()}</div>` + (msg ? `<div class="toast" role="status">${esc(msg)}</div>` : '');
  if (msg) { clearTimeout(toastTimer); toastTimer = setTimeout(() => render(), 2600); }
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return; e.preventDefault();
  const a = el.dataset.act, v = el.dataset.v;
  if (a === 'lang') { lang = v; setLang(v); }
  else if (a === 'tip') S.tip = Number(v);
  else if (a === 'method') S.method = v;
  else if (a === 'paid') {
    if (!S.method) { render(t('bp_choose')); return; }
    S.busy = true; render();
    const { data, error } = await sb.rpc('report_paid', { p_token: token, p_method: S.method, p_tip: tipAmt() });
    S.busy = false;
    if (error || !data) { render(t('errGeneric')); return; }
    S.bill.status = 'reported'; S.bill.tip = tipAmt(); S.bill.reported_method = S.method;
  }
  render();
});
(async function () {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) { S.loading = false; S.error = true; render(); return; }
  const { data, error } = await sb.rpc('get_bill', { p_token: token });
  S.loading = false; S.error = !!error; S.bill = data || null; render();
})();
})();
