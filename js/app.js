/* منصة قضايا إساءة استخدام السلطة — نسخة تعمل داخل المتصفح بالكامل */
'use strict';

// ========================= أدوات عامة =========================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
const pad2 = n => String(n).padStart(2, '0');
function nowStr() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function hijriToday() {
  try {
    const p = {};
    new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' })
      .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    return `${p.day} / ${p.month} / ${p.year}`;
  } catch (e) { return ''; }
}
function formObj(form) { const o = {}; new FormData(form).forEach((v, k) => { if (typeof v === 'string') o[k] = v.trim(); }); return o; }
function toast(msg, kind) {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast' + (kind === 'error' ? ' error' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}
function blobToDataURL(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }
async function dataURLToBlob(u) { return (await fetch(u)).blob(); }
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const roleWord = r => r === 'مدعي' ? 'المدعي' : (r === 'مدعى عليه' ? 'المدعى عليه' : 'الشاهد');
const STATUSES = ['جارية', 'منجزة', 'مرفوعة'];
const ROLES = ['مدعي', 'مدعى عليه', 'شاهد'];
const RESULTS = ['حفظ الشكوى لعدم ثبوت ما يستوجب الاستمرار فيها', 'ثبوت إساءة استخدام السلطة', 'إحالة لجهة الاختصاص', 'أخرى'];

const ICON = {
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
};

// ========================= البيانات =========================
const DEFAULT_SETTINGS = {
  org_line1: 'المملكة العربية السعودية',
  org_line2: 'وزارة الداخلية',
  org_line3: 'الأمن العام',
  org_line4: 'شرطة منطقة المدينة المنورة',
  org_line5: 'شؤون الأمن',
  report_title: '( تقييم إجراءات قضية )',
  logo_file: '',
  def_order_source: 'سعادة وكيل إمارة منطقة المدينة المنورة للشؤون الأمنية',
  def_location: 'شؤون الأمن بشرطة منطقة المدينة المنورة',
  def_taker_rank: '', def_taker_name: '', taker_sig: '',
  def_prepared_title: 'مدير شعبة القضايا المالية والاقتصادية', def_prepared_rank: 'عقيد', def_prepared_name: '',
  def_reviewed_title: 'مدير إدارة الأمن الجنائي', def_reviewed_rank: 'عقيد', def_reviewed_name: '',
  def_approved_title: 'مساعد مدير الشرطة لشؤون الأمن', def_approved_rank: 'عميد', def_approved_name: '',
  lock_hash: '', lock_salt: '',
};
const TABLES = ['cases', 'parties', 'statements', 'attachments', 'reports'];
let DB = null;

function shapeDB(d) {
  d = d && typeof d === 'object' ? d : {};
  d.app = 'cases-platform'; d.version = 1;
  d.seq = d.seq || {};
  for (const t of TABLES) { d[t] = Array.isArray(d[t]) ? d[t] : []; d.seq[t] = Math.max(d.seq[t] || 0, ...d[t].map(r => r.id || 0), 0); }
  d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  d.log = Array.isArray(d.log) ? d.log : [];
  return d;
}
const S = () => DB.settings;
function nextId(t) { DB.seq[t] = (DB.seq[t] || 0) + 1; return DB.seq[t]; }
const byId = (t, id) => DB[t].find(r => r.id === +id);
function log(action, details) { DB.log.unshift({ ts: nowStr(), action, details: details || '' }); if (DB.log.length > 500) DB.log.length = 500; }

let _saveChain = Promise.resolve();
function save() {
  const snapshot = JSON.parse(JSON.stringify(DB));
  _saveChain = _saveChain.then(() => Store.backend.save(snapshot)).catch(e => {
    console.error(e); toast('تعذّر الحفظ: ' + (e.message || e), 'error'); throw e;
  });
  return _saveChain;
}

// ---- الملفات (تواقيع/مرفقات/شعار) ----
const urlCache = new Map();
async function fileURL(path) {
  if (!path) return '';
  if (urlCache.has(path)) return urlCache.get(path);
  const b = await Store.backend.getFile(path);
  if (!b) return '';
  const u = URL.createObjectURL(b);
  urlCache.set(path, u);
  return u;
}
async function putFile(path, blob) { await Store.backend.putFile(path, blob); urlCache.delete(path); }
async function delFile(path) { if (!path) return; await Store.backend.delFile(path); const u = urlCache.get(path); if (u) URL.revokeObjectURL(u); urlCache.delete(path); }
/** يملأ كل <img data-file="..."> بعد الرسم */
async function hydrateImages(root = document) {
  await Promise.all($$('img[data-file]', root).map(async img => {
    const u = await fileURL(img.dataset.file);
    if (u) img.src = u; else img.remove();
  }));
}
function safeName(n) { return (n || 'file').replace(/[\\/:*?"<>|\s]+/g, '_').slice(-80); }

// ========================= البداية =========================
const app = () => $('#app');

async function boot() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  let st;
  try { st = await Store.init(); } catch (e) { st = 'choose'; }
  if (st === 'ready') return openData();
  if (st === 'permission') return screenPermission();
  screenChoose();
}

function bareScreen(inner) {
  document.body.className = '';
  app().innerHTML = `<div class="login-wrap"><div class="login-box">${inner}</div></div>`;
}

function screenChoose() {
  bareScreen(`
    <h1>منصة قضايا إساءة استخدام السلطة</h1>
    <div class="sub">اختر مكان حفظ قاعدة البيانات على هذا الجهاز.<br>لا تُرفع أي بيانات إلى الإنترنت.</div>
    ${Store.folderSupported ? `<button class="choice" id="cFolder"><b>📁 مجلد أختاره على الجهاز</b>
      <span>تُحفظ القضايا والتواقيع والمرفقات في مجلد تختاره (على القرص أو الفلاشة). مناسب للكمبيوتر.</span></button>` : ''}
    <button class="choice" id="cBrowser"><b>🌐 داخل المتصفح</b>
      <span>تُحفظ البيانات داخل هذا المتصفح على هذا الجهاز. مناسب للجوال — احرص على أخذ نسخة احتياطية من الإعدادات.</span></button>
    ${!Store.folderSupported ? '<div class="hint" style="margin-top:12px">ميزة اختيار المجلد متاحة في متصفح Chrome أو Edge على الكمبيوتر.</div>' : ''}
  `);
  const f = $('#cFolder');
  if (f) f.onclick = async () => {
    try { const b = await Store.pickFolder(); await Store.useBackend(b); openData(); }
    catch (e) { if (e.name !== 'AbortError') toast('تعذّر فتح المجلد: ' + e.message, 'error'); }
  };
  $('#cBrowser').onclick = async () => { await Store.useBackend(Store.browser); openData(); };
}

function screenPermission() {
  bareScreen(`
    <h1>منصة قضايا إساءة استخدام السلطة</h1>
    <div class="sub">قاعدة البيانات محفوظة في المجلد: <b>${esc(Store.pendingFolderName())}</b><br>اسمح للمتصفح بالوصول إليه للمتابعة.</div>
    <button class="btn" id="pGrant">فتح المجلد والمتابعة</button>
    <button class="btn ghost" id="pOther">اختيار مكان آخر</button>
  `);
  $('#pGrant').onclick = async () => {
    try { if (await Store.grantPending()) openData(); else toast('لم يُسمح بالوصول للمجلد', 'error'); }
    catch (e) { toast('تعذّر فتح المجلد: ' + e.message + ' — ربما نُقل أو حُذف', 'error'); }
  };
  $('#pOther').onclick = screenChoose;
}

async function openData() {
  try {
    DB = shapeDB(await Store.backend.load());
  } catch (e) {
    bareScreen(`<h1>تعذّر قراءة قاعدة البيانات</h1><div class="sub">${esc(e.message)}</div>
      <button class="btn ghost" id="pOther">اختيار مكان آخر</button>`);
    $('#pOther').onclick = screenChoose;
    return;
  }
  if (!DB.cases.length && !DB.log.length) { log('إنشاء قاعدة البيانات', Store.backend.label); await save(); }
  if (S().lock_hash && sessionStorage.getItem('unlocked') !== S().lock_hash) return screenLock();
  startRouter();
}

function screenLock() {
  bareScreen(`
    <div class="emblem">${S().logo_file ? `<img data-file="${esc(S().logo_file)}" alt="">` : ''}</div>
    <h1>منصة قضايا إساءة استخدام السلطة</h1>
    <div class="sub">${esc(S().org_line4)} — ${esc(S().org_line5)}</div>
    <form id="lockF"><label>رمز الدخول</label>
      <input type="password" name="pin" inputmode="numeric" autocomplete="current-password" autofocus required>
      <button class="btn" type="submit">دخول</button></form>
  `);
  hydrateImages();
  $('#lockF').onsubmit = async e => {
    e.preventDefault();
    const h = await sha256(S().lock_salt + formObj(e.target).pin);
    if (h === S().lock_hash) { sessionStorage.setItem('unlocked', h); startRouter(); }
    else { toast('رمز الدخول غير صحيح', 'error'); e.target.reset(); }
  };
}

// ========================= الهيكل والتنقل =========================
let routerOn = false;
function startRouter() {
  if (!routerOn) { window.addEventListener('hashchange', route); routerOn = true; }
  route();
}
let cleanup = [];
function onLeave(fn) { cleanup.push(fn); }

function route() {
  cleanup.forEach(f => { try { f(); } catch (e) {} }); cleanup = [];
  $$('.modal-bg, .sigfull').forEach(m => m.remove());
  const pr = $('#pagerule'); if (pr) pr.remove();
  const parts = (location.hash.replace(/^#\/?/, '').split('?')[0]).split('/').filter(Boolean);
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  window.scrollTo(0, 0);
  const [a, id, b, sid, c] = parts;
  if (!a) return viewDashboard();
  if (a === 'new') return viewCaseForm(null);
  if (a === 'stats') return viewStats();
  if (a === 'settings') return viewSettings();
  if (a === 'case' && byId('cases', id)) {
    const cs = byId('cases', id);
    if (!b) return viewCase(cs);
    if (b === 'edit') return viewCaseForm(cs);
    if (b === 'report') return sid === 'print' ? viewReportPrint(cs) : viewReportForm(cs);
    if (b === 'statement') {
      if (sid === 'new') return viewStatementForm(cs, null, q.get('party'));
      const st = DB.statements.find(s => s.id === +sid && s.case_id === cs.id);
      if (st) return c === 'print' ? viewStatementPrint(cs, st) : viewStatementForm(cs, st);
    }
  }
  location.hash = '#/';
}

function shell(content, active) {
  document.body.className = '';
  const s = S();
  const nav = [['#/', 'القضايا', ICON.list, 'list'], ['#/new', 'قضية جديدة', ICON.plus, 'new'],
               ['#/stats', 'الإحصائيات', ICON.chart, 'stats'], ['#/settings', 'الإعدادات', ICON.gear, 'settings']];
  app().innerHTML = `
    <header class="topbar">
      <div class="brand">
        ${s.logo_file ? `<img data-file="${esc(s.logo_file)}" alt="">` : ''}
        <div>منصة قضايا إساءة استخدام السلطة<span class="tag">${esc(s.org_line4)} — ${esc(s.org_line5)}</span></div>
      </div>
      <nav>${nav.map(n => `<a href="${n[0]}" class="${active === n[3] ? 'active' : ''}">${n[1]}</a>`).join('')}</nav>
      ${s.lock_hash ? '<button class="lockbtn" id="lockNow">قفل</button>' : ''}
    </header>
    <main class="container">${content}</main>
    <nav class="bottomnav">${nav.map(n => `<a href="${n[0]}" class="${active === n[3] ? 'active' : ''} ${n[3] === 'new' ? 'add' : ''}">${n[2]}<span>${n[3] === 'new' ? 'جديدة' : n[1]}</span></a>`).join('')}</nav>`;
  const l = $('#lockNow');
  if (l) l.onclick = () => { sessionStorage.removeItem('unlocked'); screenLock(); };
  hydrateImages();
}

function modal(html) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);
  return bg;
}
function dateField(name, label, value, ph) {
  return `<div class="field"><label>${label}</label><div class="inline">
    <input type="text" name="${name}" value="${esc(value)}" placeholder="${ph || '1 / 11 / 1447'}">
    <button type="button" class="btn sm ghost" data-today="${name}">اليوم</button></div></div>`;
}
function bindToday(root) {
  $$('[data-today]', root).forEach(b => b.onclick = () => { const i = $(`[name="${b.dataset.today}"]`, root); i.value = hijriToday(); i.dispatchEvent(new Event('input')); });
}
const opts = (list, sel) => list.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

// ========================= سجل القضايا =========================
function caseStats(c) {
  return {
    parties: DB.parties.filter(p => p.case_id === c.id).length,
    statements: DB.statements.filter(s => s.case_id === c.id).length,
  };
}
function viewDashboard() {
  const q0 = lsGet('dash_q', ''), st0 = lsGet('dash_st', '');
  shell(`
    <div class="page-head"><h1>سجل <span>القضايا</span></h1>
      <div class="acts"><a class="btn gold" href="#/new">+ قضية جديدة</a></div></div>
    <div class="card"><div class="searchbar">
      <input type="search" id="q" value="${esc(q0)}" placeholder="بحث: اسم طرف، رقم هوية، رقم القضية، رقم الأمر، الموضوع...">
      <select id="st"><option value="">كل الحالات</option>${opts(STATUSES, st0)}</select>
    </div></div>
    <div class="card flush" style="padding:0; overflow:auto" id="list"></div>`, 'list');
  const draw = () => {
    const q = $('#q').value.trim(), st = $('#st').value;
    lsSet('dash_q', q); lsSet('dash_st', st);
    let rows = DB.cases.slice().sort((a, b) => b.id - a.id);
    if (st) rows = rows.filter(c => c.status === st);
    if (q) {
      const has = v => String(v || '').includes(q);
      rows = rows.filter(c => [c.case_number, c.order_number, c.order_source, c.subject, c.order_text, c.assigned_name].some(has) ||
        DB.parties.some(p => p.case_id === c.id && (has(p.name) || has(p.national_id))));
    }
    $('#list').innerHTML = rows.length ? `<table class="rt">
      <tr class="hd"><th>م</th><th>رقم القضية</th><th>مصدر الأمر</th><th>رقم الأمر وتاريخه</th><th>الموضوع</th><th>المحقق المكلف</th><th>الأطراف</th><th>المحاضر</th><th>الحالة</th></tr>
      ${rows.map((c, i) => { const n = caseStats(c); return `<tr class="clickable" data-go="#/case/${c.id}">
        <td class="nomob">${i + 1}</td>
        <td data-l="رقم القضية"><b>${esc(c.case_number || '—')}</b>${c.case_year ? ' / ' + esc(c.case_year) + 'هـ' : ''}</td>
        <td data-l="مصدر الأمر">${esc(c.order_source || '—')}</td>
        <td data-l="رقم الأمر">${esc(c.order_number || '—')}${c.order_date ? `<br><span class="muted">${esc(c.order_date)}هـ</span>` : ''}</td>
        <td data-l="الموضوع" style="max-width:280px">${esc((c.subject || '').slice(0, 70))}${(c.subject || '').length > 70 ? '…' : ''}</td>
        <td data-l="المحقق">${esc(c.assigned_name || '—')}</td>
        <td data-l="الأطراف"><span class="badge n">${n.parties}</span></td>
        <td data-l="المحاضر"><span class="badge n">${n.statements}</span></td>
        <td data-l="الحالة"><span class="badge st-${esc(c.status)}">${esc(c.status)}</span></td></tr>`; }).join('')}
    </table>` : `<div class="card"><div class="empty"><b>لا توجد قضايا</b>${q || st ? 'جرّب تعديل معايير البحث' : 'ابدأ بإضافة قضية جديدة'}</div></div>`;
    $$('[data-go]').forEach(r => r.onclick = () => { location.hash = r.dataset.go; });
  };
  $('#q').oninput = draw; $('#st').onchange = draw;
  draw();
}

// ========================= بيانات القضية =========================
function viewCaseForm(c) {
  const v = c || { order_source: S().def_order_source, status: 'جارية', assigned_name: S().def_taker_name };
  const names = [...new Set(DB.cases.map(x => x.assigned_name).concat(S().def_taker_name).filter(Boolean))];
  shell(`
    <div class="page-head"><h1>${c ? 'تعديل بيانات القضية' : 'قضية <span>جديدة</span>'}</h1></div>
    <form id="f">
    <div class="card"><h2>البيانات الرئيسية للقضية</h2>
      <div class="grid g3">
        <div class="field"><label>رقم القضية (داخلي)</label><input type="text" name="case_number" inputmode="numeric" value="${esc(v.case_number)}" placeholder="مثال: 15"></div>
        <div class="field"><label>السنة (هـ)</label><input type="text" name="case_year" inputmode="numeric" value="${esc(v.case_year)}" placeholder="1447"></div>
        <div class="field"><label>الحالة</label><select name="status">${opts(STATUSES, v.status)}</select></div>
      </div>
      <div class="grid g3" style="margin-top:14px">
        <div class="field"><label>مصدر الأمر</label><input type="text" name="order_source" value="${esc(v.order_source)}"></div>
        <div class="field"><label>رقم الأمر</label><input type="text" name="order_number" value="${esc(v.order_number)}"></div>
        ${dateField('order_date', 'تاريخ الأمر (هـ)', v.order_date, '26 / 10 / 1447')}
      </div>
      <div class="field" style="margin-top:14px"><label>صيغة الخطاب الواردة في الأمر</label>
        <textarea name="order_text" placeholder="النص الوارد في خطاب اللجنة الفرعية...">${esc(v.order_text)}</textarea></div>
      <div class="field" style="margin-top:14px"><label>موضوع القضية (ملخص الشكوى)</label>
        <textarea name="subject" style="min-height:80px" placeholder="مثال: ادعاء المواطن/... تعرضه للدفع أثناء تواجده...">${esc(v.subject)}</textarea></div>
      <div class="grid g2" style="margin-top:14px">
        <div class="field"><label>المحقق المكلف بالقضية</label><input type="text" name="assigned_name" list="names" value="${esc(v.assigned_name)}">
          <datalist id="names">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
        ${c ? `<div class="field"><label>النتيجة النهائية</label><select name="final_result">
          <option value="" ${!v.final_result ? 'selected' : ''}>— لم تُحدد بعد —</option>${opts(RESULTS, v.final_result)}</select></div>` : ''}
      </div>
    </div>
    <div class="formbar"><button class="btn gold" type="submit">حفظ</button>
      <a class="btn ghost" href="${c ? '#/case/' + c.id : '#/'}">إلغاء</a></div>
    </form>`, c ? '' : 'new');
  const f = $('#f');
  bindToday(f);
  f.onsubmit = async e => {
    e.preventDefault();
    const o = formObj(f);
    let rec = c;
    if (!rec) { rec = { id: nextId('cases'), created_at: nowStr(), final_result: '' }; DB.cases.push(rec); }
    Object.assign(rec, o, { updated_at: nowStr() });
    log(c ? 'تعديل قضية' : 'إنشاء قضية', 'قضية رقم ' + (rec.case_number || rec.id));
    await save();
    toast(c ? 'تم حفظ التعديلات' : 'تم إنشاء القضية');
    location.hash = '#/case/' + rec.id;
  };
}

// ========================= ملف القضية =========================
function viewCase(c) {
  const parties = DB.parties.filter(p => p.case_id === c.id);
  const sts = DB.statements.filter(s => s.case_id === c.id);
  const atts = DB.attachments.filter(a => a.case_id === c.id);
  const rep = DB.reports.find(r => r.case_id === c.id);
  const pName = id => (byId('parties', id) || {}).name || '—';
  const pRole = id => (byId('parties', id) || {}).party_role || '';
  shell(`
    <div class="page-head">
      <h1>ملف القضية <span>رقم ${esc(c.case_number || c.id)}${c.case_year ? ' / ' + esc(c.case_year) + 'هـ' : ''}</span>
        <span class="badge st-${esc(c.status)}">${esc(c.status)}</span></h1>
      <div class="acts"><a class="btn" href="#/case/${c.id}/report">تقرير تقييم الإجراءات</a>
        <a class="btn ghost" href="#/case/${c.id}/edit">تعديل البيانات</a>
        <button class="btn danger" id="delCase">حذف</button></div>
    </div>
    <div class="jump">${[['sMain', 'البيانات'], ['sParties', 'الأطراف (' + parties.length + ')'], ['sSts', 'المحاضر (' + sts.length + ')'],
      ['sAtt', 'المرفقات (' + atts.length + ')'], ['sRep', 'التقرير']].map(j => `<button data-j="${j[0]}">${j[1]}</button>`).join('')}</div>

    <div class="card" id="sMain"><h2>البيانات الرئيسية</h2>
      <div class="kv">
        <div><label>مصدر الأمر</label><div>${esc(c.order_source || '—')}</div></div>
        <div><label>رقم الأمر</label><div>${esc(c.order_number || '—')}</div></div>
        <div><label>تاريخ الأمر</label><div>${esc(c.order_date || '—')}${c.order_date ? 'هـ' : ''}</div></div>
        <div><label>المحقق المكلف</label><div>${esc(c.assigned_name || '—')}</div></div>
      </div>
      ${c.order_text ? `<div style="margin-top:14px"><label>صيغة الخطاب في الأمر</label><div style="line-height:1.9; white-space:pre-wrap">${esc(c.order_text)}</div></div>` : ''}
      ${c.subject ? `<div style="margin-top:14px"><label>الموضوع</label><div style="line-height:1.9; white-space:pre-wrap">${esc(c.subject)}</div></div>` : ''}
      ${c.final_result ? `<div style="margin-top:14px"><label>النتيجة النهائية</label><div><b style="color:var(--green-dark)">${esc(c.final_result)}</b></div></div>` : ''}
    </div>

    <div class="card" id="sParties"><h2>أطراف القضية</h2>
      ${parties.length ? `<table class="rt">
        <tr class="hd"><th>م</th><th>الصفة</th><th>الاسم</th><th>رقم الهوية</th><th>الجنسية</th><th>الجنس</th><th>الجوال</th><th>الرتبة/العمل</th><th></th></tr>
        ${parties.map((p, i) => `<tr>
          <td class="nomob">${i + 1}</td>
          <td data-l="الصفة"><span class="badge role">${esc(p.party_role)}</span></td>
          <td data-l="الاسم"><div><b>${esc(p.name)}</b>${p.address ? `<br><span class="muted">${esc(p.address)}</span>` : ''}</div></td>
          <td data-l="رقم الهوية">${esc(p.national_id || '—')}</td>
          <td data-l="الجنسية">${esc(p.nationality || '—')}</td>
          <td data-l="الجنس">${esc(p.gender || '—')}</td>
          <td data-l="الجوال">${esc(p.phone || '—')}</td>
          <td data-l="الرتبة/العمل">${esc(p.rank_job || '—')}</td>
          <td class="actions-cell"><div class="btns">
            <a class="btn sm" href="#/case/${c.id}/statement/new?party=${p.id}">سماع أقوال</a>
            <button class="btn sm ghost" data-pedit="${p.id}">تعديل</button>
            <button class="btn sm danger" data-pdel="${p.id}">حذف</button></div></td></tr>`).join('')}
      </table>` : '<div class="empty">لم تُضف أطراف بعد</div>'}
      <div style="margin-top:14px"><button class="btn ghost" id="addParty">+ إضافة طرف جديد</button></div>
    </div>

    <div class="card" id="sSts"><h2>محاضر سماع الأقوال</h2>
      ${sts.length ? `<table class="rt">
        <tr class="hd"><th>م</th><th>الطرف</th><th>الصفة</th><th>التاريخ</th><th>سمعها</th><th>التوقيع</th><th></th></tr>
        ${sts.map((s, i) => `<tr>
          <td class="nomob">${i + 1}</td>
          <td data-l="الطرف"><b>${esc(pName(s.party_id))}</b></td>
          <td data-l="الصفة"><span class="badge role">${esc(pRole(s.party_id))}</span></td>
          <td data-l="التاريخ">${esc(s.statement_date || '—')}</td>
          <td data-l="سمعها">${esc(s.taker_name || '—')}</td>
          <td data-l="التوقيع">${s.signature_path ? `<img class="sig-img" style="max-height:40px" data-file="${esc(s.signature_path)}" alt="">` : '<span class="muted">بدون</span>'}</td>
          <td class="actions-cell"><div class="btns">
            <a class="btn sm" href="#/case/${c.id}/statement/${s.id}/print">طباعة</a>
            <a class="btn sm ghost" href="#/case/${c.id}/statement/${s.id}">تعديل</a>
            <button class="btn sm danger" data-sdel="${s.id}">حذف</button></div></td></tr>`).join('')}
      </table>` : '<div class="empty">لا توجد محاضر بعد — أضف الأطراف ثم اضغط «سماع أقوال»</div>'}
      <div style="margin-top:14px"><a class="btn ghost" href="#/case/${c.id}/statement/new">+ محضر سماع أقوال جديد</a></div>
    </div>

    <div class="card" id="sAtt"><h2>الخطابات والمرفقات</h2>
      ${atts.length ? `<table class="rt">
        <tr class="hd"><th>م</th><th>البيان</th><th>التاريخ</th><th></th></tr>
        ${atts.map((a, i) => `<tr>
          <td class="nomob">${i + 1}</td>
          <td data-l="البيان"><b>${esc(a.title)}</b></td>
          <td data-l="التاريخ" class="muted">${esc(a.uploaded_at)}</td>
          <td class="actions-cell"><div class="btns">
            <button class="btn sm ghost" data-aopen="${a.id}">فتح</button>
            <button class="btn sm danger" data-adel="${a.id}">حذف</button></div></td></tr>`).join('')}
      </table>` : '<div class="empty">لا توجد مرفقات — أرفق الخطابات الخارجية للرجوع إليها</div>'}
      <form id="attF" class="grid g3" style="margin-top:14px; align-items:end">
        <div><label>بيان المرفق</label><input type="text" name="title" placeholder="مثال: خطاب الإمارة رقم ... وتاريخ ..."></div>
        <div><label>الملف (PDF / صورة / Word)</label><input type="file" name="file" required
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.heic,.doc,.docx,.xls,.xlsx,image/*,application/pdf"></div>
        <div><button class="btn gold" type="submit" style="width:100%">رفع المرفق</button></div>
      </form>
    </div>

    <div class="card" id="sRep"><h2>تقرير تقييم الإجراءات</h2>
      ${rep ? `<div class="grid g2">
          <div><label>النتيجة</label><div style="line-height:1.9; white-space:pre-wrap">${esc(rep.result_text || '— لم تُكتب —')}</div></div>
          <div><label>المرئيات</label><div style="line-height:1.9; white-space:pre-wrap">${esc(rep.opinion_text || '— لم تُكتب —')}</div></div></div>
        <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap">
          <a class="btn" href="#/case/${c.id}/report">تحرير التقرير</a>
          <a class="btn gold" href="#/case/${c.id}/report/print">معاينة وطباعة</a></div>`
      : `<div class="empty">لم يُعدّ التقرير بعد</div><a class="btn" href="#/case/${c.id}/report">إعداد التقرير</a>`}
    </div>`);

  $$('[data-j]').forEach(b => b.onclick = () => { const t = document.getElementById(b.dataset.j); window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 70, behavior: 'smooth' }); });
  $('#delCase').onclick = async () => {
    if (!confirm('حذف القضية وجميع أطرافها ومحاضرها ومرفقاتها نهائيًا؟')) return;
    for (const s of sts) await delFile(s.signature_path);
    for (const a of atts) await delFile(a.filename);
    DB.cases = DB.cases.filter(x => x.id !== c.id);
    for (const t of ['parties', 'statements', 'attachments', 'reports']) DB[t] = DB[t].filter(x => x.case_id !== c.id);
    for (const s of sts) await delFileIfUnused(s.taker_sig_path);
    log('حذف قضية', 'قضية رقم ' + (c.case_number || c.id));
    await save(); toast('تم حذف القضية'); location.hash = '#/';
  };
  $('#addParty').onclick = () => partyModal(c, null);
  $$('[data-pedit]').forEach(b => b.onclick = () => partyModal(c, byId('parties', b.dataset.pedit)));
  $$('[data-pdel]').forEach(b => b.onclick = async () => {
    const p = byId('parties', b.dataset.pdel);
    if (!confirm(`حذف الطرف «${p.name}» ومحاضره؟`)) return;
    const gone = DB.statements.filter(s => s.party_id === p.id);
    for (const s of gone) await delFile(s.signature_path);
    DB.statements = DB.statements.filter(s => s.party_id !== p.id);
    for (const s of gone) await delFileIfUnused(s.taker_sig_path);
    DB.parties = DB.parties.filter(x => x.id !== p.id);
    await save(); toast('تم حذف الطرف'); route();
  });
  $$('[data-sdel]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف المحضر؟')) return;
    const s = byId('statements', b.dataset.sdel);
    await delFile(s.signature_path);
    DB.statements = DB.statements.filter(x => x.id !== s.id);
    await delFileIfUnused(s.taker_sig_path);
    log('حذف محضر', 'قضية #' + c.id);
    await save(); toast('تم حذف المحضر'); route();
  });
  $$('[data-aopen]').forEach(b => b.onclick = async () => {
    const a = byId('attachments', b.dataset.aopen);
    const blob = await Store.backend.getFile(a.filename);
    if (!blob) return toast('الملف غير موجود في مكان الحفظ', 'error');
    const u = URL.createObjectURL(blob);
    const w = window.open(u, '_blank');
    if (!w) download(blob, a.filename.split('/').pop());
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  });
  $$('[data-adel]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف المرفق؟')) return;
    const a = byId('attachments', b.dataset.adel);
    await delFile(a.filename);
    DB.attachments = DB.attachments.filter(x => x.id !== a.id);
    await save(); toast('تم حذف المرفق'); route();
  });
  $('#attF').onsubmit = async e => {
    e.preventDefault();
    const file = e.target.elements.file.files[0];
    if (!file) return;
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'جارٍ الرفع...';
    try {
      const path = `attachments/c${c.id}_${Date.now()}_${safeName(file.name)}`;
      await putFile(path, file);
      DB.attachments.push({ id: nextId('attachments'), case_id: c.id, title: e.target.elements.title.value.trim() || file.name, filename: path, uploaded_at: nowStr() });
      log('إرفاق خطاب', 'قضية #' + c.id);
      await save(); toast('تم رفع المرفق'); route();
    } catch (err) { toast('تعذّر رفع الملف: ' + err.message, 'error'); btn.disabled = false; btn.textContent = 'رفع المرفق'; }
  };
}

function partyModal(c, p) {
  const v = p || { party_role: 'مدعي', nationality: 'سعودي', gender: 'ذكر' };
  const m = modal(`<h2>${p ? 'تعديل بيانات ' + esc(p.name) : 'إضافة طرف جديد'}</h2>
    <form id="pf" class="grid g2">
      <div><label>الصفة</label><select name="party_role">${opts(ROLES, v.party_role)}</select></div>
      <div><label>الاسم الكامل *</label><input type="text" name="name" value="${esc(v.name)}" required></div>
      <div><label>رقم الهوية</label><input type="text" name="national_id" inputmode="numeric" value="${esc(v.national_id)}"></div>
      <div><label>الجنسية</label><input type="text" name="nationality" value="${esc(v.nationality)}"></div>
      <div><label>الجنس</label><select name="gender">${opts(['ذكر', 'أنثى'], v.gender)}</select></div>
      <div><label>رقم الجوال</label><input type="tel" name="phone" value="${esc(v.phone)}"></div>
      <div><label>العنوان</label><input type="text" name="address" value="${esc(v.address)}"></div>
      <div><label>الرتبة/العمل (لرجال الأمن)</label><input type="text" name="rank_job" value="${esc(v.rank_job)}" placeholder="مثال: الرقيب"></div>
      <div class="span-all" style="display:flex; gap:10px">
        <button class="btn gold" type="submit" style="flex:1">${p ? 'حفظ التعديل' : 'إضافة الطرف'}</button>
        <button class="btn ghost" type="button" id="pcancel" style="flex:1">إلغاء</button></div>
    </form>`);
  $('#pcancel', m).onclick = () => m.remove();
  $('#pf', m).onsubmit = async e => {
    e.preventDefault();
    const o = formObj(e.target);
    if (p) Object.assign(p, o);
    else DB.parties.push(Object.assign({ id: nextId('parties'), case_id: c.id }, o));
    await save(); m.remove(); toast(p ? 'تم تعديل بيانات الطرف' : 'تمت إضافة الطرف'); route();
  };
}

// ========================= سماع الأقوال =========================
function sigToolsHTML(full) {
  return `<div class="sig-tools">
    <div class="grp">${SIG_COLORS.map(c => `<button type="button" class="swatch" data-color="${c.v}" title="${c.name}" style="background:${c.v}"></button>`).join('')}</div>
    <div class="grp">${SIG_WIDTHS.map(w => `<button type="button" class="wbtn" data-width="${w.v}" title="${w.name}"><i style="height:${Math.round(w.v * 0.9)}px"></i></button>`).join('')}</div>
    <div class="grp">
      <button type="button" class="btn sm ghost" data-sig="undo">تراجع</button>
      <button type="button" class="btn sm ghost" data-sig="clear">مسح</button>
      ${full ? '<button type="button" class="btn sm gold" data-sig="done">تم</button>' : '<button type="button" class="btn sm ghost" data-sig="full">توقيع بملء الشاشة</button>'}
    </div></div>`;
}
function bindSigTools(root, pad, extra) {
  const sync = () => {
    $$('[data-color]', root).forEach(b => b.classList.toggle('on', b.dataset.color === pad.color));
    $$('[data-width]', root).forEach(b => b.classList.toggle('on', +b.dataset.width === pad.width));
  };
  $$('[data-color]', root).forEach(b => b.onclick = () => { pad.setColor(b.dataset.color); sync(); });
  $$('[data-width]', root).forEach(b => b.onclick = () => { pad.setWidth(+b.dataset.width); sync(); });
  $$('[data-sig]', root).forEach(b => b.onclick = () => {
    const a = b.dataset.sig;
    if (a === 'undo') pad.undo(); else if (a === 'clear') pad.clear(); else extra && extra(a);
  });
  sync();
}
function sigPadHTML(id) {
  return `<div class="sighost" id="${id}"><div class="sigwrap"><canvas class="sigpad"></canvas><div class="sigline"></div></div>
    <div class="sigtools-slot">${sigToolsHTML(false)}</div></div>`;
}
/** يركّب لوحة توقيع داخل عنصر أنشأه sigPadHTML، مع وضع ملء الشاشة */
function mountSig(host) {
  const wrap = $('.sigwrap', host), slot = $('.sigtools-slot', host);
  const pad = new SignaturePad($('canvas', wrap));
  onLeave(() => pad.destroy());
  // ملء الشاشة: ننقل نفس اللوحة إلى طبقة كاملة ثم نعيدها
  const goFull = () => {
    const ov = document.createElement('div');
    ov.className = 'sigfull';
    ov.innerHTML = `<div class="hint" style="color:#cfe3d8">وقّع داخل المربع الأبيض</div>`;
    ov.appendChild(wrap);
    const tools = document.createElement('div'); tools.innerHTML = sigToolsHTML(true);
    ov.appendChild(tools);
    document.body.appendChild(ov);
    pad.fit();
    bindSigTools(ov, pad, a => { if (a === 'done') { host.insertBefore(wrap, slot); ov.remove(); pad.fit(); bindSigTools(slot, pad); } });
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
  };
  bindSigTools(slot, pad, a => { if (a === 'full') goFull(); });
  return pad;
}
/** يحذف ملف التوقيع فقط إذا لم يعد أي سجل أو إعداد يستخدمه */
async function delFileIfUnused(path) {
  if (!path) return;
  const used = S().taker_sig === path || S().logo_file === path ||
    DB.statements.some(s => s.signature_path === path || s.taker_sig_path === path);
  if (!used) await delFile(path);
}

function viewStatementForm(c, st, preParty) {
  const parties = DB.parties.filter(p => p.case_id === c.id);
  if (!parties.length) {
    shell(`<div class="page-head"><h1>محضر <span>سماع أقوال</span></h1></div>
      <div class="card"><div class="empty"><b>لا توجد أطراف في القضية</b>أضف الطرف أولاً من ملف القضية ثم عد لسماع الأقوال</div>
      <div style="text-align:center"><a class="btn" href="#/case/${c.id}">العودة لملف القضية</a></div></div>`);
    return;
  }
  const pre = +(preParty || (st && st.party_id) || parties[0].id);
  const v = st || { statement_date: hijriToday(), location: S().def_location,
    taker_rank: S().def_taker_rank, taker_name: S().def_taker_name || c.assigned_name || '',
    text: 'س / ما اسمك الكامل وجنسيتك ورقم هويتك ومحل إقامتك ورقم جوالك؟\nج / \n\nس / \nج / ' };
  const takerMode = st && st.taker_sig_path ? 'keep' : (st ? 'none' : (S().taker_sig ? 'saved' : 'new'));
  shell(`
    <div class="page-head"><h1>محضر <span>سماع أقوال</span> — قضية رقم ${esc(c.case_number || c.id)}</h1></div>
    <form id="f">
    <div class="card"><h2>البيانات الإحصائية للطرف</h2>
      <div class="grid g3">
        <div class="field"><label>الطرف المستمع لأقواله *</label>
          <select name="party_id" id="partySel">${parties.map(p => `<option value="${p.id}" ${p.id === pre ? 'selected' : ''}>${esc(p.party_role)} / ${esc(p.name)}</option>`).join('')}</select></div>
        ${dateField('statement_date', 'تاريخ سماع الأقوال (هـ)', v.statement_date)}
        <div class="field"><label>مكان سماع الأقوال</label><input type="text" name="location" value="${esc(v.location)}"></div>
      </div>
      <div id="partyInfo" class="pinfo grid g4"></div>
      <div class="grid g2" style="margin-top:14px">
        <div class="field"><label>رتبة من سمع الأقوال ودوّنها</label><input type="text" name="taker_rank" value="${esc(v.taker_rank)}"></div>
        <div class="field"><label>اسم من سمع الأقوال ودوّنها</label><input type="text" name="taker_name" value="${esc(v.taker_name)}"></div>
      </div>
    </div>

    <div class="card"><h2>نص الاستجواب</h2>
      <div class="qa-tools">
        <button type="button" class="btn sm ghost" data-ins="\n\nس / ">+ سؤال</button>
        <button type="button" class="btn sm ghost" data-ins="\nج / ">+ جواب</button>
      </div>
      <textarea name="text" class="amiri" id="qa" style="min-height:300px">${esc(v.text)}</textarea>
      <div class="hint">اكتب الأسئلة بصيغة «س /» والأجوبة بصيغة «ج /» وسيُنسّق المحضر تلقائيًا عند الطباعة</div>
    </div>

    <div class="card"><h2>توقيع المستمع لأقواله</h2>
      ${st && st.signature_path ? `<div style="margin-bottom:10px" id="oldSig"><label>التوقيع المحفوظ حاليًا</label>
        <img class="sig-img" data-file="${esc(st.signature_path)}" alt="">
        <div style="margin-top:6px"><label style="display:inline-flex; gap:6px; align-items:center; font-weight:400">
          <input type="checkbox" name="remove_sig" value="1"> حذف التوقيع المحفوظ</label></div>
        <div class="hint">أي توقيع جديد أدناه سيستبدل التوقيع المحفوظ</div></div>` : ''}
      ${sigPadHTML('sigParty')}
      <div class="hint">وقّع بالإصبع أو القلم أو الفأرة. يمكن تغيير لون الحبر وسماكة القلم، و«ملء الشاشة» أريح على الجوال (أدر الجوال أفقيًا).</div>
    </div>

    <div class="card"><h2>توقيع من سمع الأقوال ودوّنها (المحقق)</h2>
      <div class="sigmodes">
        ${st && st.taker_sig_path ? `<label class="sigmode"><input type="radio" name="taker_mode" value="keep" ${takerMode === 'keep' ? 'checked' : ''}>
          <span>التوقيع الحالي لهذا المحضر</span><img class="sig-img" data-file="${esc(st.taker_sig_path)}" alt=""></label>` : ''}
        ${S().taker_sig ? `<label class="sigmode"><input type="radio" name="taker_mode" value="saved" ${takerMode === 'saved' ? 'checked' : ''}>
          <span>توقيعي المحفوظ</span><img class="sig-img" data-file="${esc(S().taker_sig)}" alt=""></label>` : ''}
        <label class="sigmode"><input type="radio" name="taker_mode" value="new" ${takerMode === 'new' ? 'checked' : ''}><span>توقيع جديد</span></label>
        <label class="sigmode"><input type="radio" name="taker_mode" value="none" ${takerMode === 'none' ? 'checked' : ''}><span>بدون توقيع</span></label>
      </div>
      <div id="takerNew" class="${takerMode === 'new' ? '' : 'hide'}" style="margin-top:12px">
        ${sigPadHTML('sigTaker')}
        <label class="sigmode" style="margin-top:10px"><input type="checkbox" name="taker_save_default" value="1" ${S().taker_sig ? '' : 'checked'}>
          <span>احفظه كتوقيعي الافتراضي ليُدرج تلقائيًا في المحاضر القادمة</span></label>
      </div>
      <div class="hint">يمكن أيضًا حفظ توقيع المحقق مرة واحدة من «الإعدادات».</div>
    </div>

    <div class="formbar"><button class="btn gold" type="submit">حفظ المحضر</button>
      <a class="btn ghost" href="#/case/${c.id}">إلغاء</a></div>
    </form>`);
  const f = $('#f');
  bindToday(f);
  const sel = $('#partySel');
  const showParty = () => {
    const p = byId('parties', sel.value) || {};
    $('#partyInfo').innerHTML = `
      <div><label>رقم الهوية</label><b>${esc(p.national_id || '—')}</b></div>
      <div><label>الجنسية</label><b>${esc(p.nationality || '—')}</b></div>
      <div><label>الجنس</label><b>${esc(p.gender || '—')}</b></div>
      <div><label>الجوال</label><b>${esc(p.phone || '—')}</b></div>
      <div class="span-all"><label>العنوان</label><b>${esc(p.address || '—')}</b></div>`;
  };
  sel.onchange = showParty; showParty();
  const qa = $('#qa');
  $$('[data-ins]').forEach(b => b.onclick = () => {
    const t = b.dataset.ins.replace(/\\n/g, '\n');
    const s = qa.selectionEnd ?? qa.value.length;
    qa.value = qa.value.slice(0, s) + t + qa.value.slice(s);
    qa.focus(); qa.selectionStart = qa.selectionEnd = s + t.length;
  });

  const pad = mountSig($('#sigParty'));
  const tpad = mountSig($('#sigTaker'));
  $$('[name=taker_mode]', f).forEach(r => r.onchange = () => {
    const isNew = $('[name=taker_mode]:checked', f).value === 'new';
    $('#takerNew').classList.toggle('hide', !isNew);
    if (isNew) tpad.fit();   // اللوحة كانت مخفية فلم يُحسب مقاسها
  });

  f.onsubmit = async e => {
    e.preventDefault();
    const o = formObj(f);
    const btn = $('button[type=submit]', f); btn.disabled = true;
    try {
      let rec = st;
      if (!rec) { rec = { id: nextId('statements'), case_id: c.id, signature_path: '', created_at: nowStr() }; DB.statements.push(rec); }
      const oldSig = rec.signature_path;
      const blob = await pad.toBlob();
      if (blob) {
        const path = `signatures/sig_${c.id}_${rec.id}_${Date.now()}.png`;
        await putFile(path, blob);
        rec.signature_path = path;
        if (oldSig) await delFile(oldSig);
      } else if (o.remove_sig && oldSig) { await delFile(oldSig); rec.signature_path = ''; }
      // توقيع المحقق
      const oldTaker = rec.taker_sig_path || '';
      if (o.taker_mode === 'saved') rec.taker_sig_path = S().taker_sig;
      else if (o.taker_mode === 'none') rec.taker_sig_path = '';
      else if (o.taker_mode === 'new') {
        const tb = await tpad.toBlob();
        if (tb) {
          const path = `signatures/taker_${Date.now()}.png`;
          await putFile(path, tb);
          rec.taker_sig_path = path;
          if (o.taker_save_default) { const prev = S().taker_sig; S().taker_sig = path; await delFileIfUnused(prev); }
        } else rec.taker_sig_path = '';
      }
      if (oldTaker !== rec.taker_sig_path) await delFileIfUnused(oldTaker);
      Object.assign(rec, { party_id: +o.party_id, statement_date: o.statement_date, location: o.location,
        taker_rank: o.taker_rank, taker_name: o.taker_name, text: f.text.value });
      log(st ? 'تعديل سماع أقوال' : 'إضافة سماع أقوال', 'قضية #' + c.id);
      await save();
      toast('تم حفظ محضر سماع الأقوال');
      location.hash = '#/case/' + c.id;
    } catch (err) { btn.disabled = false; toast('تعذّر الحفظ: ' + err.message, 'error'); }
  };
}

// ========================= صفحات الطباعة =========================
function printHead(metaRows) {
  const s = S();
  return `<div class="basmala">بسم الله الرحمن الرحيم</div>
    <div class="head">
      <div class="org">${[1, 2, 3, 4, 5].map(i => esc(s['org_line' + i])).filter(Boolean).join('<br>')}</div>
      <div class="logo">${s.logo_file ? `<img data-file="${esc(s.logo_file)}" alt="">` : ''}</div>
      <div class="meta">${metaRows.map(r => `<div class="row"><span class="lbl">${r[0]}</span><span class="dots">${r[1]}</span></div>`).join('')}</div>
    </div>`;
}
function printShell(sheetHTML, back, pageRule, info) {
  document.body.className = 'printview';
  app().innerHTML = `<div class="pv-bar">
      <button class="btn gold" id="doPrint">🖨 طباعة / حفظ PDF</button>
      <a class="btn ghost" href="${back[0]}">${back[1]}</a>
      <span class="info" id="pvInfo">${info || ''}</span></div>
    <div class="pv-stage"><div class="pv-scale" id="pvScale">${sheetHTML}</div></div>`;
  const st = document.createElement('style'); st.id = 'pagerule'; st.textContent = pageRule;
  document.head.appendChild(st);
  $('#doPrint').onclick = () => window.print();
  const scaler = () => {
    const sc = $('#pvScale'); if (!sc) return;
    const sheet = $('.sheet', sc);
    const k = Math.min(1, (window.innerWidth - 16) / sheet.offsetWidth);
    sc.style.transform = `scale(${k})`;
    sc.style.height = (sheet.offsetHeight * k) + 'px';
    sc.parentElement.style.display = 'flex'; sc.parentElement.style.justifyContent = 'center';
    sc.style.flex = 'none';
  };
  window.addEventListener('resize', scaler);
  onLeave(() => window.removeEventListener('resize', scaler));
  return { scaler, ready: Promise.all([hydrateImages(app()), document.fonts ? document.fonts.ready : null]) };
}

/** تصغير الخط تدريجيًا حتى يتسع التقرير لصفحة A4 واحدة */
function fitOnePage(sheet, maxPt, minPt) {
  const inner = $('.inner', sheet), cs = getComputedStyle(sheet);
  const avail = () => sheet.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let fs = maxPt;
  sheet.style.setProperty('--fs', fs + 'pt');
  while (inner.offsetHeight > avail() && fs > minPt) { fs = Math.round((fs - 0.25) * 100) / 100; sheet.style.setProperty('--fs', fs + 'pt'); }
  return { fs, fits: inner.offsetHeight <= avail() };
}

function rankName(rank, name) {
  const r = (rank || '').trim();
  const rk = r ? `<span class="rk">${esc(r.replace(/\s*\/\s*$/, ''))}/</span>` : '';
  return `<div class="rn"><span class="nm${name ? '' : ' blank'}">${rk}${esc(name || '')}</span></div>`;
}

function viewReportPrint(c) {
  const r = DB.reports.find(x => x.case_id === c.id);
  if (!r) { location.hash = '#/case/' + c.id + '/report'; return; }
  const sec = (h, b) => `<div class="sec"><div class="h">${h}</div><div class="b">${esc((b || '').trim())}</div></div>`;
  const signer = (role, t, rk, nm) => `<div class="role">${role}</div><div>${esc(t)}</div>${rankName(rk, nm)}`;
  const html = `<div class="sheet one" id="sheet"><div class="inner">
    ${printHead([['الرقــم :', esc(r.report_number)], ['التاريخ :', esc(r.report_date) + (r.report_date ? 'هـ' : '')],
                 ['المشفوعات :', esc(r.attachments_note)], ['الموضوع :', esc(r.subject_line)]])}
    <div class="ptitle"><span>${esc(S().report_title || '( تقييم إجراءات قضية )')}</span></div>
    ${sec('الإشارة :', r.ref_text)}${sec('الإجراءات :', r.procedures_text)}${sec('النتيجة :', r.result_text)}${sec('المرئيات :', r.opinion_text)}
    <div class="sigs">
      <div class="sig2">
        <div class="sigbox">${signer('معد التقرير', r.prepared_title, r.prepared_rank, r.prepared_name)}</div>
        <div class="sigbox">${signer('راجعـه', r.reviewed_title, r.reviewed_rank, r.reviewed_name)}</div>
      </div>
      <div class="sigcenter">${signer('أجــازه', r.approved_title, r.approved_rank, r.approved_name)}</div>
    </div></div></div>`;
  const pv = printShell(html, ['#/case/' + c.id + '/report', 'تعديل التقرير'], '@page { size: A4 portrait; margin: 0; }');
  pv.ready.then(() => {
    const res = fitOnePage($('#sheet'), 15.5, 9);
    $('#pvInfo').textContent = res.fits ? `صفحة A4 واحدة — حجم الخط ${res.fs}` : 'تنبيه: النص طويل جدًا ولا يتسع لصفحة واحدة حتى بأصغر خط، اختصر بعض الفقرات';
    pv.scaler();
  });
}

function viewStatementPrint(c, st) {
  const p = byId('parties', st.party_id) || {};
  const html = `<div class="sheet flow" id="sheet" style="--fs:14.5pt">
    ${printHead([['القضية رقم :', esc(c.case_number) + (c.case_year ? ' / ' + esc(c.case_year) + 'هـ' : '')],
                 ['التاريخ :', esc(st.statement_date) + (st.statement_date ? 'هـ' : '')], ['المكان :', esc(st.location)]])}
    <div class="ptitle"><span>( محضر سماع أقوال )</span></div>
    <div class="intro">إنه في يوم ${esc(st.statement_date || ' ........ ')}هـ، وبموجب خطاب ${esc(c.order_source)} رقم (${esc(c.order_number)}) وتاريخ ${esc(c.order_date)}هـ، تم سماع أقوال ${roleWord(p.party_role)} الموضحة بياناته أدناه:</div>
    <table class="pdata">
      <tr class="hd"><th>الاســم</th><th>رقم الهوية</th><th>الجنسية</th><th>الجنس</th></tr>
      <tr><td>${esc(p.name)}${p.rank_job ? ' (' + esc(p.rank_job) + ')' : ''}</td><td>${esc(p.national_id || '—')}</td><td>${esc(p.nationality || '—')}</td><td>${esc(p.gender || '—')}</td></tr>
      <tr class="hd"><th>رقم الجوال</th><th colspan="3">العنوان</th></tr>
      <tr><td>${esc(p.phone || '—')}</td><td colspan="3">${esc(p.address || '—')}</td></tr>
    </table>
    <div class="qa">${esc((st.text || '').trim())}</div>
    <div class="sigrow">
      <div class="sigbox"><div class="role">المستمع لأقواله</div><div>الاسم / ${esc(p.name)}</div><div>التوقيع /</div>
        ${st.signature_path ? `<img class="sigimg" data-file="${esc(st.signature_path)}" alt="">` : ''}</div>
      <div class="sigbox"><div class="role">سمع الأقوال ودوّنها</div>
        <div>${esc(st.taker_rank)}${st.taker_rank ? ' / ' : ''}${esc(st.taker_name)}</div><div>التوقيع /</div>
        ${st.taker_sig_path ? `<img class="sigimg" data-file="${esc(st.taker_sig_path)}" alt="">` : ''}</div>
    </div></div>`;
  const pv = printShell(html, ['#/case/' + c.id + '/statement/' + st.id, 'تعديل المحضر'], '@page { size: A4 portrait; margin: 11mm 14mm; }', 'مقاس A4');
  pv.ready.then(pv.scaler);
}

// ========================= تقرير تقييم الإجراءات =========================
function buildRefText(c, parties) {
  const cl = parties.filter(p => p.party_role === 'مدعي'), df = parties.filter(p => p.party_role === 'مدعى عليه');
  const cTxt = cl.map(p => `${p.nationality || 'المواطن'} / ${p.name}` + (p.national_id ? ` هوية وطنية رقم (${p.national_id})` : '')).join(' و');
  const dTxt = df.map(p => (p.rank_job ? p.rank_job + ' / ' : '') + p.name).join(' و');
  let t = `خطاب ${c.order_source || ''} رقم (${c.order_number || ''}) وتاريخ ${c.order_date || ''}هـ`;
  if (cTxt) t += `، بشأن شكوى ${cTxt}`;
  if (dTxt) t += `، ضد ${dTxt}`;
  if (c.subject) t += `، والمتضمنة ${c.subject}`;
  return t + '.';
}
function buildProcedures(c) {
  return DB.statements.filter(s => s.case_id === c.id)
    .map((s, i) => { const p = byId('parties', s.party_id) || {}; return `${i + 1}. سماع أقوال ${roleWord(p.party_role)} / ${p.name || ''}.`; }).join('\n');
}

function viewReportForm(c) {
  const parties = DB.parties.filter(p => p.case_id === c.id);
  let r = DB.reports.find(x => x.case_id === c.id);
  const isNew = !r;
  if (!r) {
    const s = S();
    r = { case_id: c.id, report_number: '', report_date: hijriToday(), attachments_note: '', subject_line: c.subject || '',
      ref_text: buildRefText(c, parties), procedures_text: buildProcedures(c), result_text: '', opinion_text: '' };
    for (const k of ['prepared', 'reviewed', 'approved']) for (const f of ['title', 'rank', 'name']) r[`${k}_${f}`] = s[`def_${k}_${f}`] || '';
  }
  const signer = (k, label) => `<div><div class="signer-head">${label}</div>
    <div class="field"><label>المسمى</label><input type="text" name="${k}_title" value="${esc(r[k + '_title'])}"></div>
    <div class="field"><label>الرتبة</label><input type="text" name="${k}_rank" value="${esc(r[k + '_rank'])}"></div>
    <div class="field"><label>الاسم</label><input type="text" name="${k}_name" value="${esc(r[k + '_name'])}"></div></div>`;
  shell(`
    <div class="page-head"><h1>تقرير <span>تقييم الإجراءات</span> — قضية رقم ${esc(c.case_number || c.id)}</h1>
      <div class="acts"><a class="btn ghost" href="#/case/${c.id}">العودة للقضية</a></div></div>
    ${isNew ? '<div class="note">هذه صيغة مبدئية مولّدة من بيانات القضية — لن تُحفظ حتى تضغط «حفظ».</div>' : ''}
    <form id="f">
    <div class="card"><h2>ترويسة التقرير</h2>
      <div class="grid g4">
        <div class="field"><label>الرقم</label><input type="text" name="report_number" value="${esc(r.report_number)}"></div>
        ${dateField('report_date', 'التاريخ (هـ)', r.report_date)}
        <div class="field"><label>المشفوعات</label><input type="text" name="attachments_note" value="${esc(r.attachments_note)}"></div>
        <div class="field"><label>الموضوع</label><input type="text" name="subject_line" value="${esc(r.subject_line)}"></div>
      </div></div>
    <div class="card"><h2>الإشارة <button type="button" class="btn sm ghost count" id="regenRef">إعادة التوليد</button></h2>
      <textarea name="ref_text" class="amiri" style="min-height:130px">${esc(r.ref_text)}</textarea>
      <div class="hint">تُولَّد تلقائيًا من بيانات القضية والأطراف — يمكنك تعديلها بحرية</div></div>
    <div class="card"><h2>الإجراءات <button type="button" class="btn sm ghost count" id="regenProc">إعادة التوليد</button></h2>
      <textarea name="procedures_text" class="amiri" style="min-height:130px">${esc(r.procedures_text)}</textarea>
      <div class="hint">تُدرج محاضر سماع الأقوال المسجلة مرقّمة — أضف أو عدّل ما تحتاجه</div></div>
    <div class="card"><h2>النتيجة</h2>
      <textarea name="result_text" class="amiri" placeholder="بعد الاطلاع على كامل أوراق المعاملة وما تضمنته من إفادات، لم يثبت وجود أي إساءة استخدام للسلطة من قبل رجل الأمن المذكور.">${esc(r.result_text)}</textarea></div>
    <div class="card"><h2>المرئيات</h2>
      <textarea name="opinion_text" class="amiri" style="min-height:90px" placeholder="حفظ الشكوى لعدم ثبوت ما يستوجب الاستمرار فيها.">${esc(r.opinion_text)}</textarea></div>
    <div class="card"><h2>الموقّعون</h2>
      <div class="grid g3">${signer('prepared', 'معد التقرير (يمين)')}${signer('reviewed', 'راجعه (يسار)')}${signer('approved', 'أجازه (أسفل الوسط)')}</div>
      <div class="hint">تظهر الرتبة في سطر فوق الاسم وتنتهي عند بداية الاسم. يمكن ضبط الموقّعين الافتراضيين من «الإعدادات».</div></div>
    <div class="formbar"><button class="btn gold" type="submit">حفظ التقرير</button>
      <button class="btn" type="submit" data-print="1">حفظ ثم معاينة الطباعة</button></div>
    </form>`);
  const f = $('#f');
  bindToday(f);
  $('#regenRef').onclick = () => { if (!f.ref_text.value.trim() || confirm('استبدال نص الإشارة بالصيغة المولّدة؟')) f.ref_text.value = buildRefText(c, parties); };
  $('#regenProc').onclick = () => { if (!f.procedures_text.value.trim() || confirm('استبدال نص الإجراءات بالصيغة المولّدة؟')) f.procedures_text.value = buildProcedures(c); };
  let wantPrint = false;
  $('[data-print]', f).onclick = () => { wantPrint = true; };
  f.onsubmit = async e => {
    e.preventDefault();
    const o = formObj(f);
    for (const k of ['ref_text', 'procedures_text', 'result_text', 'opinion_text']) o[k] = f[k].value;
    if (isNew) { r.id = nextId('reports'); DB.reports.push(r); }
    Object.assign(r, o, { updated_at: nowStr() });
    log('حفظ تقرير تقييم إجراءات', 'قضية #' + c.id);
    await save(); toast('تم حفظ التقرير');
    location.hash = wantPrint ? `#/case/${c.id}/report/print` : `#/case/${c.id}`;
  };
}

// ========================= الإحصائيات =========================
function viewStats() {
  const total = DB.cases.length;
  const count = key => { const m = new Map(); DB.cases.forEach(c => { const v = c[key] || ''; m.set(v, (m.get(v) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const byStatus = count('status'), byResult = count('final_result').filter(r => r[0]), bySource = count('order_source').slice(0, 10);
  const mm = new Map(); DB.cases.forEach(c => { const m = (c.created_at || '').slice(0, 7); mm.set(m, (mm.get(m) || 0) + 1); });
  const byMonth = [...mm.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  const mx = Math.max(1, ...byMonth.map(r => r[1]));
  const um = new Map(); DB.cases.forEach(c => { const n = c.assigned_name || 'غير محدد'; const v = um.get(n) || [0, 0]; v[0]++; if (c.status === 'منجزة') v[1]++; um.set(n, v); });
  const tbl = (head, rows) => rows.length ? `<table>${head}${rows.join('')}</table>` : '<div class="empty">لا توجد بيانات</div>';
  shell(`
    <div class="page-head"><h1>الإحصائيات <span>والمؤشرات</span></h1></div>
    <div class="kpis">
      <div class="kpi"><div class="v">${total}</div><div class="l">إجمالي القضايا</div></div>
      ${byStatus.map(r => `<div class="kpi"><div class="v">${r[1]}</div><div class="l">قضايا ${esc(r[0])}</div></div>`).join('')}
      <div class="kpi"><div class="v">${DB.statements.length}</div><div class="l">محاضر سماع الأقوال</div></div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>حسب النتيجة النهائية</h2>${tbl('<tr class="hd"><th>النتيجة</th><th>العدد</th><th style="width:35%">النسبة</th></tr>',
        byResult.map(r => `<tr><td>${esc(r[0])}</td><td><b>${r[1]}</b></td><td><div class="bar"><i style="width:${(r[1] * 100 / total).toFixed(1)}%"></i></div></td></tr>`))}</div>
      <div class="card"><h2>حسب مصدر الأمر</h2>${tbl('<tr class="hd"><th>المصدر</th><th>العدد</th></tr>',
        bySource.map(r => `<tr><td>${esc(r[0] || 'غير محدد')}</td><td><b>${r[1]}</b></td></tr>`))}</div>
      <div class="card"><h2>القضايا حسب شهر التسجيل</h2>${tbl('<tr class="hd"><th>الشهر (م)</th><th>العدد</th><th style="width:35%"></th></tr>',
        byMonth.map(r => `<tr><td>${esc(r[0])}</td><td><b>${r[1]}</b></td><td><div class="bar"><i style="width:${(r[1] * 100 / mx).toFixed(1)}%"></i></div></td></tr>`))}</div>
      <div class="card"><h2>حسب المحقق المكلف</h2>${tbl('<tr class="hd"><th>المحقق</th><th>الإجمالي</th><th>المنجز</th></tr>',
        [...um.entries()].sort((a, b) => b[1][0] - a[1][0]).map(r => `<tr><td>${esc(r[0])}</td><td><b>${r[1][0]}</b></td><td>${r[1][1]}</td></tr>`))}</div>
    </div>`, 'stats');
}

// ========================= الإعدادات =========================
async function exportBackup() {
  const files = {};
  for (const p of await Store.backend.listFiles()) {
    const b = await Store.backend.getFile(p);
    if (b) files[p] = await blobToDataURL(b);
  }
  const out = { app: 'cases-platform', kind: 'backup', exported_at: nowStr(), db: DB, files };
  const d = new Date();
  download(new Blob([JSON.stringify(out)], { type: 'application/json' }), `نسخة-احتياطية-القضايا-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.json`);
}
async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { return toast('الملف ليس نسخة احتياطية صالحة', 'error'); }
  if (!data || data.app !== 'cases-platform' || !data.db) return toast('الملف ليس نسخة احتياطية من هذه المنصة', 'error');
  const n = (data.db.cases || []).length;
  if (!confirm(`سيتم استبدال جميع البيانات الحالية (${DB.cases.length} قضية) ببيانات النسخة (${n} قضية). متابعة؟`)) return;
  toast('جارٍ الاستيراد...');
  for (const [p, u] of Object.entries(data.files || {})) await putFile(p, await dataURLToBlob(u));
  urlCache.clear();
  DB = shapeDB(data.db);
  log('استيراد نسخة احتياطية', `${n} قضية`);
  await save();
  toast('تم استيراد النسخة الاحتياطية');
  route();
}
/** نقل كل البيانات والملفات إلى مكان حفظ جديد */
async function moveTo(target) {
  const existing = await target.load().catch(() => null);
  if (existing && existing.cases && existing.cases.length) {
    if (confirm(`المجلد المختار يحتوي على قاعدة بيانات (${existing.cases.length} قضية).\nموافق = فتح بيانات ذلك المجلد\nإلغاء = تراجع دون تغيير`)) {
      await Store.useBackend(target); urlCache.clear(); DB = shapeDB(existing); toast('تم فتح بيانات المجلد'); route();
    }
    return;
  }
  toast('جارٍ نقل البيانات...');
  for (const p of await Store.backend.listFiles()) { const b = await Store.backend.getFile(p); if (b) await target.putFile(p, b); }
  await target.save(DB);
  await Store.useBackend(target);
  urlCache.clear();
  log('نقل مكان الحفظ', target.label); await save();
  toast('تم نقل البيانات إلى: ' + target.label);
  route();
}

function viewSettings() {
  const s = S();
  const signer = (k, label) => `<div><div class="signer-head">${label}</div>
    <div class="field"><label>المسمى</label><input type="text" name="def_${k}_title" value="${esc(s['def_' + k + '_title'])}"></div>
    <div class="field"><label>الرتبة</label><input type="text" name="def_${k}_rank" value="${esc(s['def_' + k + '_rank'])}"></div>
    <div class="field"><label>الاسم</label><input type="text" name="def_${k}_name" value="${esc(s['def_' + k + '_name'])}"></div></div>`;
  const b = Store.backend;
  shell(`
    <div class="page-head"><h1>إعدادات <span>المنصة</span></h1></div>

    <div class="card"><h2>مكان حفظ قاعدة البيانات</h2>
      <div style="line-height:1.9">الحالي: <b>${esc(b.label)}</b></div>
      <div class="hint">${b.kind === 'folder' ? 'تُحفظ البيانات في الملف data.json (ونسخة الحفظ السابق data.prev.json) والتواقيع والمرفقات في مجلدات داخله.'
        : 'البيانات محفوظة داخل هذا المتصفح فقط. مسح بيانات المتصفح يحذفها — خذ نسخة احتياطية بشكل دوري.'}</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px">
        ${Store.folderSupported ? '<button class="btn ghost" id="mvFolder">نقل/فتح مجلد آخر</button>' : ''}
        ${b.kind === 'folder' ? '<button class="btn ghost" id="mvBrowser">النقل إلى داخل المتصفح</button>' : ''}
      </div>
      <h2 style="margin-top:20px">النسخ الاحتياطي</h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <button class="btn" id="bkExport">تصدير نسخة احتياطية</button>
        <label class="btn ghost" style="margin:0">استيراد نسخة احتياطية<input type="file" id="bkImport" accept=".json,application/json" hidden></label>
      </div>
      <div class="hint">النسخة ملف واحد يضم القضايا والتواقيع والمرفقات — استخدمه لنقل البيانات بين الجوال والكمبيوتر.</div>
    </div>

    <form id="f">
    <div class="card"><h2>ترويسة المستندات الرسمية</h2>
      <div class="grid g3">
        ${[1, 2, 3, 4, 5].map(i => `<div class="field"><label>السطر ${i}</label><input type="text" name="org_line${i}" value="${esc(s['org_line' + i])}"></div>`).join('')}
        <div class="field"><label>عنوان التقرير</label><input type="text" name="report_title" value="${esc(s.report_title)}"></div>
      </div>
      <div class="field" style="margin-top:14px"><label>الشعار</label>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
          ${s.logo_file ? `<img data-file="${esc(s.logo_file)}" style="height:48px" alt=""> <button type="button" class="btn sm danger" id="rmLogo">إزالة</button>` : ''}
          <input type="file" id="logo" accept="image/*" style="max-width:280px"></div>
        <div class="hint">صورة PNG بخلفية شفافة تظهر في الترويسة والتقارير. تُحفظ مع بياناتك ولا تُرفع للإنترنت.</div></div>
    </div>

    <div class="card"><h2>القيم الافتراضية للقضايا والمحاضر</h2>
      <div class="grid g2">
        <div class="field"><label>مصدر الأمر الافتراضي</label><input type="text" name="def_order_source" value="${esc(s.def_order_source)}"></div>
        <div class="field"><label>مكان سماع الأقوال الافتراضي</label><input type="text" name="def_location" value="${esc(s.def_location)}"></div>
        <div class="field"><label>رتبة المحقق (سمع الأقوال)</label><input type="text" name="def_taker_rank" value="${esc(s.def_taker_rank)}"></div>
        <div class="field"><label>اسم المحقق (سمع الأقوال)</label><input type="text" name="def_taker_name" value="${esc(s.def_taker_name)}"></div>
      </div></div>

    <div class="card"><h2>الموقّعون الافتراضيون في التقرير</h2>
      <div class="grid g3">${signer('prepared', 'معد التقرير')}${signer('reviewed', 'راجعه')}${signer('approved', 'أجازه')}</div></div>

    <div class="formbar"><button class="btn gold" type="submit">حفظ الإعدادات</button></div>
    </form>

    <div class="card" id="takerSigCard"><h2>توقيع المحقق (من سمع الأقوال ودوّنها)</h2>
      ${s.taker_sig ? `<div style="margin-bottom:12px"><label>التوقيع المحفوظ حاليًا</label>
        <img class="sig-img" data-file="${esc(s.taker_sig)}" alt="">
        <div style="margin-top:8px"><button type="button" class="btn sm danger" id="takerSigDel">حذف التوقيع المحفوظ</button></div></div>` : ''}
      <label>${s.taker_sig ? 'استبداله بتوقيع جديد' : 'وقّع هنا مرة واحدة'}</label>
      ${sigPadHTML('sigDefault')}
      <div style="margin-top:12px"><button type="button" class="btn gold" id="takerSigSave">حفظ التوقيع</button></div>
      <div class="hint">يُدرج هذا التوقيع تلقائيًا تحت «سمع الأقوال ودوّنها» في كل محضر جديد، ويمكن تغييره لأي محضر من صفحة المحضر. المحاضر السابقة تحتفظ بتوقيعها.</div></div>

    <div class="card"><h2>رمز الدخول</h2>
      <form id="pinF" class="grid g3" style="align-items:end">
        <div><label>${s.lock_hash ? 'رمز جديد' : 'رمز الدخول'}</label><input type="password" name="pin" inputmode="numeric" autocomplete="new-password" minlength="4"></div>
        <div><button class="btn" type="submit" style="width:100%">${s.lock_hash ? 'تغيير الرمز' : 'تفعيل رمز الدخول'}</button></div>
        ${s.lock_hash ? '<div><button class="btn danger" type="button" id="pinOff" style="width:100%">إلغاء رمز الدخول</button></div>' : ''}
      </form>
      <div class="hint">يُطلب الرمز عند فتح المنصة. هو حماية للواجهة فقط؛ احفظ الجهاز والمجلد بعيدًا عن غير المخوّلين.</div></div>

    <div class="card"><h2>سجل الحركات</h2>
      <div style="max-height:340px; overflow:auto">${DB.log.length ? `<table class="rt"><tr class="hd"><th>الوقت</th><th>الإجراء</th><th>التفاصيل</th></tr>
        ${DB.log.slice(0, 150).map(l => `<tr><td data-l="الوقت" class="muted">${esc(l.ts)}</td><td data-l="الإجراء">${esc(l.action)}</td><td data-l="التفاصيل" class="muted">${esc(l.details)}</td></tr>`).join('')}</table>`
        : '<div class="empty">لا توجد حركات مسجلة</div>'}</div></div>`, 'settings');

  const f = $('#f');
  f.onsubmit = async e => {
    e.preventDefault();
    Object.assign(S(), formObj(f));
    const lf = $('#logo').files[0];
    if (lf) {
      const path = 'logo/logo_' + Date.now() + '.' + (lf.name.split('.').pop() || 'png').toLowerCase();
      await putFile(path, lf);
      if (S().logo_file) await delFile(S().logo_file);
      S().logo_file = path;
    }
    log('حفظ الإعدادات'); await save(); toast('تم حفظ الإعدادات'); route();
  };
  const rm = $('#rmLogo');
  if (rm) rm.onclick = async () => { await delFile(S().logo_file); S().logo_file = ''; await save(); route(); };
  const dpad = mountSig($('#sigDefault'));
  $('#takerSigSave').onclick = async () => {
    const blob = await dpad.toBlob();
    if (!blob) return toast('وقّع داخل المربع أولًا', 'error');
    const path = `signatures/taker_${Date.now()}.png`;
    await putFile(path, blob);
    const prev = S().taker_sig;
    S().taker_sig = path;
    await delFileIfUnused(prev);
    log('حفظ توقيع المحقق'); await save(); toast('تم حفظ توقيع المحقق'); route();
  };
  const tsd = $('#takerSigDel');
  if (tsd) tsd.onclick = async () => {
    if (!confirm('حذف التوقيع المحفوظ؟ (المحاضر السابقة تحتفظ بتوقيعها)')) return;
    const prev = S().taker_sig; S().taker_sig = '';
    await delFileIfUnused(prev);
    log('حذف توقيع المحقق'); await save(); route();
  };
  $('#bkExport').onclick = () => exportBackup().catch(e => toast('تعذّر التصدير: ' + e.message, 'error'));
  $('#bkImport').onchange = e => { const fl = e.target.files[0]; if (fl) importBackup(fl).catch(err => toast('تعذّر الاستيراد: ' + err.message, 'error')); };
  const mf = $('#mvFolder');
  if (mf) mf.onclick = async () => {
    try { const t = await Store.pickFolder(); await moveTo(t); }
    catch (e) { if (e.name !== 'AbortError') toast('تعذّر: ' + e.message, 'error'); }
  };
  const mb = $('#mvBrowser');
  if (mb) mb.onclick = () => { if (confirm('نقل جميع البيانات من المجلد إلى داخل المتصفح؟ (يبقى المجلد كما هو)')) moveTo(Store.browser).catch(e => toast(e.message, 'error')); };
  $('#pinF').onsubmit = async e => {
    e.preventDefault();
    const pin = formObj(e.target).pin;
    if (!pin || pin.length < 4) return toast('الرمز يجب ألا يقل عن 4 خانات', 'error');
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(x => x.toString(16).padStart(2, '0')).join('');
    S().lock_salt = salt; S().lock_hash = await sha256(salt + pin);
    sessionStorage.setItem('unlocked', S().lock_hash);
    log('تفعيل/تغيير رمز الدخول'); await save(); toast('تم حفظ رمز الدخول'); route();
  };
  const po = $('#pinOff');
  if (po) po.onclick = async () => { if (!confirm('إلغاء رمز الدخول؟')) return; S().lock_hash = ''; S().lock_salt = ''; log('إلغاء رمز الدخول'); await save(); route(); };
}

boot();
