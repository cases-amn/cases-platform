/* طلب الإفادة عن بُعد: رابط يُرسل بالواتساب، يجيب فيه الطرف ويوقّع، ويعيد ملف الإفادة للمحقق.
   لا يوجد خادم: بيانات الطلب داخل الرابط نفسه (بعد علامة #، فلا تصل لأي خادم)،
   والقفل: مهلة زمنية + قفل على جهاز المجيب بعد الإرسال + رمز دخول اختياري + قبول أول إفادة فقط عند المحقق. */
'use strict';

const REMOTE_TYPES = { text: 'نص حر', choice: 'اختيار من متعدد', yesno: 'نعم / لا' };
const REMOTE_EXPIRY = [[6, '6 ساعات'], [24, 'يوم واحد'], [72, '3 أيام'], [168, 'أسبوع']];

// ---- ترميز بيانات الطلب داخل الرابط (مضغوطة) ----
function b64url(u8) { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function packPayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') {
    const st = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + b64url(new Uint8Array(await new Response(st).arrayBuffer()));
  }
  return 'j' + b64url(bytes);
}
async function unpackPayload(s) {
  let bytes = unb64url(s.slice(1));
  if (s[0] === 'z') {
    const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(st).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function hijriOf(ms) {
  try {
    const p = {};
    new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' })
      .formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
    return `${p.day} / ${p.month} / ${p.year}`;
  } catch (e) { return ''; }
}
function fmtWhen(ms) {
  const d = new Date(ms);
  return `${hijriOf(ms)}هـ الساعة ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
const remoteBase = () => location.origin + location.pathname;
async function remoteLink(req) {
  const c = byId('cases', req.case_id) || {}, p = byId('parties', req.party_id) || {};
  return remoteBase() + '#/r/' + await packPayload({
    v: 1, rid: req.rid, exp: req.expires_at, name: p.name || '', intro: req.intro || '',
    q: req.questions, ch: req.code ? await sha256(req.rid + req.code) : '',
    org: [S().org_line4, S().org_line5].filter(Boolean), no: c.case_number || '',
  });
}
function remoteStatus(r) {
  if (r.status === 'done') return ['تم الاستلام', 'st-منجزة'];
  if (r.status === 'cancelled') return ['موقوف', 'n'];
  if (Date.now() > r.expires_at) return ['انتهت المهلة', 'n'];
  return ['بانتظار الرد', 'st-جارية'];
}
function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('05') && d.length === 10) d = '966' + d.slice(1);
  else if (d.startsWith('5') && d.length === 9) d = '966' + d;
  return d.length >= 11 ? d : '';
}

// ========================= جهة المحقق: إنشاء الطلب =========================
function defaultRemoteQuestions(c, p) {
  const first = defaultQuestion(c, p).replace(/^س\s*\/\s*/, '').replace(/\nج\s*\/\s*$/, '').trim();
  return [{ q: first, t: 'text' }];
}
function defaultRemoteIntro(c) {
  return `بخصوص خطاب ${c.order_source || 'سعادة وكيل إمارة منطقة المدينة المنورة'} رقم (${c.order_number || '      '}) ` +
    `وتاريخ ${c.order_date ? c.order_date + 'هـ' : '(      )'}، نأمل الإجابة على الأسئلة التالية بدقة، ثم التوقيع والإرسال.`;
}

function viewRemoteRequestForm(c, partyId) {
  const parties = DB.parties.filter(p => p.case_id === c.id);
  if (!parties.length) { toast('أضف الطرف أولًا', 'error'); location.hash = '#/case/' + c.id; return; }
  const def = parties.find(p => p.party_role === 'مدعى عليه');
  let p = byId('parties', partyId) || def || parties[0];
  let qs = defaultRemoteQuestions(c, p);
  let autoFirst = qs[0].q;
  shell(`
    <div class="page-head"><h1>طلب <span>إفادة عن بُعد</span> — قضية رقم ${esc(c.case_number || c.id)}</h1>
      <div class="acts"><a class="btn ghost" href="#/case/${c.id}">العودة للقضية</a></div></div>
    <form id="f">
    <div class="card"><h2>المطلوب إفادته</h2>
      <div class="grid g2">
        <div class="field"><label>الطرف</label><select name="party_id" id="rqParty">${parties.map(x =>
          `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.party_role)} / ${esc(x.name)}</option>`).join('')}</select></div>
        <div class="field"><label>مدة صلاحية الرابط</label><select name="hours">${REMOTE_EXPIRY.map(([h, t]) =>
          `<option value="${h}" ${h === 24 ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      </div>
      <label class="sigmode" style="margin-top:12px"><input type="checkbox" name="use_code" value="1" checked>
        <span>طلب رمز دخول من 4 أرقام (يُرسل له في رسالة منفصلة أو بالاتصال) — يمنع فتح الرابط لو أُعيد توجيهه لغيره</span></label>
      <div class="field" style="margin-top:12px"><label>المقدمة</label>
        <textarea name="intro" class="amiri" style="min-height:70px">${esc(defaultRemoteIntro(c))}</textarea></div>
    </div>
    <div class="card"><h2>الأسئلة</h2>
      <div id="qList"></div>
      <button type="button" class="btn ghost" id="qAdd" style="margin-top:6px">+ إضافة سؤال</button>
    </div>
    <div class="note">البيانات الشخصية للطرف لا تُرسل في الرابط — يظهر له اسمه والمقدمة والأسئلة فقط.</div>
    <div class="formbar"><button class="btn gold" type="submit">إنشاء الرابط</button>
      <a class="btn ghost" href="#/case/${c.id}">إلغاء</a></div>
    </form>`);
  const f = $('#f');
  const draw = () => {
    $('#qList').innerHTML = qs.map((x, i) => `<div class="tplitem" data-i="${i}">
      <div class="inline" style="align-items:center"><b style="flex:none">س${i + 1}</b>
        <select data-k="t" style="flex:1">${Object.entries(REMOTE_TYPES).map(([k, t]) => `<option value="${k}" ${k === x.t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        ${qs.length > 1 ? `<button type="button" class="btn sm danger" data-qdel="${i}">حذف</button>` : ''}</div>
      <textarea data-k="q" class="amiri" style="min-height:60px; margin-top:8px" placeholder="نص السؤال">${esc(x.q)}</textarea>
      ${x.t === 'choice' ? `<label style="margin-top:8px">الاختيارات (كل اختيار في سطر)</label>
        <textarea data-k="o" style="min-height:70px">${esc((x.o || []).join('\n'))}</textarea>` : ''}</div>`).join('');
    $$('#qList [data-k]').forEach(el => {
      const i = +el.closest('.tplitem').dataset.i;
      el.oninput = el.onchange = () => {
        if (el.dataset.k === 'o') qs[i].o = el.value.split('\n').map(s => s.trim()).filter(Boolean);
        else qs[i][el.dataset.k] = el.value;
        if (el.dataset.k === 't') { if (el.value === 'choice' && !qs[i].o) qs[i].o = []; draw(); }
      };
    });
    $$('[data-qdel]').forEach(b => b.onclick = () => { qs.splice(+b.dataset.qdel, 1); draw(); });
    $$('#qList textarea').forEach(autoGrow);
  };
  draw();
  $('#qAdd').onclick = () => { qs.push({ q: '', t: 'text' }); draw(); };
  $('#rqParty').onchange = () => {
    p = byId('parties', $('#rqParty').value);
    if (qs[0] && qs[0].q === autoFirst) { autoFirst = defaultRemoteQuestions(c, p)[0].q; qs[0].q = autoFirst; draw(); }
  };
  f.onsubmit = async e => {
    e.preventDefault();
    const o = formObj(f);
    const clean = qs.map(x => ({ q: (x.q || '').trim(), t: x.t, o: x.t === 'choice' ? (x.o || []) : undefined })).filter(x => x.q);
    if (!clean.length) return toast('أضف سؤالًا واحدًا على الأقل', 'error');
    const bad = clean.find(x => x.t === 'choice' && x.o.length < 2);
    if (bad) return toast('سؤال الاختيار يحتاج اختيارين على الأقل', 'error');
    const req = { id: nextId('requests'), case_id: c.id, party_id: +o.party_id, rid: newUid(), intro: f.intro.value.trim(),
      questions: clean, code: o.use_code ? String(Math.floor(1000 + Math.random() * 9000)) : '',
      created_at: Date.now(), expires_at: Date.now() + (+o.hours) * 3600e3, status: 'pending' };
    DB.requests.push(req);
    log('إنشاء طلب إفادة عن بُعد', 'قضية #' + c.id);
    await save();
    location.hash = `#/case/${c.id}/remote/${req.id}`;
  };
}

async function viewRemoteRequest(c, req) {
  const p = byId('parties', req.party_id) || {};
  const [stTxt, stCls] = remoteStatus(req);
  const link = await remoteLink(req);
  const msg = `السلام عليكم ${p.name ? 'الأخ/ ' + p.name : ''}\nنأمل تعبئة طلب الإفادة الخاص بكم والتوقيع عليه ثم إرساله عبر الرابط التالي:\n${link}\n\nصلاحية الرابط حتى ${fmtWhen(req.expires_at)}، ويُستخدم مرة واحدة فقط.`;
  const wa = `https://wa.me/${waNumber(p.phone)}?text=${encodeURIComponent(msg)}`;
  const open = req.status === 'pending' && Date.now() <= req.expires_at;
  shell(`
    <div class="page-head"><h1>طلب <span>إفادة عن بُعد</span> — ${esc(p.name || '')}</h1>
      <div class="acts"><a class="btn ghost" href="#/case/${c.id}">العودة للقضية</a></div></div>
    <div class="card"><h2>حالة الطلب <span class="badge ${stCls} count">${stTxt}</span></h2>
      <div class="kv">
        <div><label>الطرف</label><div>${esc(p.party_role || '')} / ${esc(p.name || '—')}</div></div>
        <div><label>أُنشئ</label><div>${esc(fmtWhen(req.created_at))}</div></div>
        <div><label>ينتهي</label><div>${esc(fmtWhen(req.expires_at))}</div></div>
        <div><label>عدد الأسئلة</label><div>${req.questions.length}</div></div>
      </div>
      ${req.status === 'done' && req.statement_id ? `<div style="margin-top:14px"><a class="btn gold" href="#/case/${c.id}/statement/${req.statement_id}">فتح المحضر المستلم</a></div>` : ''}
      ${req.status === 'done' ? '<div class="hint" style="margin-top:10px">الرابط مقفل تلقائيًا بعد الاستلام، ولا تُقبل عنه إفادة ثانية.</div>' : ''}
      ${req.status === 'cancelled' ? `<div class="hint" style="margin-top:10px">أُوقف الرابط${req.cancelled_at ? ' في ' + esc(fmtWhen(req.cancelled_at)) : ''}، ولن تُقبل أي إفادة تصل عنه.</div>` : ''}
      ${req.status === 'pending' ? `<div style="margin-top:14px"><button class="btn danger" id="rqCancel">إيقاف الرابط الآن</button>
        <div class="hint">بعد الإيقاف تُرفض أي إفادة تصل عن هذا الرابط، ويظهر مقفلًا عند فتحه من جهازك.</div></div>` : ''}
    </div>
    ${open ? `<div class="card"><h2>الإرسال</h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <a class="btn gold" href="${esc(wa)}" target="_blank" rel="noopener">إرسال الرابط بالواتساب${waNumber(p.phone) ? '' : ' (اختر جهة الاتصال)'}</a>
        <button class="btn ghost" id="cpLink">نسخ الرابط</button></div>
      ${req.code ? `<div class="note" style="margin-top:12px">رمز الدخول: <b style="font-size:20px; letter-spacing:4px">${esc(req.code)}</b>
        — أرسله له في رسالة منفصلة أو أخبره به بالاتصال. <button class="btn sm ghost" id="cpCode">نسخ الرمز</button></div>` : ''}
    </div>` : ''}
    ${req.status === 'pending' ? `<div class="card"><h2>استلام الإفادة</h2>
      <div class="hint" style="margin-bottom:10px">بعد أن يرسل لك ملف الإفادة على الواتساب احفظه، ثم اختره هنا لإضافته محضرًا في القضية.</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <label class="btn" style="margin:0">اختيار ملف الإفادة<input type="file" id="rsFile" accept=".txt,.json,text/plain,application/json" hidden></label></div></div>` : ''}
    <div class="card"><h2>الأسئلة المرسلة</h2>
      ${req.questions.map((x, i) => `<div style="margin-bottom:10px"><b>س${i + 1} /</b> ${esc(x.q)}
        ${x.t === 'choice' ? `<div class="muted">اختيارات: ${x.o.map(esc).join('، ')}</div>` : x.t === 'yesno' ? '<div class="muted">نعم / لا</div>' : ''}</div>`).join('')}
    </div>`);
  const cl = $('#cpLink'); if (cl) cl.onclick = () => copyText(link, 'تم نسخ الرابط');
  const cc = $('#cpCode'); if (cc) cc.onclick = () => copyText(req.code, 'تم نسخ الرمز');
  const rf = $('#rsFile'); if (rf) rf.onchange = async e => { const fl = e.target.files[0]; if (fl) await importResponseFile(fl); };
  const rc = $('#rqCancel'); if (rc) rc.onclick = async () => {
    if (!confirm('إيقاف الرابط؟ لن تُقبل أي إفادة تصل عنه بعد الآن.')) return;
    Object.assign(req, { status: 'cancelled', cancelled_at: Date.now() });
    log('إيقاف رابط إفادة عن بُعد', 'قضية #' + c.id); await save(); toast('تم إيقاف الرابط'); route();
  };
}

// ========================= جهة المحقق: استلام الإفادة =========================
async function importResponseFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { return toast('الملف ليس ملف إفادة صالحًا', 'error'); }
  if (!data || data.app !== 'cases-platform' || data.kind !== 'response') return toast('الملف ليس ملف إفادة من هذه المنصة', 'error');
  return acceptResponse(data);
}
async function acceptResponse(data) {
  const req = DB.requests.find(r => r.rid === data.rid);
  if (!req) return toast('هذه الإفادة لا تخص أي طلب في بياناتك', 'error');
  if (req.status === 'done') return toast('سبق استلام إفادة لهذا الطلب — الرابط مقفل ولا تُقبل إفادة ثانية', 'error');
  if (req.status === 'cancelled') return toast('هذا الطلب ملغى — لا تُقبل الإفادة', 'error');
  if (!Array.isArray(data.answers) || data.answers.length !== req.questions.length) return toast('ملف الإفادة لا يطابق أسئلة الطلب', 'error');
  if (data.submitted_at > req.expires_at &&
      !confirm(`أُرسلت هذه الإفادة بعد انتهاء المهلة (${fmtWhen(data.submitted_at)}). قبولها رغم ذلك؟`)) return;
  const c = byId('cases', req.case_id);
  let sig = '';
  if (data.sig) { sig = `signatures/sig_${req.case_id}_remote_${Date.now()}.png`; await putFile(sig, await dataURLToBlob(data.sig)); }
  const st = { id: nextId('statements'), case_id: req.case_id, party_id: req.party_id,
    statement_date: hijriOf(data.submitted_at), location: 'إفادة إلكترونية عن بُعد',
    text: req.questions.map((x, i) => `س / ${x.q}\nج / ${data.answers[i] || ''}`).join('\n\n'),
    signature_path: sig, taker_rank: S().def_taker_rank, taker_name: S().def_taker_name || (c && c.assigned_name) || '',
    taker_sig_path: S().taker_sig || '', remote: true, remote_at: data.submitted_at, created_at: nowStr() };
  DB.statements.push(st);
  Object.assign(req, { status: 'done', statement_id: st.id, received_at: Date.now() });
  log('استلام إفادة عن بُعد', 'قضية #' + req.case_id);
  await save();
  toast('تم استلام الإفادة وإضافتها محضرًا في القضية');
  location.hash = `#/case/${req.case_id}/statement/${st.id}`;
}

// ========================= جهة المجيب: صفحة الرابط =========================
function remoteScreen(inner) {
  document.body.className = 'remote';
  app().innerHTML = `<header class="topbar"><div class="brand"><div>طلب إفادة<span class="tag" id="rOrg"></span></div></div></header>
    <main class="container" style="max-width:760px">${inner}</main>`;
}
function remoteMessage(title, body) {
  remoteScreen(`<div class="card" style="text-align:center; padding:34px 20px">
    <div style="font-size:42px">🔒</div><h2 style="justify-content:center; border:0">${title}</h2>
    <div style="line-height:1.9">${body}</div></div>`);
}

/** الطلب نفسه من بيانات هذا الجهاز إن كان جهاز المحقق (وإلا null) — قراءة فقط */
async function ownRequest(rid) {
  try {
    if (await Store.init() !== 'ready') return null;
    const d = await Store.backend.load();
    return (d && Array.isArray(d.requests) && d.requests.find(r => r.rid === rid)) || null;
  } catch (e) { return null; }
}

async function viewRemote() {
  let P;
  try { P = await unpackPayload(location.hash.slice(4)); if (!P || !P.rid || !Array.isArray(P.q)) throw 0; }
  catch (e) { return remoteMessage('الرابط غير صالح', 'تأكد من فتح الرابط كاملًا كما وصلك.'); }
  const doneKey = 'remote_done_' + P.rid, triesKey = 'remote_tries_' + P.rid;
  // على جهاز المحقق نفسه: الرابط يتبع حالة الطلب في بياناته (مستلم / موقوف / منتهٍ)
  const own = await ownRequest(P.rid);
  if (own && own.status === 'done') return remoteMessage('الرابط مقفل', `تم استلام الإفادة عن هذا الطلب${own.received_at ? ' في ' + esc(fmtWhen(own.received_at)) : ''}، ولا يقبل الرابط إفادة أخرى.`);
  if (own && own.status === 'cancelled') return remoteMessage('الرابط موقوف', `أوقفتَ هذا الرابط${own.cancelled_at ? ' في ' + esc(fmtWhen(own.cancelled_at)) : ''}، ولن تُقبل أي إفادة تصل عنه.`);
  const done = lsGet(doneKey, '');
  if (done) return remoteDone(P, done);
  if (Date.now() > P.exp) return remoteMessage('انتهت صلاحية الرابط', `انتهت مهلة هذا الطلب في ${esc(fmtWhen(P.exp))}.<br>تواصل مع المحقق لطلب رابط جديد.`);
  if (P.ch && sessionStorage.getItem('remote_ok_' + P.rid) !== '1') return remoteCode(P, triesKey);
  remoteForm(P, doneKey);
}

function remoteCode(P, triesKey) {
  const tries = +lsGet(triesKey, '0');
  if (tries >= 5) return remoteMessage('تم قفل الرابط', 'أُدخل رمز خاطئ عدة مرات. تواصل مع المحقق لطلب رابط جديد.');
  remoteScreen(`<div class="card"><h2>رمز الدخول</h2>
    <div style="line-height:1.9; margin-bottom:12px">${P.name ? `الأخ/ <b>${esc(P.name)}</b><br>` : ''}أدخل رمز الدخول المكوّن من 4 أرقام الذي أرسله لك المحقق.</div>
    <form id="cf"><input type="tel" name="code" inputmode="numeric" maxlength="4" autocomplete="one-time-code" style="font-size:24px; letter-spacing:8px; text-align:center" required>
      <button class="btn gold" type="submit" style="width:100%; margin-top:12px">دخول</button></form>
    <div class="hint">المحاولات المتبقية: ${5 - tries}</div></div>`);
  $('#cf').onsubmit = async e => {
    e.preventDefault();
    const code = formObj(e.target).code;
    if (await sha256(P.rid + code) === P.ch) { sessionStorage.setItem('remote_ok_' + P.rid, '1'); viewRemote(); }
    else { lsSet(triesKey, String(tries + 1)); toast('رمز غير صحيح', 'error'); remoteCode(P, triesKey); }
  };
}

function remoteForm(P, doneKey) {
  remoteScreen(`
    <div class="card">
      ${P.org && P.org.length ? `<div class="muted" style="margin-bottom:6px">${P.org.map(esc).join(' — ')}</div>` : ''}
      ${P.name ? `<div style="font-size:17px; margin-bottom:8px">الأخ/ <b>${esc(P.name)}</b></div>` : ''}
      <div style="line-height:1.9; white-space:pre-wrap">${esc(P.intro || '')}</div>
      <div class="hint" style="margin-top:8px">⏳ صلاحية الرابط حتى ${esc(fmtWhen(P.exp))}، ويُقفل بعد الإرسال مباشرة ولا يمكن التعديل بعدها.</div>
    </div>
    <form id="rf">
      ${P.q.map((x, i) => `<div class="card"><div style="font-weight:700; line-height:1.9; margin-bottom:10px">س${i + 1} / ${esc(x.q)}</div>
        ${x.t === 'choice' ? `<div class="sigmodes">${x.o.map(o => `<label class="sigmode"><input type="radio" name="a${i}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div>`
        : x.t === 'yesno' ? `<div class="sigmodes">${['نعم', 'لا'].map(o => `<label class="sigmode"><input type="radio" name="a${i}" value="${o}"><span>${o}</span></label>`).join('')}</div>`
        : `<textarea name="a${i}" class="amiri" style="min-height:100px" placeholder="اكتب إجابتك هنا"></textarea>`}</div>`).join('')}
      <div class="card"><h2>التوقيع</h2>${sigPadHTML('rSig')}</div>
      <label class="sigmode" style="margin-bottom:12px"><input type="checkbox" name="ack" value="1">
        <span>أقرّ بأن ما ورد أعلاه هو إفادتي وأنه صحيح، وأتحمل مسؤولية ذلك.</span></label>
      <button class="btn gold" type="submit" style="width:100%; margin-bottom:30px">إرسال الإفادة</button>
    </form>`);
  const org = $('#rOrg'); if (org && P.no) org.textContent = 'قضية رقم ' + P.no;
  const pad = mountSig($('#rSig'));
  const f = $('#rf');
  f.onsubmit = async e => {
    e.preventDefault();
    const o = formObj(f);
    const answers = P.q.map((x, i) => (o['a' + i] || '').trim());
    const miss = answers.findIndex(a => !a);
    if (miss >= 0) return toast(`أجب على السؤال ${miss + 1}`, 'error');
    if (pad.isEmpty()) return toast('وقّع داخل المربع أولًا', 'error');
    if (!o.ack) return toast('ضع علامة على الإقرار أولًا', 'error');
    if (!confirm('بعد الإرسال يُقفل الرابط ولا يمكن تعديل الإفادة. إرسال الآن؟')) return;
    const sig = await blobToDataURL(await pad.toBlob());
    const resp = JSON.stringify({ app: 'cases-platform', kind: 'response', rid: P.rid, name: P.name, submitted_at: Date.now(), answers, sig });
    try { localStorage.setItem(doneKey, resp); } catch (err) { lsSet(doneKey, JSON.stringify({ rid: P.rid, submitted_at: Date.now(), lost: true })); }
    remoteDone(P, resp, true);
  };
}

function remoteFile(P, resp) {
  return new File([resp], `إفادة-${safeName(P.name || 'طرف')}.txt`, { type: 'text/plain' });
}
async function sendResponse(P, resp) {
  const file = remoteFile(P, resp);
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'إفادة', text: 'ملف الإفادة' });
      return true;
    }
  } catch (e) { if (e.name === 'AbortError') return false; }
  download(file, file.name);
  toast('حُفظ ملف الإفادة في «التنزيلات» — أرسله للمحقق بالواتساب (مرفق ← مستند)');
  return true;
}
function remoteDone(P, resp, justNow) {
  let r = {}; try { r = JSON.parse(resp); } catch (e) {}
  remoteScreen(`<div class="card" style="text-align:center; padding:30px 18px">
    <div style="font-size:42px">✅</div>
    <h2 style="justify-content:center; border:0">${justNow ? 'تم تسجيل إفادتك' : 'سبق إرسال الإفادة من هذا الرابط'}</h2>
    <div style="line-height:1.9">الرابط مقفل ولا يمكن تعديل الإفادة.${r.submitted_at ? `<br>وقت الإرسال: ${esc(fmtWhen(r.submitted_at))}` : ''}</div>
    ${r.answers ? `<div style="line-height:1.9; margin-top:12px">الخطوة الأخيرة: اضغط الزر وأرسل ملف الإفادة <b>للمحقق في الواتساب</b>.</div>
      <button class="btn gold" id="rSend" style="width:100%; margin-top:14px">إرسال ملف الإفادة</button>
      <div class="hint">إذا لم تظهر قائمة المشاركة، يُحفظ الملف في «التنزيلات» فأرسله من الواتساب كمستند.</div>` : ''}
  </div>`);
  const b = $('#rSend'); if (b) b.onclick = () => sendResponse(P, resp);
}
