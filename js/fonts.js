/* خطوط المستندات والواجهة.
 * خطوط التقرير الرسمي (Times New Roman وMunaBlack وArabic Typesetting) تجارية ولا تُرفع مع المنصة،
 * فيرفعها المستخدم من جهازه في «الإعدادات» وتُحفظ مع بياناته (مجلد fonts) لا في المستودع.
 * وإلى أن تُرفع تُستخدم خطوط مجانية بديلة من مجلد fonts في المنصة.
 * كل خط يُسجَّل باسم ثابت (DocBody / DocAccent / DocMeta) فتستخدمه الواجهة والطباعة وملف PDF معًا. */
'use strict';

const DOC_FONTS = (() => {
  const SLOTS = [
    { k: 'body', fam: 'DocBody', weight: 400, label: 'خط النص', ref: 'Times New Roman', file: 'times.ttf', fb: 'fonts/Amiri-Regular.ttf', fbName: 'Amiri' },
    { k: 'bodyb', fam: 'DocBody', weight: 700, label: 'خط النص العريض (العناوين)', ref: 'Times New Roman Bold', file: 'timesbd.ttf', fb: 'fonts/Amiri-Bold.ttf', fbName: 'Amiri Bold' },
    { k: 'accent', fam: 'DocAccent', weight: 400, both: true, label: 'خط الترويسة والتوقيعات', ref: 'MunaBlack', file: 'MunaBlack.ttf', fb: 'fonts/Amiri-Bold.ttf', fbName: 'Amiri Bold' },
    { k: 'meta', fam: 'DocMeta', weight: 400, both: true, label: 'خط الرقم والتاريخ في الترويسة', ref: 'Arabic Typesetting', file: 'arabtype.ttf', fb: 'fonts/Amiri-Regular.ttf', fbName: 'Amiri' },
  ];
  const path = k => 'fonts/' + k + '.ttf';
  let faces = [];
  const bufs = {};        // "عائلة|وزن" → { buf, fake }
  const state = {};       // k → { user: bool }
  const fbCache = {};

  const fetchFb = url => fbCache[url] || (fbCache[url] = fetch(url).then(r => {
    if (!r.ok) throw new Error('تعذّر تحميل الخط ' + url);
    return r.arrayBuffer();
  }));

  /** يتحقق أن الملف خط TrueType يصلح للعرض وللتضمين في PDF — يرجع نص الخطأ أو '' */
  function validate(buf) {
    if (!buf || buf.byteLength < 64) return 'الملف ليس خطًا';
    const dv = new DataView(buf), tag = dv.getUint32(0);
    if (tag === 0x74746366) return 'هذا ملف مجموعة خطوط (TTC). اختر ملف ‎.ttf‎ مفردًا';
    if (tag === 0x4F54544F) return 'هذا خط OpenType من نوع CFF (‎.otf‎). المطلوب ملف ‎.ttf‎';
    if (tag !== 0x00010000 && tag !== 0x74727565) return 'الملف ليس خط TrueType (‎.ttf‎)';
    const n = dv.getUint16(4), have = new Set();
    for (let i = 0; i < n; i++) {
      const o = 12 + i * 16;
      have.add(String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3)));
    }
    for (const t of ['cmap', 'glyf', 'loca', 'head', 'hhea', 'hmtx', 'maxp']) if (!have.has(t)) return 'ملف الخط ناقص (الجدول ' + t + ')';
    return '';
  }

  /** يقرأ الخطوط المرفوعة (أو البديلة) ويسجّلها في المتصفح */
  async function load(getFile) {
    faces.forEach(f => document.fonts.delete(f));
    faces = [];
    for (const k in bufs) delete bufs[k];
    const got = {};
    for (const s of SLOTS) {
      let buf = null;
      try { const b = getFile ? await getFile(path(s.k)) : null; if (b) buf = await b.arrayBuffer(); } catch (e) { buf = null; }
      if (buf && validate(buf)) buf = null;
      got[s.k] = buf;
      state[s.k] = { user: !!buf };
    }
    // النص العريض: إن رُفع خط النص وحده يُستخدم هو نفسه بعرض مُصطنع، حتى لا يختلط خطّان
    if (!got.bodyb && got.body) got.bodyb = 'fake';
    const add = async (fam, weight, buf, fake) => {
      const f = new FontFace(fam, buf, { weight: String(weight), display: 'swap' });
      try { await f.load(); } catch (e) { return false; }
      document.fonts.add(f); faces.push(f);
      bufs[fam + '|' + weight] = { buf, fake: !!fake };
      return true;
    };
    for (const s of SLOTS) {
      let buf = got[s.k];
      if (buf === 'fake') {   // لا يُسجَّل وزن عريض؛ المتصفح يعرّضه، وملف PDF يحاكيه
        bufs[s.fam + '|700'] = { buf: got.body, fake: true };
        continue;
      }
      if (!buf || !(await add(s.fam, s.weight, buf))) {
        state[s.k].user = false;
        try { buf = await fetchFb(s.fb); } catch (e) { continue; }
        await add(s.fam, s.weight, buf);
      }
      if (s.both) await add(s.fam, 700, buf);
    }
    document.documentElement.classList.toggle('userfonts', !!state.body.user);
  }

  /** ملف الخط المستخدم فعلًا لعائلة ووزن: { buf, fake } */
  async function get(fam, bold) {
    const known = ['DocBody', 'DocAccent', 'DocMeta'];
    if (!known.includes(fam)) fam = 'DocBody';
    const k = fam + '|' + (bold ? 700 : 400);
    if (bufs[k]) return bufs[k];
    if (bold && bufs[fam + '|400']) return { buf: bufs[fam + '|400'].buf, fake: true };
    // لم تُحمَّل الخطوط بعد (صفحة بلا بيانات): البديل
    const s = SLOTS.find(x => x.fam === fam && x.weight === (bold ? 700 : 400)) || SLOTS.find(x => x.fam === fam);
    return { buf: await fetchFb(s.fb), fake: false };
  }

  return { SLOTS, path, validate, load, get, state };
})();

window.DOC_FONTS = DOC_FONTS;
