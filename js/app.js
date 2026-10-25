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
const TPL_WAIVE = { name: 'تنازل المدعي (حفظ)',
  result: 'بعد الاطلاع على كامل أوراق المعاملة، جرى الاتصال على {المدعي} لطلب الحضور للمراجعة، وأفاد بعدم رغبته بالمراجعة وتنازله عن مواصلة الدعوى وعدم رغبته بالحضور، حسب محضر الاتصال المرفق.',
  opinion: 'حفظ الشكوى لتنازل المدعي عن مواصلة الدعوى وعدم رغبته بالحضور.' };
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
  cover_to: 'سعادة وكيل إمارة منطقة المدينة المنورة للشؤون الأمنية',
  def_director_title: 'مدير شرطة منطقة المدينة المنورة', def_director_rank: 'اللواء', def_director_name: '',
  sender_assist_title: 'مساعد مدير الشرطة لشؤون الأمن', sender_assist_rank: 'عميد', sender_assist_name: '',
  lock_hash: '', lock_salt: '',
  report_templates: [
    { name: 'عدم ثبوت الإساءة (حفظ)',
      result: 'بعد الاطلاع على كامل أوراق المعاملة وما تضمنته من إفادات، لم يثبت وجود أي إساءة استخدام للسلطة من قبل رجل الأمن {المدعى عليه}.',
      opinion: 'حفظ الشكوى لعدم ثبوت ما يستوجب الاستمرار فيها.' },
    { name: 'ثبوت الإساءة (إدانة)',
      result: 'بعد الاطلاع على كامل أوراق المعاملة وما تضمنته من إفادات، ثبت قيام رجل الأمن {المدعى عليه} بإساءة استخدام السلطة تجاه {المدعي}.',
      opinion: 'إحالة رجل الأمن المذكور إلى الجهة المختصة لاتخاذ الإجراء النظامي بحقه، وإشعار المدعي بما تم.' },
    TPL_WAIVE,
  ],
};
const APP_VERSION = 18;   // يُرفع مع CACHE في sw.js عند كل نشر
const TABLES = ['cases', 'parties', 'statements', 'attachments', 'reports', 'letters', 'requests', 'records'];
const CASE_CHILDREN = ['parties', 'statements', 'attachments', 'reports', 'letters', 'requests', 'records'];
let DB = null;

function newUid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }
function shapeDB(d) {
  d = d && typeof d === 'object' ? d : {};
  d.app = 'cases-platform'; d.version = 1;
  d.seq = d.seq || {};
  for (const t of TABLES) { d[t] = Array.isArray(d[t]) ? d[t] : []; d.seq[t] = Math.max(d.seq[t] || 0, ...d[t].map(r => r.id || 0), 0); }
  for (const c of d.cases) if (!c.uid) c.uid = newUid();
  d.seq.case_no = Math.max(d.seq.case_no || 0, ...d.cases.map(c => /^\d+$/.test(String(c.case_number || '').trim()) ? +c.case_number : 0), 0);
  d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  // صيغة «تنازل المدعي» تُضاف مرة واحدة لمن حفظ صيغه قبل وجودها (ولا تعود إن حذفها)
  if (!d.settings.tpl_waive_added) {
    if (!d.settings.report_templates.some(t => t.name === TPL_WAIVE.name)) d.settings.report_templates = [...d.settings.report_templates, Object.assign({}, TPL_WAIVE)];
    d.settings.tpl_waive_added = true;
  }
  d.log = Array.isArray(d.log) ? d.log : [];
  // المحاضر الواردة برابط الإفادة كانت تُحفظ بمكان «إفادة إلكترونية عن بُعد»: تأخذ المكان الافتراضي
  for (const s of d.statements) if (s.location === 'إفادة إلكترونية عن بُعد') s.location = d.settings.def_location;
  // نص خطاب التغطية المحفوظ في القضية (الإصدار السابق) يصبح خطابًا في قائمة الخطابات
  for (const c of d.cases) if (c.cover_text) {
    d.letters.push({ id: ++d.seq.letters, case_id: c.id, type: 'cover', to: d.settings.cover_to, body: c.cover_text,
      sender: 'director', letter_number: '', letter_date: '', attachments: '', created_at: c.updated_at || '' });
    delete c.cover_text;
  }
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

function updateBar() {
  if ($('#updBar')) return;
  const b = document.createElement('div');
  b.id = 'updBar'; b.className = 'updbar';
  b.innerHTML = 'يوجد تحديث جديد للمنصة <button class="btn sm gold" style="margin-inline-start:10px">تحديث الآن</button>';
  b.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(b);
}

async function boot() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    const hadSW = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
    // وصل إصدار جديد أثناء فتح الصفحة: زر لإعادة التحميل (لا إعادة تلقائية حتى لا يضيع ما يُكتب)
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW) updateBar(); });
  }
  if (location.hash.startsWith('#/r/')) return viewRemote();   // صفحة المجيب على طلب الإفادة
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
    if (b === 'remote') {
      if (sid === 'new') return viewRemoteRequestForm(cs, q.get('party'), q.get('st'));
      const rq = DB.requests.find(r => r.id === +sid && r.case_id === cs.id);
      if (rq) return viewRemoteRequest(cs, rq);
    }
    if (b === 'letter') {
      if (sid === 'new') return viewLetterForm(cs, null, q.get('type'), q.get('party'));
      const lt = DB.letters.find(l => l.id === +sid && l.case_id === cs.id);
      if (lt) return c === 'print' ? viewLetterPrint(cs, lt) : viewLetterForm(cs, lt);
    }
    if (b === 'record') {
      if (sid === 'new') return viewRecordForm(cs, null, q.get('type'), q.get('party'));
      const rd = DB.records.find(r => r.id === +sid && r.case_id === cs.id);
      if (rd) return c === 'print' ? viewRecordPrint(cs, rd) : viewRecordForm(cs, rd);
    }
  }
  location.hash = '#/';
}

// ---- راحة الكتابة على الجوال ----
// مربعات النص تكبر مع المحتوى (بدل التمرير داخلها، الذي يصعّب تحريك المؤشر باللمس)
function autoGrow(ta) {
  if (!ta || ta.tagName !== 'TEXTAREA' || !ta.offsetParent) return;
  const y = window.scrollY;
  ta.style.height = 'auto';
  ta.style.height = (ta.scrollHeight + 2) + 'px';
  window.scrollTo(0, y);
}
function setVal(el, v) { el.value = v; autoGrow(el); }
document.addEventListener('input', e => autoGrow(e.target));

// الحقول ذات السطر الواحد تصبح مربعات تكبر مع النص، فتظهر العبارة كاملة مهما طالت.
// تبقى سطرًا واحدًا في المعنى: Enter لا يضيف سطرًا، والأسطر الملصقة تُدمج.
// (الحقول الرقمية بـ inputmode تبقى كما هي)
const growRO = typeof ResizeObserver === 'function' ? new ResizeObserver(es => es.forEach(e => {
  const w = Math.round(e.contentRect.width);
  if (w && +e.target.dataset.w !== w) { e.target.dataset.w = w; autoGrow(e.target); }
})) : null;
const growAll = () => $$('textarea').forEach(autoGrow);
function growFields(root) {
  $$('input[type=text]:not([inputmode])', root).forEach(inp => {
    const ta = document.createElement('textarea');
    for (const a of inp.attributes) if (!/^(type|value|list)$/.test(a.name)) ta.setAttribute(a.name, a.value);
    if (inp.getAttribute('list')) ta.dataset.list = inp.getAttribute('list');
    ta.classList.add('line');
    ta.rows = 1;
    ta.value = inp.value;
    inp.replaceWith(ta);
  });
  if (growRO) $$('textarea', root).forEach(t => growRO.observe(t));
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches && e.target.matches('textarea.line')) e.preventDefault();
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches && t.matches('textarea.line') && /[\r\n]/.test(t.value)) { t.value = t.value.replace(/\s*[\r\n]+\s*/g, ' '); autoGrow(t); }
}, true);
// أزرار تملأ الحقول برمجيًا (مثل «اليوم» والصيغ الجاهزة) لا تطلق حدث input
document.addEventListener('click', () => setTimeout(growAll, 0));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(growAll);

// اقتراحات القوائم (datalist) للحقول التي صارت مربعات نص
let suggBox = null;
function showSugg(ta) {
  const dl = ta.dataset.list && document.getElementById(ta.dataset.list);
  hideSugg();
  if (!dl) return;
  const q = ta.value.trim();
  const opts = Array.from(dl.options).map(o => o.value).filter(v => v && v !== q && (!q || v.includes(q))).slice(0, 8);
  if (!opts.length) return;
  suggBox = document.createElement('div');
  suggBox.className = 'sugg';
  suggBox.owner = ta;
  suggBox.innerHTML = opts.map(v => `<button type="button">${esc(v)}</button>`).join('');
  suggBox.addEventListener('mousedown', e => e.preventDefault());   // يبقى التركيز في الحقل
  suggBox.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    ta.value = b.textContent;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    hideSugg();
  });
  ta.insertAdjacentElement('afterend', suggBox);
}
function hideSugg() { if (suggBox) { suggBox.remove(); suggBox = null; } }
document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.list) showSugg(e.target); else hideSugg(); });
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.list) showSugg(e.target); });
document.addEventListener('focusout', e => {
  const t = e.target;
  setTimeout(() => { if (suggBox && suggBox.owner === t && document.activeElement !== t) hideSugg(); }, 150);
});
// أثناء الكتابة نخفي الشريط السفلي ونفكّ تثبيت زر الحفظ حتى تبقى مساحة النص ظاهرة فوق لوحة المفاتيح
const isTypingEl = el => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|file|button|submit)$/.test(el.type)));
document.addEventListener('focusin', e => { if (isTypingEl(e.target)) document.body.classList.add('typing'); });
document.addEventListener('focusout', () => setTimeout(() => { if (!isTypingEl(document.activeElement)) document.body.classList.remove('typing'); }, 60));

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
  growFields(app());
  setTimeout(growAll, 0);
}

function modal(html) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);
  growFields(bg);
  setTimeout(growAll, 0);
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
        <td data-l="رقم القضية"><b>${esc(c.case_number || '—')}</b></td>
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
// ترقيم القضايا: عدّاد لا يرجع للخلف، فرقم القضية المحذوفة لا يُعاد استخدامه
const caseNoOf = c => /^\d+$/.test(String(c.case_number || '').trim()) ? +String(c.case_number).trim() : 0;
function nextCaseNo() { return Math.max(DB.seq.case_no || 0, ...DB.cases.map(caseNoOf), 0) + 1; }
const caseNoTaken = (no, exceptId) => !!no && DB.cases.some(x => x.id !== exceptId && String(x.case_number || '').trim() === no);

function viewCaseForm(c) {
  const v = c || { case_number: String(nextCaseNo()), order_source: S().def_order_source, status: 'جارية', assigned_name: S().def_taker_name };
  const names = [...new Set(DB.cases.map(x => x.assigned_name).concat(S().def_taker_name).filter(Boolean))];
  shell(`
    <div class="page-head"><h1>${c ? 'تعديل بيانات القضية' : 'قضية <span>جديدة</span>'}</h1></div>
    <form id="f">
    <div class="card"><h2>البيانات الرئيسية للقضية</h2>
      <div class="grid g2">
        <div class="field"><label>رقم القضية (داخلي)</label><input type="text" name="case_number" id="caseNo" inputmode="numeric" value="${esc(v.case_number)}">
          <div class="hint" id="caseNoHint">${c ? 'يمكن تعديله عند الحاجة' : 'رقم تلقائي — يمكن تعديله عند الحاجة'}</div></div>
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
  const no = $('#caseNo'), hint = $('#caseNoHint'), hint0 = hint.textContent;
  const checkNo = () => {
    const dup = caseNoTaken(no.value.trim(), c && c.id);
    hint.textContent = dup ? '⚠ هذا الرقم مستخدم في قضية أخرى' : hint0;
    hint.style.color = dup ? 'var(--red)' : '';
  };
  no.oninput = checkNo; checkNo();
  f.onsubmit = async e => {
    e.preventDefault();
    const o = formObj(f);
    if (caseNoTaken(o.case_number, c && c.id) && !confirm(`رقم القضية (${o.case_number}) مستخدم في قضية أخرى. الحفظ بنفس الرقم؟`)) return;
    let rec = c;
    if (!rec) { rec = { id: nextId('cases'), uid: newUid(), created_at: nowStr(), final_result: '' }; DB.cases.push(rec); }
    Object.assign(rec, o, { updated_at: nowStr() });
    DB.seq.case_no = Math.max(DB.seq.case_no || 0, caseNoOf(rec));
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
  const letters = DB.letters.filter(l => l.case_id === c.id);
  const reqs = DB.requests.filter(r => r.case_id === c.id);
  const recs = DB.records.filter(r => r.case_id === c.id);
  const pName = id => (byId('parties', id) || {}).name || '—';
  const pRole = id => (byId('parties', id) || {}).party_role || '';
  shell(`
    <div class="page-head">
      <h1>ملف القضية <span>رقم ${esc(c.case_number || c.id)}</span>
        <span class="badge st-${esc(c.status)}">${esc(c.status)}</span></h1>
      <div class="acts"><a class="btn" href="#/case/${c.id}/report">تقرير تقييم الإجراءات</a>
        <a class="btn ghost" href="#/case/${c.id}/edit">تعديل البيانات</a>
        <button class="btn danger" id="delCase">حذف</button></div>
    </div>
    <div class="jump">${[['sMain', 'البيانات'], ['sParties', 'الأطراف (' + parties.length + ')'], ['sSts', 'المحاضر (' + sts.length + ')'], ['sRemote', 'طلبات الإفادة (' + reqs.length + ')'], ['sRecs', 'محاضر الإجراءات (' + recs.length + ')'],
      ['sAtt', 'المرفقات (' + atts.length + ')'], ['sRep', 'التقرير'], ['sLetters', 'الخطابات (' + letters.length + ')']].map(j => `<button data-j="${j[0]}">${j[1]}</button>`).join('')}</div>

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
      <div style="margin-top:14px"><button class="btn sm ghost" id="caseBackup">حفظ نسخة من هذه القضية (ملف)</button></div>
    </div>

    <div class="card" id="sParties"><h2>أطراف القضية</h2>
      ${parties.length ? `<table class="rt">
        <tr class="hd"><th>م</th><th>الصفة</th><th>الاسم</th><th>رقم الهوية</th><th>الجنسية</th><th>الجنس</th><th>الجوال</th><th>المهنة/الرتبة</th><th></th></tr>
        ${parties.map((p, i) => `<tr>
          <td class="nomob">${i + 1}</td>
          <td data-l="الصفة"><span class="badge role">${esc(p.party_role)}</span></td>
          <td data-l="الاسم"><div><b>${esc(p.name)}</b>${p.unit ? `<br><span class="muted">جهة العمل: ${esc(p.unit)}</span>` : ''}${p.marital ? `<br><span class="muted">${esc(p.marital)}</span>` : ''}${p.address ? `<br><span class="muted">${esc(p.address)}</span>` : ''}</div></td>
          <td data-l="رقم الهوية">${esc(p.national_id || '—')}</td>
          <td data-l="الجنسية">${esc(p.nationality || '—')}</td>
          <td data-l="الجنس">${esc(p.gender || '—')}</td>
          <td data-l="الجوال">${esc(p.phone || '—')}</td>
          <td data-l="المهنة/الرتبة">${esc(p.rank_job || '—')}</td>
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
            <a class="btn sm ghost" href="#/case/${c.id}/remote/new?st=${s.id}">أسئلة إضافية</a>
            <button class="btn sm danger" data-sdel="${s.id}">حذف</button></div></td></tr>`).join('')}
      </table>` : '<div class="empty">لا توجد محاضر بعد — أضف الأطراف ثم اضغط «سماع أقوال»</div>'}
      <div style="margin-top:14px"><a class="btn ghost" href="#/case/${c.id}/statement/new">+ محضر سماع أقوال جديد</a></div>
    </div>

    <div class="card" id="sRemote"><h2>طلبات الإفادة</h2>
      ${reqs.length ? `<table class="rt">
        <tr class="hd"><th>م</th><th>الطرف</th><th>ينتهي</th><th>الحالة</th><th></th></tr>
        ${reqs.map((r, i) => { const [t, cls] = remoteStatus(r); return `<tr>
          <td class="nomob">${i + 1}</td>
          <td data-l="الطرف"><b>${esc(pName(r.party_id))}</b></td>
          <td data-l="ينتهي">${esc(fmtWhen(r.expires_at))}</td>
          <td data-l="الحالة"><span class="badge ${cls}">${t}</span></td>
          <td class="actions-cell"><div class="btns"><a class="btn sm" href="#/case/${c.id}/remote/${r.id}">فتح</a>
            ${!remoteStopped(r) ? `<button class="btn sm danger" data-rstop="${r.id}">إيقاف الرابط</button>` : ''}</div></td></tr>`; }).join('')}
      </table>` : '<div class="empty">أرسل للطرف رابطًا بالواتساب فيه أسئلتك، يجيب ويوقّع، ويعيد لك ملف الإفادة فيصير محضرًا في القضية</div>'}
      <div style="margin-top:14px"><a class="btn ghost" href="#/case/${c.id}/remote/new">+ طلب إفادة</a></div>
    </div>

    <div class="card" id="sRecs"><h2>محاضر الإجراءات</h2>
      ${recs.length ? `<table class="rt">
        <tr class="hd"><th>م</th><th>المحضر</th><th>الطرف</th><th>التاريخ</th><th></th></tr>
        ${recs.map((r, i) => `<tr>
          <td class="nomob">${i + 1}</td>
          <td data-l="المحضر"><b>${esc(recordTitle(r))}</b></td>
          <td data-l="الطرف">${r.party_id ? esc(pName(r.party_id)) : (r.place ? esc(r.place) : '—')}</td>
          <td data-l="التاريخ">${esc(r.record_date || '—')}</td>
          <td class="actions-cell"><div class="btns">
            <a class="btn sm" href="#/case/${c.id}/record/${r.id}/print">طباعة</a>
            <a class="btn sm ghost" href="#/case/${c.id}/record/${r.id}">تعديل</a>
            <button class="btn sm danger" data-rdel="${r.id}">حذف</button></div></td></tr>`).join('')}
      </table>` : '<div class="empty">محضر اتصال لمن لم يرد على الاتصال، أو محضر مشاهدة، أو محضر بعنوان تختاره</div>'}
      <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap">
        ${Object.entries(RECORD_TYPES).map(([k, t]) => `<a class="btn ghost" href="#/case/${c.id}/record/new?type=${k}">+ ${t.label}</a>`).join('')}
      </div>
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
    </div>

    <div class="card" id="sLetters"><h2>الخطابات</h2>
      ${letters.length ? `<table class="rt">
        <tr class="hd"><th>م</th><th>الخطاب</th><th>الموجّه إليه</th><th>التاريخ</th><th></th></tr>
        ${letters.map((l, i) => `<tr>
          <td class="nomob">${i + 1}</td>
          <td data-l="الخطاب"><b>${esc(LETTER_TYPES[l.type] ? LETTER_TYPES[l.type].label : 'خطاب')}</b></td>
          <td data-l="إلى">${esc(l.to || '—')}</td>
          <td data-l="التاريخ">${esc(l.letter_date || '—')}</td>
          <td class="actions-cell"><div class="btns">
            <button class="btn sm" data-lcopy="${l.id}">نسخ المتن</button>
            <a class="btn sm ghost" href="#/case/${c.id}/letter/${l.id}">فتح</a>
            <a class="btn sm ghost" href="#/case/${c.id}/letter/${l.id}/print">طباعة</a>
            <button class="btn sm danger" data-ldel="${l.id}">حذف</button></div></td></tr>`).join('')}
      </table>` : '<div class="empty">لا توجد خطابات بعد — اختر نوع الخطاب أدناه</div>'}
      <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap">
        ${Object.entries(LETTER_TYPES).map(([k, t]) => `<a class="btn ghost" href="#/case/${c.id}/letter/new?type=${k}">+ ${t.label}</a>`).join('')}
      </div>
    </div>`);

  $$('[data-j]').forEach(b => b.onclick = () => { const t = document.getElementById(b.dataset.j); window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 70, behavior: 'smooth' }); });
  $('#delCase').onclick = async () => {
    if (!confirm('حذف القضية وجميع أطرافها ومحاضرها ومرفقاتها نهائيًا؟')) return;
    for (const s of sts) await delFile(s.signature_path);
    for (const a of atts) await delFile(a.filename);
    DB.cases = DB.cases.filter(x => x.id !== c.id);
    for (const t of CASE_CHILDREN) DB[t] = DB[t].filter(x => x.case_id !== c.id);
    for (const s of sts) await delFileIfUnused(s.taker_sig_path);
    log('حذف قضية', 'قضية رقم ' + (c.case_number || c.id));
    await save(); toast('تم حذف القضية'); location.hash = '#/';
  };
  $('#caseBackup').onclick = () => exportCases([c.id]).catch(e => toast('تعذّر الحفظ: ' + e.message, 'error'));
  $('#addParty').onclick = () => partyModal(c, null);
  $$('[data-pedit]').forEach(b => b.onclick = () => partyModal(c, byId('parties', b.dataset.pedit)));
  $$('[data-pdel]').forEach(b => b.onclick = async () => {
    const p = byId('parties', b.dataset.pdel);
    if (!confirm(`حذف الطرف «${p.name}» ومحاضره؟`)) return;
    const gone = DB.statements.filter(s => s.party_id === p.id);
    DB.statements = DB.statements.filter(s => s.party_id !== p.id);
    for (const s of gone) for (const fp of statementFiles(s)) await delFileIfUnused(fp);
    DB.parties = DB.parties.filter(x => x.id !== p.id);
    await save(); toast('تم حذف الطرف'); route();
  });
  $$('[data-sdel]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف المحضر؟')) return;
    const s = byId('statements', b.dataset.sdel);
    DB.statements = DB.statements.filter(x => x.id !== s.id);
    for (const fp of statementFiles(s)) await delFileIfUnused(fp);
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
  $$('[data-lcopy]').forEach(b => b.onclick = () => copyText(byId('letters', b.dataset.lcopy).body.trim(), 'تم نسخ متن الخطاب'));
  $$('[data-rstop]').forEach(b => b.onclick = () => stopRemoteRequest(byId('requests', b.dataset.rstop)));
  $$('[data-rdel]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف المحضر؟')) return;
    DB.records = DB.records.filter(x => x.id !== +b.dataset.rdel);
    log('حذف محضر', 'قضية #' + c.id); await save(); toast('تم حذف المحضر'); route();
  });
  $$('[data-ldel]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف الخطاب؟')) return;
    DB.letters = DB.letters.filter(x => x.id !== +b.dataset.ldel);
    log('حذف خطاب', 'قضية #' + c.id); await save(); toast('تم حذف الخطاب'); route();
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

// ---- بيانات الأطراف ----
const POSITIONS = ['قائد', 'مدير', 'رئيس', 'مساعد قائد', 'مساعد مدير', 'آمر', 'مشرف', 'مدير عام'];
const EDU = ['أمّي', 'ابتدائي', 'متوسط', 'ثانوي', 'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه'];
const maritalOpts = g => g === 'أنثى' ? ['عزباء', 'متزوجة', 'مطلقة', 'أرملة'] : ['أعزب', 'متزوج', 'مطلق', 'أرمل'];
/** يفصل «مدير مركز شرطة الخالدية» إلى منصب وجهة (للبيانات المحفوظة قبل فصل الخانتين) */
function splitHead(h) {
  h = (h || '').trim();
  const pos = POSITIONS.slice().sort((x, y) => y.length - x.length).find(x => h.startsWith(x + ' '));
  return pos ? [pos, h.slice(pos.length + 1).trim()] : ['', h];
}
const joinHead = (t, e) => [t, e].map(x => (x || '').trim()).filter(Boolean).join(' ');
/** منصب مقترح حسب نوع الجهة: القوة/الوحدة ← قائد، وغيرها ← مدير */
function guessTitle(entity) {
  const e = (entity || '').trim();
  if (!e) return '';
  if (/^(ال)?(قوة|قوات|وحدة|كتيبة|سرية|لواء|فوج)/.test(e)) return 'قائد';
  if (/^(ال)?(لجنة|هيئة|مجلس)/.test(e)) return 'رئيس';
  return 'مدير';
}
function headOf(p) {
  if (!p) return ['', ''];
  if (p.head_title || p.head_entity) return [p.head_title || '', p.head_entity || ''];
  if (p.unit_head) return splitHead(p.unit_head);
  return p.unit ? [guessTitle(p.unit), p.unit] : ['', ''];   // لم يُحدَّد المخاطَب: نقترحه من جهة العمل
}

function partyModal(c, p) {
  const v = p || { party_role: 'مدعي', nationality: 'سعودي', gender: 'ذكر' };
  const uniq = k => [...new Set(DB.parties.map(x => x[k]).filter(Boolean))];
  const [ht, he] = headOf(v);
  const dl = (id, list) => `<datalist id="${id}">${list.map(u => `<option value="${esc(u)}">`).join('')}</datalist>`;
  const m = modal(`<h2>${p ? 'تعديل بيانات ' + esc(p.name) : 'إضافة طرف جديد'}</h2>
    <form id="pf" class="grid g2">
      <div><label>الصفة</label><select name="party_role">${opts(ROLES, v.party_role)}</select></div>
      <div><label>الاسم الكامل *</label><input type="text" name="name" value="${esc(v.name)}" required></div>
      <div><label>رقم الهوية</label><input type="text" name="national_id" inputmode="numeric" value="${esc(v.national_id)}"></div>
      <div><label>الجنسية</label><input type="text" name="nationality" value="${esc(v.nationality)}"></div>
      <div><label>الجنس</label><select name="gender">${opts(['ذكر', 'أنثى'], v.gender)}</select></div>
      <div><label>تاريخ الميلاد</label><input type="text" name="birth_date" value="${esc(v.birth_date)}" placeholder="مثال: 1 / 1 / 1410هـ"></div>
      <div><label>الحالة الاجتماعية</label><select name="marital" id="maritalSel"></select></div>
      <div><label>المؤهل العلمي</label><input type="text" name="education" list="eduList" value="${esc(v.education)}"></div>
      <div><label>المهنة / الرتبة</label><input type="text" name="rank_job" value="${esc(v.rank_job)}" placeholder="مثال: موظف، الرقيب"></div>
      <div><label>جهة العمل</label><input type="text" name="unit" list="unitList" value="${esc(v.unit)}" placeholder="مثال: القوة الخاصة للمسجد النبوي بالمدينة المنورة"></div>
      <div><label>رقم الجوال</label><input type="tel" name="phone" value="${esc(v.phone)}"></div>
      <div><label>العنوان</label><input type="text" name="address" value="${esc(v.address)}"></div>
      <div class="span-all unitbox" id="unitBox">
        <div class="signer-head" style="margin-bottom:4px">المخاطَب في خطاب جهة عمله</div>
        <div class="grid g2">
          <div><label>المنصب</label><input type="text" name="head_title" list="posList" value="${esc(ht)}" placeholder="قائد / مدير / رئيس ..."></div>
          <div><label>الجهة</label><input type="text" name="head_entity" list="entList" value="${esc(he)}" placeholder="مثال: مركز شرطة الخالدية"></div>
        </div>
        <div class="hint" id="headPrev"></div>
      </div>
      ${dl('eduList', EDU)}${dl('unitList', uniq('unit'))}${dl('posList', POSITIONS)}
      ${dl('entList', [...new Set(DB.parties.map(x => headOf(x)[1]).filter(Boolean))])}
      <div class="span-all" style="display:flex; gap:10px">
        <button class="btn gold" type="submit" style="flex:1">${p ? 'حفظ التعديل' : 'إضافة الطرف'}</button>
        <button class="btn ghost" type="button" id="pcancel" style="flex:1">إلغاء</button></div>
    </form>`);
  const pf = $('#pf', m);
  const fillMarital = () => {
    const cur = pf.marital.value || v.marital || '';
    const list = maritalOpts(pf.gender.value);
    // نحافظ على الاختيار عند تغيير الجنس (متزوج ↔ متزوجة)
    const other = maritalOpts(pf.gender.value === 'أنثى' ? 'ذكر' : 'أنثى');
    const sel = other.includes(cur) ? list[other.indexOf(cur)] : cur;
    pf.marital.innerHTML = `<option value="">—</option>` + list.map(x => `<option ${x === sel ? 'selected' : ''}>${x}</option>`).join('') +
      (sel && !list.includes(sel) ? `<option selected>${esc(sel)}</option>` : '');
  };
  pf.gender.onchange = fillMarital; fillMarital();
  const prev = () => {
    const h = joinHead(pf.head_title.value, pf.head_entity.value);
    $('#headPrev', m).textContent = h ? `سيُكتب في الخطاب: سعادة ${h} المحترم` : 'يُستخدم في خطاب الاستدعاء أو طلب الإفادة الموجّه لجهة عمله.';
  };
  pf.head_title.oninput = prev; pf.head_entity.oninput = prev; prev();
  const syncUnit = () => $('#unitBox', m).classList.toggle('hide', pf.party_role.value !== 'مدعى عليه');
  pf.party_role.onchange = syncUnit; syncUnit();
  // جهة عمل سبق استخدامها ← نقترح نفس المخاطَب
  pf.unit.onchange = () => {
    if (pf.head_entity.value.trim() || pf.head_title.value.trim()) return;
    const old = DB.parties.find(x => x.unit === pf.unit.value.trim() && joinHead(...headOf(x)));
    const [t, e] = old ? headOf(old) : [guessTitle(pf.unit.value), pf.unit.value.trim()];
    pf.head_title.value = t; pf.head_entity.value = e; prev();
  };
  $('#pcancel', m).onclick = () => m.remove();
  pf.onsubmit = async e => {
    e.preventDefault();
    const o = formObj(pf);
    o.unit_head = joinHead(o.head_title, o.head_entity);
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
    DB.statements.some(s => s.signature_path === path || s.taker_sig_path === path || (s.answer_sigs || []).includes(path));
  if (!used) await delFile(path);
}
/** كل ملفات التوقيع في محضر (الرئيسي + توقيعات الأجوبة + المحقق) */
const statementFiles = s => [s.signature_path, s.taker_sig_path, ...(s.answer_sigs || [])].filter(Boolean);

// ---- توقيع الطرف عند نهاية كل جواب (الإفادة عن بُعد) ----
const isQ = l => /^\s*س\s*\//.test(l), isA = l => /^\s*ج\s*\//.test(l);
const answerCount = text => String(text || '').split('\n').filter(isA).length;
/** نص الاستجواب للطباعة: توقيع صغير بعد آخر كلمة في كل جواب، عدا الأخير (توقيعه هو الرئيسي أسفل المحضر) */
function qaHTML(text, sigs) {
  const lines = String(text || '').trim().split('\n'), ends = [];
  let ai = -1, inA = false;
  lines.forEach((l, i) => {
    if (isA(l)) { ai++; inA = true; ends[ai] = i; }
    else if (isQ(l)) inA = false;
    else if (inA && l.trim()) ends[ai] = i;
  });
  const out = lines.map(esc);
  (sigs || []).forEach((p, k) => {
    if (p && k < ai && ends[k] != null) out[ends[k]] = out[ends[k]].trimEnd() + ` <img class="asig" data-file="${esc(p)}" alt="">`;
  });
  return out.join('\n');
}

/** السؤال الأول الافتراضي في المحضر حسب صفة الطرف (بياناته الشخصية مطبوعة أصلًا في المحضر) */
function defaultQuestion(c, p) {
  const role = p && p.party_role;
  if (role === 'مدعي') return 'س / ما هي دعواك بالتفصيل؟\nج / ';
  if (role === 'مدعى عليه') {
    const cl = DB.parties.filter(x => x.case_id === c.id && x.party_role === 'مدعي');
    const fem = cl.length === 1 && cl[0].gender === 'أنثى';
    const who = cl.length ? cl.map(x => (x.gender === 'أنثى' ? 'المدعوة/ ' : 'المدعو/ ') + x.name).join(' و') : 'المدعو/ (      )';
    const that = cl.length > 1 ? 'بأنهم' : (fem ? 'بأنها' : 'بأنه');
    return `س / وردنا خطاب ${c.order_source || 'سعادة وكيل إمارة منطقة المدينة المنورة'} رقم (${c.order_number || '      '}) ` +
      `وتاريخ ${c.order_date ? c.order_date + 'هـ' : '(      )'}، بشأن دعوى ${fem ? 'تقدّمت' : 'تقدّم'} بها ${who} ${that} ${c.subject || '(      )'}، فما هي أقوالك؟\nج / `;
  }
  return 'س / ما هي أقوالك ومعلوماتك حول الموضوع؟\nج / ';
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
    text: defaultQuestion(c, byId('parties', pre)) };
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
      <div><label>تاريخ الميلاد</label><b>${esc(p.birth_date || '—')}</b></div>
      <div><label>الحالة الاجتماعية</label><b>${esc(p.marital || '—')}</b></div>
      <div><label>المؤهل العلمي</label><b>${esc(p.education || '—')}</b></div>
      <div><label>المهنة / الرتبة</label><b>${esc(p.rank_job || '—')}</b></div>
      <div><label>جهة العمل</label><b>${esc(p.unit || '—')}</b></div>
      <div><label>الجوال</label><b>${esc(p.phone || '—')}</b></div>
      <div class="span-all"><label>العنوان</label><b>${esc(p.address || '—')}</b></div>
      <div class="span-all hint">لتعديل هذه البيانات: ملف القضية ← الأطراف ← تعديل</div>`;
  };
  // في المحضر الجديد: إذا لم يُعدَّل السؤال الافتراضي، نغيّره حسب صفة الطرف المختار
  let autoQ = st ? null : $('#qa').value;
  sel.onchange = () => {
    showParty();
    if (autoQ !== null && $('#qa').value === autoQ) { autoQ = defaultQuestion(c, byId('parties', sel.value)); setVal($('#qa'), autoQ); }
  };
  showParty();
  const qa = $('#qa');
  $$('[data-ins]').forEach(b => b.onclick = () => {
    const t = b.dataset.ins.replace(/\\n/g, '\n');
    const s = qa.selectionEnd ?? qa.value.length;
    qa.value = qa.value.slice(0, s) + t + qa.value.slice(s);
    autoGrow(qa); qa.focus(); qa.selectionStart = qa.selectionEnd = s + t.length;
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
        await delFileIfUnused(oldSig);   // قد يبقى مستخدمًا كتوقيع على أحد الأجوبة
      } else if (o.remove_sig && oldSig) { rec.signature_path = ''; await delFileIfUnused(oldSig); }
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
    ${printHead([['القضية رقم :', esc(c.case_number)],
                 ['التاريخ :', esc(st.statement_date) + (st.statement_date ? 'هـ' : '')], ['المكان :', esc(st.location)]])}
    <div class="ptitle"><span>( محضر سماع أقوال )</span></div>
    <div class="intro">إنه في يوم ${esc(st.statement_date || ' ........ ')}هـ، وبموجب خطاب ${esc(c.order_source)} رقم (${esc(c.order_number || '      ')}) وتاريخ ${c.order_date ? esc(c.order_date) + 'هـ' : '(      )'}، تم سماع أقوال ${roleWord(p.party_role)} الموضحة بياناته أدناه:</div>
    <table class="pdata">
      <tr><th>الاســم</th><td colspan="3"><b>${esc(p.name)}</b></td><th>الجنسية</th><td>${esc(p.nationality || '—')}</td></tr>
      <tr><th>رقم الهوية</th><td>${esc(p.national_id || '—')}</td><th>الجنس</th><td>${esc(p.gender || '—')}</td><th>تاريخ الميلاد</th><td>${esc(p.birth_date || '—')}</td></tr>
      <tr><th>الحالة الاجتماعية</th><td>${esc(p.marital || '—')}</td><th>المؤهل العلمي</th><td>${esc(p.education || '—')}</td><th>المهنة / الرتبة</th><td>${esc(p.rank_job || '—')}</td></tr>
      <tr><th>جهة العمل</th><td colspan="3">${esc(p.unit || '—')}</td><th>رقم الجوال</th><td>${esc(p.phone || '—')}</td></tr>
      <tr><th>العنوان</th><td colspan="5">${esc(p.address || '—')}</td></tr>
    </table>
    <div class="qa">${qaHTML(st.text, st.answer_sigs)}</div>
    <div class="sigrow">
      <div class="sigbox"><div class="role">المستمع لأقواله</div><div>الاسم / ${esc(p.name)}</div><div>التوقيع /</div>
        ${st.signature_path ? `<img class="sigimg" data-file="${esc(st.signature_path)}" alt="">` : ''}</div>
      <div class="sigbox"><div class="role">سمع الأقوال ودوّنها</div>
        <div>${esc(st.taker_rank)}${st.taker_rank ? ' / ' : ''}${esc(st.taker_name)}</div><div>التوقيع /</div>
        ${st.taker_sig_path ? `<img class="sigimg" data-file="${esc(st.taker_sig_path)}" alt="">` : ''}</div>
    </div></div>`;
  const pv = printShell(html, ['#/case/' + c.id + '/statement/' + st.id, 'تعديل المحضر'], '@page { size: A4 portrait; margin: 8mm; }', 'مقاس A4');
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
// ---- خطاب التغطية ----
function partyLabel(p) {
  const f = p.gender === 'أنثى';
  const citizen = !p.nationality || /سعودي/.test(p.nationality);
  return (citizen ? (f ? 'المواطنة' : 'المواطن') : (f ? 'المقيمة' : 'المقيم')) + '/ ' + p.name;
}
function buildCoverText(c) {
  const ps = DB.parties.filter(p => p.case_id === c.id);
  const cl = ps.filter(p => p.party_role === 'مدعي'), df = ps.filter(p => p.party_role === 'مدعى عليه');
  const claim = cl.length ? cl.map(partyLabel).join(' و') : '(      )';
  const against = df.length
    ? (df.length > 1 ? 'رجال الأمن/ ' : 'رجل الأمن/ ') + df.map(p => (p.rank_job ? p.rank_job + ' ' : '') + p.name).join(' و')
    : 'أحد منسوبي شرطة المنطقة';
  const num = c.order_number || '      ', date = c.order_date ? c.order_date + 'هـ' : '(      )';
  return 'السلام عليكم ورحمة الله وبركاته،\n\n' +
    `إشارة إلى خطابكم رقم (${num}) وتاريخ ${date} بشأن دعوى ${claim} على ${against}، ` +
    'وطلبكم استكمال الإجراءات اللازمة، عليه نفيدكم أنه جرى إكمال اللازم وعمل تقرير تقييم القضية المرفق.\n\n' +
    'نأمل الاطلاع والإحاطة وإكمال اللازم من قبلكم.';
}
async function copyText(t, msg) {
  try { await navigator.clipboard.writeText(t); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast(msg);
}

// ========================= الخطابات =========================
const LETTER_TYPES = {
  unit: { label: 'خطاب لجهة المدعى عليه', sender: 'assist' },
  cover: { label: 'خطاب تغطية لوكيل الإمارة', sender: 'director' },
  blank: { label: 'خطاب فارغ', sender: 'assist' },
};
const LETTER_REQS = { appear: 'إبلاغه بالمراجعة', inform: 'إفادتنا عن', custom: 'نص آخر' };
function senders() {
  const s = S();
  return {
    assist: { title: s.sender_assist_title, rank: s.sender_assist_rank, name: s.sender_assist_name },
    director: { title: s.def_director_title, rank: s.def_director_rank, name: s.def_director_name },
  };
}
const caseDefendants = c => DB.parties.filter(p => p.case_id === c.id && p.party_role === 'مدعى عليه');
function buildUnitText(c, p, req, detail) {
  const cl = DB.parties.filter(x => x.case_id === c.id && x.party_role === 'مدعي');
  const claim = cl.length ? cl.map(partyLabel).join(' و') : '(      )';
  const who = p ? (p.rank_job ? `${p.rank_job.replace(/\s*\/\s*$/, '')}/ ${p.name}` : p.name) : '(      )';
  const d = (detail || '').trim();
  const ask = req === 'inform' ? `إفادتنا عن ${d || '(      )'}` : req === 'custom' ? (d || '(      )') : `إبلاغه بالمراجعة${d ? ' ' + d : ''}`;
  return 'السلام عليكم ورحمة الله وبركاته،\n\n' +
    `إشارة إلى خطاب ${c.order_source || 'سعادة وكيل إمارة منطقة المدينة المنورة'} رقم (${c.order_number || '      '}) ` +
    `وتاريخ ${c.order_date ? c.order_date + 'هـ' : '(      )'}، بشأن دعوى ${claim} على أحد منسوبيكم ${who}، ` +
    `وذلك بسبب ${c.subject || '(      )'}.\n\n` +
    `عليه نود منكم ${ask}.`;
}
function letterDefaults(c, type, partyId) {
  const p = byId('parties', partyId) || caseDefendants(c)[0] || null;
  const l = { type, party_id: p ? p.id : null, req: 'appear', req_detail: '', letter_number: '', letter_date: hijriToday(),
    attachments: '', sender: LETTER_TYPES[type].sender };
  if (type === 'cover') { l.to = S().cover_to; l.body = buildCoverText(c); }
  else if (type === 'unit') { [l.to_title, l.to_entity] = headOf(p); l.to = joinHead(l.to_title, l.to_entity); l.body = buildUnitText(c, p, l.req, ''); }
  else { l.to = ''; l.body = 'السلام عليكم ورحمة الله وبركاته،\n\n'; }
  return l;
}
function letterBody(c, l) {
  return l.type === 'cover' ? buildCoverText(c) : l.type === 'unit' ? buildUnitText(c, byId('parties', l.party_id), l.req, l.req_detail) : 'السلام عليكم ورحمة الله وبركاته،\n\n';
}

function viewLetterForm(c, lt, newType, partyId) {
  if (!lt && !LETTER_TYPES[newType]) { location.hash = '#/case/' + c.id; return; }
  const v = lt || letterDefaults(c, newType, partyId);
  const type = v.type, defs = caseDefendants(c), snd = senders();
  shell(`
    <div class="page-head"><h1>${esc(LETTER_TYPES[type].label)} <span>— قضية رقم ${esc(c.case_number || c.id)}</span></h1>
      <div class="acts"><a class="btn ghost" href="#/case/${c.id}">العودة للقضية</a></div></div>
    <form id="f">
    <div class="card"><h2>بيانات الخطاب</h2>
      ${type === 'unit' ? `<div class="grid g3" style="margin-bottom:14px">
        <div class="field"><label>المدعى عليه</label><select name="party_id">${defs.length
          ? defs.map(p => `<option value="${p.id}" ${p.id === +v.party_id ? 'selected' : ''}>${esc((p.rank_job ? p.rank_job + ' / ' : '') + p.name)}</option>`).join('')
          : '<option value="">— لا يوجد مدعى عليه في القضية —</option>'}</select></div>
        <div class="field"><label>نوع الطلب</label><select name="req">${Object.entries(LETTER_REQS).map(([k, t]) => `<option value="${k}" ${k === v.req ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label id="detailLbl">تفاصيل الطلب</label><input type="text" name="req_detail" value="${esc(v.req_detail)}"></div>
      </div>` : ''}
      ${type === 'unit' ? `<div class="grid g2">
        <div class="field"><label>المنصب</label><input type="text" name="to_title" list="posList" value="${esc(v.to_title != null ? v.to_title : splitHead(v.to)[0])}" placeholder="قائد / مدير / رئيس ..."></div>
        <div class="field"><label>الجهة</label><input type="text" name="to_entity" value="${esc(v.to_entity != null ? v.to_entity : splitHead(v.to)[1])}" placeholder="مثال: مركز شرطة الخالدية"></div>
        <datalist id="posList">${POSITIONS.map(x => `<option value="${x}">`).join('')}</datalist>
        <div class="hint span-all" id="toPrev"></div></div>`
      : `<div class="field"><label>الموجّه إليه</label><input type="text" name="to" value="${esc(v.to)}"></div>`}
      <div class="grid g3" style="margin-top:14px">
        <div class="field"><label>الرقم</label><input type="text" name="letter_number" value="${esc(v.letter_number)}"></div>
        ${dateField('letter_date', 'التاريخ (هـ)', v.letter_date)}
        <div class="field"><label>المشفوعات</label><input type="text" name="attachments" value="${esc(v.attachments)}"></div>
      </div>
    </div>
    <div class="card"><h2>المتن <button type="button" class="btn sm ghost count" id="regen">إعادة التوليد</button></h2>
      <textarea name="body" id="body" class="amiri" style="min-height:220px">${esc(v.body)}</textarea>
      <div class="hint">يُولَّد من بيانات القضية والأطراف ويتحدّث مع اختياراتك أعلاه ما لم تعدّله يدويًا. «نسخ المتن» ينسخ هذا النص فقط.</div>
    </div>
    <div class="card"><h2>المرسل</h2>
      <div class="sigmodes">${Object.entries(snd).map(([k, x]) => `<label class="sigmode"><input type="radio" name="sender" value="${k}" ${k === v.sender ? 'checked' : ''}>
        <span><b>${esc(x.title)}</b><br><span class="muted">${esc(x.rank)}/ ${esc(x.name || '(      ) — يُضبط الاسم من الإعدادات')}</span></span></label>`).join('')}</div>
    </div>
    <div class="formbar"><button class="btn gold" type="submit">حفظ</button>
      <button class="btn" type="button" id="copyBody">نسخ المتن</button>
      <button class="btn ghost" type="submit" data-print="1">حفظ ثم طباعة</button></div>
    </form>`);
  const f = $('#f'), body = $('#body');
  bindToday(f);
  let autoBody = letterBody(c, Object.assign({}, v)) === v.body ? v.body : null;
  let autoTo = type === 'unit' ? joinHead(v.to_title != null ? v.to_title : splitHead(v.to)[0], v.to_entity != null ? v.to_entity : splitHead(v.to)[1]) : v.to;
  const cur = () => { const o = Object.assign({}, v, formObj(f), { party_id: f.party_id ? +f.party_id.value : null });
    if (type === 'unit') o.to = joinHead(o.to_title, o.to_entity);
    return o; };
  const refresh = () => {
    const l = cur();
    if (f.req) {
      $('#detailLbl').textContent = l.req === 'inform' ? 'إفادتنا عن' : l.req === 'custom' ? 'نص الطلب' : 'تفاصيل المراجعة (اختياري)';
      f.req_detail.placeholder = l.req === 'appear' ? 'مثال: لدى شؤون الأمن بشرطة المنطقة' : '';
    }
    if (type !== 'blank' && autoBody !== null && body.value === autoBody) { autoBody = letterBody(c, l); setVal(body, autoBody); }
  };
  if (f.party_id) f.party_id.onchange = () => {
    const p = byId('parties', f.party_id.value);
    if (joinHead(f.to_title.value, f.to_entity.value) === autoTo) {
      [f.to_title.value, f.to_entity.value] = headOf(p); autoTo = joinHead(f.to_title.value, f.to_entity.value);
    }
    refresh();
  };
  if (f.req) { f.req.onchange = refresh; f.req_detail.oninput = refresh; }
  const toPrev = () => { const t = cur().to, el = $('#toPrev');
    el.textContent = t ? `سيُكتب في الخطاب: سعادة ${t} المحترم` : '⚠ لم يُحدَّد المخاطَب — اكتب المنصب والجهة (مثال: مدير / مركز شرطة الخالدية)، أو أضف «جهة العمل» في بيانات المدعى عليه';
    el.style.color = t ? '' : 'var(--red)'; };
  if (f.to_title) { f.to_title.oninput = toPrev; f.to_entity.oninput = toPrev; const op = f.party_id.onchange; f.party_id.onchange = () => { op(); toPrev(); }; toPrev(); }
  refresh();
  $('#regen').onclick = () => {
    if (body.value.trim() && body.value !== autoBody && !confirm('استبدال المتن الحالي بالصيغة المولّدة؟')) return;
    autoBody = letterBody(c, cur()); setVal(body, autoBody);
  };
  $('#copyBody').onclick = () => copyText(body.value.trim(), 'تم نسخ المتن');
  let wantPrint = false;
  $('[data-print]', f).onclick = () => { wantPrint = true; };
  f.onsubmit = async e => {
    e.preventDefault();
    const o = cur();
    o.body = body.value;
    let rec = lt;
    if (!rec) { rec = { id: nextId('letters'), case_id: c.id, created_at: nowStr() }; DB.letters.push(rec); }
    Object.assign(rec, o, { updated_at: nowStr() });
    log(lt ? 'تعديل خطاب' : 'إنشاء خطاب', LETTER_TYPES[type].label + ' — قضية #' + c.id);
    await save(); toast('تم حفظ الخطاب');
    location.hash = wantPrint ? `#/case/${c.id}/letter/${rec.id}/print` : `#/case/${c.id}`;
  };
}

function viewLetterPrint(c, l) {
  const x = senders()[l.sender] || senders().assist;
  const to = (l.to || '').trim();
  const toLine = !to ? 'سعادة / ...................................................' : /^(سعادة|معالي|صاحب|فضيلة)/.test(to) ? to : 'سعادة ' + to;
  const html = `<div class="sheet one" id="sheet"><div class="inner">
    ${printHead([['الرقــم :', esc(l.letter_number)], ['التاريخ :', esc(l.letter_date) + (l.letter_date ? 'هـ' : '')], ['المشفوعات :', esc(l.attachments)]])}
    <div class="lt-to"><span>${esc(toLine)}</span><span>المحترم</span></div>
    <div class="lt-body">${esc((l.body || '').trim())}</div>
    <div class="lt-sig"><div class="t">${esc(x.title)}</div>${rankName(x.rank, x.name)}</div>
  </div></div>`;
  const pv = printShell(html, ['#/case/' + c.id + '/letter/' + l.id, 'تعديل الخطاب'], '@page { size: A4 portrait; margin: 0; }');
  pv.ready.then(() => {
    const res = fitOnePage($('#sheet'), 16, 10);
    $('#pvInfo').textContent = res.fits ? 'صفحة A4 واحدة' : 'تنبيه: النص طويل ولا يتسع لصفحة واحدة';
    pv.scaler();
  });
}

// ========================= محاضر الإجراءات (اتصال / مشاهدة / مفتوح) =========================
const RECORD_TYPES = {
  call: { label: 'محضر اتصال' },
  view: { label: 'محضر مشاهدة' },
  open: { label: 'محضر مفتوح' },
};
const CALL_TRIES = ['عدة مرات وفي أوقات مختلفة', 'عدة مرات', 'مرتين في وقتين مختلفين', 'مرة واحدة'];
const CALL_RESULTS = { noanswer: 'ولم يرد على الاتصال', off: 'وكان الجوال مغلقًا', out: 'وكان الرقم خارج الخدمة',
  waive: 'رد وأفاد بتنازله وعدم رغبته بالحضور' };
/** سطر محضر الاتصال في «الإجراءات» بتقرير تقييم القضية */
function callProcLine(r, p) {
  const f = p.gender === 'أنثى', who = `${roleWord(p.party_role)} / ${p.name}`;
  if (r.result === 'waive') return `إعداد محضر اتصال على ${who}، ${f ? 'وأفادت بعدم رغبتها' : 'وأفاد بعدم رغبته'} بالمراجعة و${f ? 'تنازلها' : 'تنازله'} عن مواصلة الدعوى وعدم ${f ? 'رغبتها' : 'رغبته'} بالحضور.`;
  const why = { off: `لإغلاق ${f ? 'جوالها' : 'جواله'}`, out: `لكون ${f ? 'رقمها' : 'رقمه'} خارج الخدمة` }[r.result] || `لعدم ${f ? 'ردها' : 'رده'} على الاتصال`;
  return `إعداد محضر اتصال على ${who} ${why}.`;
}
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const recordTitle = r => (r.type === 'open' ? (r.title || '').trim() : '') || RECORD_TYPES[r.type].label;
/** على من الشكوى: الاسم إن وُجد، وإلا «أحد منسوبي» الجهة، وإلا شرطة المنطقة */
function againstText(c) {
  const df = caseDefendants(c);
  if (!df.length) return 'أحد منسوبي شرطة المنطقة';
  return df.map(p => {
    const f = p.gender === 'أنثى', unit = (p.unit || '').trim();
    const who = (f ? 'إحدى منسوبات ' : 'أحد منسوبي ') + (unit || 'شرطة المنطقة');
    if (!(p.name || '').trim()) return who;
    return `${who} ${p.rank_job ? p.rank_job.replace(/\s*\/\s*$/, '') + '/ ' : ''}${p.name}`;
  }).join(' و');
}
function recordIntro(c) {
  const cl = DB.parties.filter(x => x.case_id === c.id && x.party_role === 'مدعي');
  let t = `بناءً على خطاب ${c.order_source || '(      )'} رقم (${c.order_number || '      '}) وتاريخ ${c.order_date ? c.order_date + 'هـ' : '(      )'}`;
  t += cl.length ? `، بشأن شكوى ${cl.map(partyLabel).join(' و')} على ${againstText(c)}` : `، بشأن الشكوى على ${againstText(c)}`;
  if (c.subject) t += `، والمتضمنة ${c.subject.trim().replace(/[.،]$/, '')}`;
  return t + '.';
}
function recordBody(c, r) {
  const p = byId('parties', r.party_id);
  const by = [r.taker_rank, r.taker_name].map(x => (x || '').trim()).filter(Boolean).join('/ ') || '(      )';
  const when = `في يوم ${r.day || '(      )'} بتاريخ ${r.record_date ? r.record_date + 'هـ' : '(      )'}، وبمعرفتي أنا ${by}`;
  let mid;
  if (r.type === 'call') {
    const f = p && p.gender === 'أنثى';
    const who = p ? partyLabel(p) + (p.national_id ? `، ${f ? 'هويتها' : 'هويته'} رقم (${p.national_id})` : '') : '(      )';
    const phone = `على ${f ? 'جوالها' : 'جواله'} رقم (${(p && p.phone) || '      '})`;
    if (r.result === 'waive') {
      mid = `${when}، جرى الاتصال على ${who}، ${phone}، لطلب ${f ? 'حضورها' : 'حضوره'} للمراجعة، ` +
        (f ? 'فردّت على الاتصال وأفادت بأنها لا ترغب بالمراجعة، وأنها متنازلة عن مواصلة الدعوى ولا ترغب بالحضور.'
           : 'فردّ على الاتصال وأفاد بأنه لا يرغب بالمراجعة، وأنه متنازل عن مواصلة الدعوى ولا يرغب بالحضور.');
    } else {
      const res = (CALL_RESULTS[r.result] || CALL_RESULTS.noanswer).replace('يرد', f ? 'ترد' : 'يرد');
      mid = `${when}، جرى الاتصال على ${who}، ${phone} ${r.tries || CALL_TRIES[0]}، ${res}، وذلك لطلب ${f ? 'حضورها' : 'حضوره'} للمراجعة.`;
    }
  } else if (r.type === 'view') {
    mid = `${when}، جرى الانتقال إلى ${(r.place || '').trim() || '(      )'}، وبالمشاهدة تبيّن ما يلي:\n(      )`;
  } else {
    mid = `${when}، (      )`;
  }
  return `${recordIntro(c)}\n\n${mid}\n\nوحفظًا للواقع جرى إعداد هذا المحضر.`;
}
function recordDefaults(c, type, partyId) {
  const ps = DB.parties.filter(p => p.case_id === c.id);
  const p = byId('parties', partyId) || ps.find(x => x.party_role === 'مدعي') || ps[0] || null;
  const r = { type, title: '', party_id: p ? p.id : null, record_date: hijriToday(), day: WEEKDAYS[new Date().getDay()],
    tries: CALL_TRIES[0], result: 'noanswer', place: '',
    taker_rank: S().def_taker_rank, taker_name: S().def_taker_name || c.assigned_name || '' };
  r.body = recordBody(c, r);
  return r;
}

function viewRecordForm(c, rd, newType, partyId) {
  if (!rd && !RECORD_TYPES[newType]) { location.hash = '#/case/' + c.id; return; }
  const v = rd || recordDefaults(c, newType, partyId);
  const type = v.type, ps = DB.parties.filter(p => p.case_id === c.id);
  shell(`
    <div class="page-head"><h1>${esc(RECORD_TYPES[type].label)} <span>— قضية رقم ${esc(c.case_number || c.id)}</span></h1>
      <div class="acts"><a class="btn ghost" href="#/case/${c.id}">العودة للقضية</a></div></div>
    <form id="f">
    <div class="card"><h2>بيانات المحضر</h2>
      <div class="grid g3">
        ${type === 'open' ? `<div class="field"><label>عنوان المحضر</label><input type="text" name="title" value="${esc(v.title)}" placeholder="مثال: محضر انتقال / محضر تسليم / محضر ضبط"></div>` : ''}
        ${type !== 'view' ? `<div class="field"><label>${type === 'call' ? 'الطرف الذي جرى الاتصال عليه' : 'الطرف (اختياري)'}</label><select name="party_id">
          ${type === 'open' ? '<option value="">—</option>' : ''}
          ${ps.length || type === 'open' ? ps.map(p => `<option value="${p.id}" ${p.id === +v.party_id ? 'selected' : ''}>${esc(p.party_role)} / ${esc(p.name)}${p.phone ? ' — ' + esc(p.phone) : ''}</option>`).join('')
            : '<option value="">— أضف الطرف في القضية أولًا —</option>'}</select></div>` : ''}
        ${type === 'view' ? `<div class="field"><label>مكان المشاهدة</label><input type="text" name="place" value="${esc(v.place)}" placeholder="مثال: موقع الواقعة بحي ... / مقر مركز شرطة ..."></div>` : ''}
        <div class="field"><label>اليوم</label><select name="day">${opts(WEEKDAYS, v.day)}</select></div>
        ${dateField('record_date', 'التاريخ (هـ)', v.record_date)}
        ${type === 'call' ? `<div class="field" id="triesF"><label>عدد مرات الاتصال</label><select name="tries">${opts(CALL_TRIES, v.tries)}</select></div>
        <div class="field"><label>النتيجة</label><select name="result">${Object.entries(CALL_RESULTS).map(([k, t]) => `<option value="${k}" ${k === v.result ? 'selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}
      </div>
      ${type === 'call' ? '<div class="hint" id="phoneHint"></div>' : ''}
    </div>
    <div class="card"><h2>نص المحضر <button type="button" class="btn sm ghost count" id="regen">إعادة التوليد</button></h2>
      <textarea name="body" id="body" class="amiri" style="min-height:260px">${esc(v.body)}</textarea>
      <div class="hint">يبدأ بمقدمة من بيانات القضية (الخطاب الوارد والشكوى وعلى من)، ويتحدّث مع اختياراتك أعلاه ما لم تعدّله يدويًا. ضع ما تريد مكان (      ).</div>
    </div>
    <div class="card"><h2>معد المحضر</h2>
      <div class="grid g2">
        <div class="field"><label>الرتبة</label><input type="text" name="taker_rank" value="${esc(v.taker_rank)}" placeholder="عقيد"></div>
        <div class="field"><label>الاسم</label><input type="text" name="taker_name" value="${esc(v.taker_name)}"></div>
      </div>
      <div class="hint">القيمة الافتراضية من الإعدادات (رتبة واسم المحقق).</div>
    </div>
    <div class="formbar"><button class="btn gold" type="submit">حفظ</button>
      <button class="btn ghost" type="submit" data-print="1">حفظ ثم طباعة</button></div>
    </form>`);
  const f = $('#f'), body = $('#body');
  bindToday(f);
  let autoBody = recordBody(c, Object.assign({}, v)) === v.body ? v.body : null;
  const cur = () => Object.assign({}, v, formObj(f), { party_id: f.party_id && f.party_id.value ? +f.party_id.value : null });
  const refresh = () => {
    const r = cur();
    if (autoBody !== null && body.value === autoBody) { autoBody = recordBody(c, r); setVal(body, autoBody); }
    const tf = $('#triesF'); if (tf) tf.style.display = r.result === 'waive' ? 'none' : '';
    const ph = $('#phoneHint');
    if (ph) { const p = byId('parties', r.party_id);
      ph.textContent = p && p.phone ? '' : '⚠ لا يوجد رقم جوال لهذا الطرف — أضفه من «تعديل» في أطراف القضية، أو اكتبه في النص';
      ph.style.color = 'var(--red)'; }
  };
  $$('select, input', f).forEach(el => { el.addEventListener('change', refresh); el.addEventListener('input', refresh); });
  $$('textarea.line', f).forEach(el => el.addEventListener('input', refresh));
  refresh();
  $('#regen').onclick = () => {
    if (body.value.trim() && body.value !== autoBody && !confirm('استبدال النص الحالي بالصيغة المولّدة؟')) return;
    autoBody = recordBody(c, cur()); setVal(body, autoBody);
  };
  let wantPrint = false;
  $('[data-print]', f).onclick = () => { wantPrint = true; };
  f.onsubmit = async e => {
    e.preventDefault();
    const o = cur();
    o.body = body.value;
    let rec = rd;
    if (!rec) { rec = { id: nextId('records'), case_id: c.id, created_at: nowStr() }; DB.records.push(rec); }
    Object.assign(rec, o, { updated_at: nowStr() });
    const inRep = syncReportProc(c, rec);
    log(rd ? 'تعديل محضر' : 'إنشاء محضر', recordTitle(rec) + ' — قضية #' + c.id);
    await save(); toast(inRep ? 'تم حفظ المحضر وإدراجه في إجراءات التقرير' : 'تم حفظ المحضر');
    location.hash = wantPrint ? `#/case/${c.id}/record/${rec.id}/print` : `#/case/${c.id}`;
  };
}

function viewRecordPrint(c, r) {
  const html = `<div class="sheet one" id="sheet"><div class="inner">
    ${printHead([['القضية رقم :', esc(c.case_number || '')], ['التاريخ :', esc(r.record_date) + (r.record_date ? 'هـ' : '')], ['الموضوع :', esc(recordTitle(r))]])}
    <div class="ptitle"><span>( ${esc(recordTitle(r))} )</span></div>
    <div class="lt-body">${esc((r.body || '').trim())}</div>
    <div class="lt-sig"><div class="t">معد المحضر</div>${rankName(r.taker_rank, r.taker_name)}<div style="margin-top:.6em">التوقيع / ...................</div></div>
  </div></div>`;
  const pv = printShell(html, ['#/case/' + c.id + '/record/' + r.id, 'تعديل المحضر'], '@page { size: A4 portrait; margin: 0; }');
  pv.ready.then(() => {
    const res = fitOnePage($('#sheet'), 16, 10);
    $('#pvInfo').textContent = res.fits ? 'صفحة A4 واحدة' : 'تنبيه: النص طويل ولا يتسع لصفحة واحدة';
    pv.scaler();
  });
}

// ---- صيغ النتيجة والمرئيات ----
function fillTemplate(c, t) {
  const ps = DB.parties.filter(p => p.case_id === c.id);
  const cl = ps.filter(p => p.party_role === 'مدعي').map(partyLabel).join(' و') || '(      )';
  const df = ps.filter(p => p.party_role === 'مدعى عليه')
    .map(p => (p.rank_job ? p.rank_job.replace(/\s*\/\s*$/, '') + '/ ' : '') + p.name).join(' و') || '(      )';
  return (t || '').split('{المدعي}').join(cl).split('{المدعى عليه}').join(df);
}

function buildProcedures(c) {
  const lines = DB.statements.filter(s => s.case_id === c.id)
    .map(s => { const p = byId('parties', s.party_id) || {}; return `سماع أقوال ${roleWord(p.party_role)} / ${p.name || ''}.`; });
  DB.records.filter(r => r.case_id === c.id).forEach(r => {
    const p = byId('parties', r.party_id);
    lines.push(recordProcLine(r));
  });
  return lines.map((t, i) => `${i + 1}. ${t}`).join('\n');
}
function recordProcLine(r) {
  const p = byId('parties', r.party_id);
  return r.type === 'call' && p ? callProcLine(r, p) : `إعداد ${recordTitle(r)}${p ? ` بشأن ${roleWord(p.party_role)} / ${p.name}` : ''}.`;
}
/** إن كان التقرير مُعدًّا: يُدرج سطر المحضر في «الإجراءات» (ويُستبدل سطره السابق إن تغيّر) */
function syncReportProc(c, rec) {
  const rep = DB.reports.find(x => x.case_id === c.id);
  const line = recordProcLine(rec), old = rec.proc_line;
  rec.proc_line = line;
  if (!rep) return false;
  const txt = rep.procedures_text || '';
  if (old && old !== line && txt.includes(old)) { rep.procedures_text = txt.split(old).join(line); return true; }
  if (txt.includes(line)) return false;
  const n = txt.split('\n').filter(l => /^\s*\d+\s*[.\-)]/.test(l)).length;
  rep.procedures_text = (txt.trim() ? txt.replace(/\s+$/, '') + '\n' : '') + `${n + 1}. ${line}`;
  return true;
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
    <div class="card"><h2>صيغة جاهزة للنتيجة والمرئيات</h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap">${(S().report_templates || []).map((t, i) =>
        `<button type="button" class="btn ghost" data-tpl="${i}">${esc(t.name)}</button>`).join('') || '<span class="muted">لا توجد صيغ — أضفها من الإعدادات</span>'}</div>
      <div class="hint">تملأ «النتيجة» و«المرئيات» بأسماء أطراف هذه القضية، ثم تعدّلها كما تشاء. الصيغ تُعدَّل من «الإعدادات».</div></div>
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
  $$('[data-tpl]').forEach(b => b.onclick = () => {
    const t = S().report_templates[+b.dataset.tpl];
    if ((f.result_text.value.trim() || f.opinion_text.value.trim()) && !confirm(`استبدال النتيجة والمرئيات بصيغة «${t.name}»؟`)) return;
    setVal(f.result_text, fillTemplate(c, t.result)); setVal(f.opinion_text, fillTemplate(c, t.opinion));
    toast('تم إدراج الصيغة — راجعها قبل الحفظ');
  });
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
// ---- النسخ الاحتياطي: كامل، أو قضية واحدة، أو قضايا مختارة ----
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
async function filesToData(paths) {
  const files = {};
  for (const p of paths) { const b = await Store.backend.getFile(p); if (b) files[p] = await blobToDataURL(b); }
  return files;
}
async function exportBackup() {
  const files = await filesToData(await Store.backend.listFiles());
  const out = { app: 'cases-platform', kind: 'backup', exported_at: nowStr(), db: DB, files };
  download(new Blob([JSON.stringify(out)], { type: 'application/json' }), `نسخة-كاملة-القضايا-${today()}.json`);
  log('تصدير نسخة كاملة', `${DB.cases.length} قضية`); save();
}
/** نسخة تضم قضايا محددة فقط مع أطرافها ومحاضرها وتواقيعها ومرفقاتها وتقاريرها وخطاباتها */
async function exportCases(ids) {
  ids = new Set(ids.map(Number));
  const db = { cases: DB.cases.filter(c => ids.has(c.id)) };
  for (const t of CASE_CHILDREN) db[t] = DB[t].filter(r => ids.has(r.case_id));
  const paths = new Set();
  db.statements.forEach(st => statementFiles(st).forEach(fp => paths.add(fp)));
  db.attachments.forEach(a => paths.add(a.filename));
  const out = { app: 'cases-platform', kind: 'cases', exported_at: nowStr(), db, files: await filesToData([...paths]) };
  const one = db.cases.length === 1;
  download(new Blob([JSON.stringify(out)], { type: 'application/json' }),
    one ? `قضية-${safeName(String(db.cases[0].case_number || db.cases[0].id))}-${today()}.json` : `قضايا-مختارة-${db.cases.length}-${today()}.json`);
  log('تصدير قضايا', one ? 'قضية رقم ' + (db.cases[0].case_number || db.cases[0].id) : `${db.cases.length} قضية`); save();
  toast(one ? 'تم حفظ نسخة القضية' : `تم حفظ نسخة من ${db.cases.length} قضية`);
}
function exportPicker() {
  const rows = DB.cases.slice().sort((a, b) => b.id - a.id);
  const label = c => `${c.case_number || c.id} — ${(DB.parties.find(p => p.case_id === c.id) || {}).name || c.subject || ''}`.slice(0, 80);
  const m = modal(`<h2>تصدير قضايا محددة</h2>
    <input type="search" id="pkQ" placeholder="بحث برقم القضية أو الاسم..." style="margin-bottom:10px">
    <label class="sigmode"><input type="checkbox" id="pkAll"><span><b>تحديد الكل</b></span></label>
    <div id="pkList" style="max-height:50vh; overflow:auto; display:flex; flex-direction:column; gap:6px; margin-top:6px">
      ${rows.map(c => `<label class="sigmode" data-t="${esc(label(c))}"><input type="checkbox" value="${c.id}"><span>${esc(label(c))}</span></label>`).join('')}
    </div>
    <div style="display:flex; gap:10px; margin-top:14px">
      <button class="btn gold" id="pkGo" style="flex:1" disabled>تصدير (0)</button>
      <button class="btn ghost" id="pkX" style="flex:1">إلغاء</button></div>`);
  const boxes = () => $$('#pkList input', m), chosen = () => boxes().filter(b => b.checked).map(b => b.value);
  const upd = () => { const n = chosen().length; $('#pkGo', m).disabled = !n; $('#pkGo', m).textContent = `تصدير (${n})`; };
  boxes().forEach(b => b.onchange = upd);
  $('#pkAll', m).onchange = e => { boxes().forEach(b => { if (b.closest('label').style.display !== 'none') b.checked = e.target.checked; }); upd(); };
  $('#pkQ', m).oninput = e => $$('#pkList label', m).forEach(l => { l.style.display = l.dataset.t.includes(e.target.value.trim()) ? '' : 'none'; });
  $('#pkX', m).onclick = () => m.remove();
  $('#pkGo', m).onclick = async () => { const ids = chosen(); m.remove(); try { await exportCases(ids); } catch (e) { toast('تعذّر التصدير: ' + e.message, 'error'); } };
}

/** دمج قضايا من نسخة: القضية الموجودة (بنفس المعرّف الثابت) تُحدَّث، والجديدة تُضاف بأرقام داخلية جديدة */
function mergeCases(src) {
  const map = Object.fromEntries(TABLES.map(t => [t, {}]));
  let added = 0, updated = 0;
  for (const c of src.cases || []) {
    const ex = c.uid && DB.cases.find(x => x.uid === c.uid);
    if (ex) {
      const id = ex.id;
      for (const t of CASE_CHILDREN) DB[t] = DB[t].filter(r => r.case_id !== id);
      for (const k of Object.keys(ex)) delete ex[k];
      Object.assign(ex, c, { id });
      map.cases[c.id] = id; updated++;
    } else {
      const id = nextId('cases');
      DB.cases.push(Object.assign({}, c, { id, uid: c.uid || newUid() }));
      map.cases[c.id] = id; added++;
    }
  }
  const remap = (t, extra) => (src[t] || []).forEach(r => {
    const cid = map.cases[r.case_id];
    if (!cid) return;
    const n = Object.assign({}, r, { id: nextId(t), case_id: cid }, extra ? extra(r) : {});
    map[t][r.id] = n.id;
    DB[t].push(n);
  });
  remap('parties');
  remap('statements', r => ({ party_id: map.parties[r.party_id] || null }));
  remap('attachments'); remap('reports');
  remap('letters', r => ({ party_id: r.party_id ? (map.parties[r.party_id] || null) : null }));
  remap('requests', r => ({ party_id: map.parties[r.party_id] || null, statement_id: r.statement_id ? (map.statements[r.statement_id] || null) : null }));
  remap('records', r => ({ party_id: r.party_id ? (map.parties[r.party_id] || null) : null }));
  DB.seq.case_no = Math.max(DB.seq.case_no || 0, ...DB.cases.map(caseNoOf), 0);
  return { added, updated };
}
async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { return toast('الملف ليس نسخة احتياطية صالحة', 'error'); }
  if (data && data.app === 'cases-platform' && data.kind === 'response') return acceptResponse(data);
  if (!data || data.app !== 'cases-platform' || !data.db) return toast('الملف ليس نسخة احتياطية من هذه المنصة', 'error');
  const src = data.db, n = (src.cases || []).length;
  const same = (src.cases || []).filter(c => c.uid && DB.cases.some(x => x.uid === c.uid)).length;
  const full = data.kind !== 'cases';
  const m = modal(`<h2>استيراد نسخة</h2>
    <div style="line-height:1.9">${full ? 'نسخة كاملة' : 'نسخة قضايا'} بتاريخ ${esc(data.exported_at || '—')} — تضم <b>${n}</b> قضية.
      ${same ? `<br>منها <b>${same}</b> موجودة لديك وستُستبدل بنسختها في الملف.` : ''}</div>
    <div style="display:flex; flex-direction:column; gap:8px; margin-top:14px">
      <button class="btn gold" id="imMerge">إضافة القضايا إلى بياناتي الحالية${same ? ' وتحديث الموجود' : ''}</button>
      ${full ? `<button class="btn danger" id="imReplace">استبدال كل بياناتي بهذه النسخة (تُحذف ${DB.cases.length} قضية حالية)</button>` : ''}
      <button class="btn ghost" id="imX">إلغاء</button></div>`);
  $('#imX', m).onclick = () => m.remove();
  const putAll = async () => { for (const [p, u] of Object.entries(data.files || {})) await putFile(p, await dataURLToBlob(u)); urlCache.clear(); };
  $('#imMerge', m).onclick = async () => {
    m.remove(); toast('جارٍ الاستيراد...');
    await putAll();
    const r = mergeCases(src);
    log('استيراد قضايا', `إضافة ${r.added}، تحديث ${r.updated}`); await save();
    toast(`تم: إضافة ${r.added} قضية${r.updated ? `، وتحديث ${r.updated}` : ''}`); route();
  };
  const rp = $('#imReplace', m);
  if (rp) rp.onclick = async () => {
    if (!confirm('تأكيد: حذف كل البيانات الحالية واستبدالها بالنسخة؟')) return;
    m.remove(); toast('جارٍ الاستيراد...');
    await putAll();
    DB = shapeDB(src);
    log('استيراد نسخة كاملة (استبدال)', `${n} قضية`); await save();
    toast('تم استيراد النسخة الاحتياطية'); route();
  };
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
        <button class="btn" id="bkExport">نسخة كاملة (كل القضايا)</button>
        <button class="btn ghost" id="bkPick">نسخة لقضايا محددة</button>
        <label class="btn ghost" style="margin:0">استيراد نسخة<input type="file" id="bkImport" accept=".json,application/json,text/plain" hidden></label>
      </div>
      <div class="hint">النسخة ملف واحد يُحفظ في «التنزيلات» على جهازك، ويضم القضايا بأطرافها ومحاضرها وتواقيعها ومرفقاتها وتقاريرها وخطاباتها. «النسخة الكاملة» تضم الإعدادات أيضًا. عند الاستيراد تختار: إضافة القضايا إلى بياناتك (والقضية الموجودة تُحدَّث)، أو استبدال كل البيانات. ولحفظ قضية واحدة: افتح ملفها واضغط «حفظ نسخة من هذه القضية».</div>
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

    <div class="card"><h2>الخطابات</h2>
      <div class="field"><label>الموجّه إليه خطاب التغطية</label><input type="text" name="cover_to" value="${esc(s.cover_to)}"></div>
      <div class="grid g2" style="margin-top:14px">
        <div><div class="signer-head">المرسل الأول</div>
          <div class="field"><label>المسمى</label><input type="text" name="sender_assist_title" value="${esc(s.sender_assist_title)}"></div>
          <div class="field"><label>الرتبة</label><input type="text" name="sender_assist_rank" value="${esc(s.sender_assist_rank)}"></div>
          <div class="field"><label>الاسم</label><input type="text" name="sender_assist_name" value="${esc(s.sender_assist_name)}"></div></div>
        <div><div class="signer-head">المرسل الثاني</div>
          <div class="field"><label>المسمى</label><input type="text" name="def_director_title" value="${esc(s.def_director_title)}"></div>
          <div class="field"><label>الرتبة</label><input type="text" name="def_director_rank" value="${esc(s.def_director_rank)}"></div>
          <div class="field"><label>الاسم</label><input type="text" name="def_director_name" value="${esc(s.def_director_name)}"></div></div>
      </div>
      <div class="hint">يُختار المرسل في كل خطاب، ويظهر توقيعه أسفل الخطاب المطبوع.</div></div>

    <div class="card" id="tplCard"><h2>صيغ النتيجة والمرئيات في التقرير</h2>
      <div class="hint" style="margin-bottom:10px">اكتب {المدعي} و{المدعى عليه} في النص ليُستبدلا تلقائيًا بأسماء أطراف القضية.</div>
      <div id="tplList"></div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px">
        <button type="button" class="btn ghost" id="tplAdd">+ إضافة صيغة</button>
        <button type="button" class="btn gold" id="tplSave">حفظ الصيغ</button></div></div>

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
        : '<div class="empty">لا توجد حركات مسجلة</div>'}</div></div>
    <div class="hint" style="text-align:center; margin-bottom:24px">إصدار الواجهة: ${APP_VERSION}</div>`, 'settings');

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
  // ---- محرر الصيغ ----
  let tpls = JSON.parse(JSON.stringify(S().report_templates || []));
  const drawTpls = () => {
    $('#tplList').innerHTML = tpls.map((t, i) => `<div class="tplitem" data-i="${i}">
      <div class="inline"><input type="text" data-k="name" value="${esc(t.name)}" placeholder="اسم الصيغة">
        <button type="button" class="btn sm danger" data-tdel="${i}">حذف</button></div>
      <label style="margin-top:8px">النتيجة</label><textarea data-k="result" class="amiri" style="min-height:70px">${esc(t.result)}</textarea>
      <label style="margin-top:8px">المرئيات</label><textarea data-k="opinion" class="amiri" style="min-height:60px">${esc(t.opinion)}</textarea></div>`).join('')
      || '<div class="empty">لا توجد صيغ</div>';
    $$('#tplList [data-k]').forEach(el => el.oninput = () => { tpls[+el.closest('.tplitem').dataset.i][el.dataset.k] = el.value; });
    $$('[data-tdel]').forEach(b => b.onclick = () => { tpls.splice(+b.dataset.tdel, 1); drawTpls(); });
    $$('#tplList textarea').forEach(autoGrow);
  };
  drawTpls();
  $('#tplAdd').onclick = () => { tpls.push({ name: 'صيغة جديدة', result: '', opinion: '' }); drawTpls(); };
  $('#tplSave').onclick = async () => {
    S().report_templates = tpls.filter(t => (t.name || '').trim()).map(t => ({ name: t.name.trim(), result: t.result.trim(), opinion: t.opinion.trim() }));
    log('حفظ صيغ التقرير'); await save(); toast('تم حفظ الصيغ');
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
  $('#bkPick').onclick = () => DB.cases.length ? exportPicker() : toast('لا توجد قضايا', 'error');
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
