/* ملف PDF بنص حقيقي (لا صورة) من الورقة المعروضة.
 * سفاري الآيفون يضيف رابط الموقع عند طباعة أي صفحة ويب، فنبني ملف PDF بأنفسنا:
 * مواضع الكلمات والأسطر والجداول تؤخذ من تخطيط المتصفح نفسه، والحروف تُكتب بخط Amiri مضمَّنًا في الملف
 * بأشكالها الموصولة (أول/وسط/آخر الكلمة)، فيبقى النص حادًّا عند التكبير والطباعة. */
(function () {
  'use strict';
  const PX = 0.75;                       // بكسل CSS → نقطة PDF
  const MM = 96 / 25.4;                  // بكسل لكل مم
  const PAGE_W = 595.28, PAGE_H = 841.89, MARGIN_MM = 8;

  // ---------------- قراءة خط TrueType ----------------
  const fontCache = {};
  async function loadFont(bold) {
    const k = bold ? 'b' : 'r';
    if (!fontCache[k]) fontCache[k] = fetch(bold ? 'fonts/Amiri-Bold.ttf' : 'fonts/Amiri-Regular.ttf')
      .then(r => { if (!r.ok) throw new Error('تعذّر تحميل الخط'); return r.arrayBuffer(); }).then(parseTTF);
    return fontCache[k];
  }
  function parseTTF(buf) {
    const dv = new DataView(buf), u16 = o => dv.getUint16(o), i16 = o => dv.getInt16(o), u32 = o => dv.getUint32(o);
    const T = {};
    for (let i = 0, n = u16(4); i < n; i++) {
      const o = 12 + i * 16;
      T[String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))] = u32(o + 8);
    }
    const upm = u16(T.head + 18), locFmt = i16(T.head + 50);
    const bbox = [i16(T.head + 36), i16(T.head + 38), i16(T.head + 40), i16(T.head + 42)];
    const asc = i16(T.hhea + 4), desc = i16(T.hhea + 6), nHM = u16(T.hhea + 34), nG = u16(T.maxp + 4);
    const adv = new Uint16Array(nG);
    for (let g = 0, last = 0; g < nG; g++) { if (g < nHM) last = u16(T.hmtx + g * 4); adv[g] = last; }
    const cmap = new Map();
    let sub12 = 0, sub4 = 0;
    for (let i = 0, n = u16(T.cmap + 2); i < n; i++) {
      const pid = u16(T.cmap + 4 + i * 8), eid = u16(T.cmap + 6 + i * 8), off = T.cmap + u32(T.cmap + 8 + i * 8), fmt = u16(off);
      if (pid === 3 && fmt === 12) sub12 = off;
      if (pid === 3 && eid === 1 && fmt === 4) sub4 = off;
    }
    if (sub12) {
      for (let i = 0, n = u32(sub12 + 12); i < n; i++) {
        const o = sub12 + 16 + i * 12, s = u32(o), e = u32(o + 4), g = u32(o + 8);
        for (let c = s; c <= e; c++) cmap.set(c, g + c - s);
      }
    } else if (sub4) {
      const seg = u16(sub4 + 6) / 2, ec = sub4 + 14, sc = ec + seg * 2 + 2, dl = sc + seg * 2, ro = dl + seg * 2;
      for (let i = 0; i < seg; i++) {
        const e = u16(ec + i * 2), s = u16(sc + i * 2), d = i16(dl + i * 2), r = u16(ro + i * 2);
        for (let c = s; c <= e && c !== 0xFFFF; c++) {
          let g;
          if (!r) g = (c + d) & 0xFFFF;
          else { g = u16(ro + i * 2 + r + (c - s) * 2); if (g) g = (g + d) & 0xFFFF; }
          if (g) cmap.set(c, g);
        }
      }
    }
    const gbox = g => {
      const lo = locFmt ? u32(T.loca + g * 4) : u16(T.loca + g * 2) * 2;
      const hi = locFmt ? u32(T.loca + g * 4 + 4) : u16(T.loca + g * 2 + 2) * 2;
      if (hi <= lo) return null;
      const o = T.glyf + lo;
      return [i16(o + 2), i16(o + 4), i16(o + 6), i16(o + 8)];
    };
    return { buf, upm, bbox, asc, desc, adv, cmap, gbox, used: new Set() };
  }

  // ---------------- وصل الحروف العربية ----------------
  // [منفرد، آخر، أول، وسط] — الحروف ذات الشكلين لا تتصل بما بعدها
  const F = {};
  const two = (c, b) => { F[c] = [b, b + 1]; }, four = (c, b) => { F[c] = [b, b + 1, b + 2, b + 3]; };
  F[0x621] = [0xFE80];
  two(0x622, 0xFE81); two(0x623, 0xFE83); two(0x624, 0xFE85); two(0x625, 0xFE87); four(0x626, 0xFE89);
  two(0x627, 0xFE8D); four(0x628, 0xFE8F); two(0x629, 0xFE93);
  [0x62A, 0x62B, 0x62C, 0x62D, 0x62E].forEach((c, i) => four(c, 0xFE95 + i * 4));
  two(0x62F, 0xFEA9); two(0x630, 0xFEAB); two(0x631, 0xFEAD); two(0x632, 0xFEAF);
  [0x633, 0x634, 0x635, 0x636, 0x637, 0x638, 0x639, 0x63A].forEach((c, i) => four(c, 0xFEB1 + i * 4));
  [0x641, 0x642, 0x643, 0x644, 0x645, 0x646, 0x647].forEach((c, i) => four(c, 0xFED1 + i * 4));
  two(0x648, 0xFEED); two(0x649, 0xFEEF); four(0x64A, 0xFEF1);
  const LAM_ALEF = { 0x622: 0xFEF5, 0x623: 0xFEF7, 0x625: 0xFEF9, 0x627: 0xFEFB };
  const TATWEEL = 0x640;
  const isMark = c => (c >= 0x610 && c <= 0x61A) || (c >= 0x64B && c <= 0x65F) || c === 0x670 || (c >= 0x6D6 && c <= 0x6ED);
  const joinsNext = c => c === TATWEEL || (F[c] && F[c].length === 4);   // يتصل بالحرف الذي بعده
  const joins = c => c === TATWEEL || !!F[c];
  const isRTL = c => (c >= 0x590 && c <= 0x8FF) || (c >= 0xFB1D && c <= 0xFEFC);
  const isLTR = c => (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) || (c >= 0xC0 && c <= 0x24F) || (c >= 0x660 && c <= 0x669);
  const MIRROR = { 0x28: 0x29, 0x29: 0x28, 0x5B: 0x5D, 0x5D: 0x5B, 0x7B: 0x7D, 0x7D: 0x7B, 0x3C: 0x3E, 0x3E: 0x3C, 0xAB: 0xBB, 0xBB: 0xAB };

  /** كلمة → عناقيد بترتيب العرض من اليسار لليمين: [{c: رمز, marks: [...]}] */
  function shapeWord(str) {
    const cps = Array.from(str, ch => ch.codePointAt(0));
    // عناقيد: حرف أساسي + حركاته
    const cl = [];
    for (const c of cps) {
      if (isMark(c) && cl.length) cl[cl.length - 1].marks.push(c);
      else cl.push({ c, o: c, marks: [] });
    }
    // أشكال الحروف حسب الاتصال
    for (let i = 0; i < cl.length; i++) {
      const c = cl[i].o;
      if (!F[c]) continue;
      const prevJ = i > 0 && joinsNext(cl[i - 1].o) && !cl[i - 1].lig;
      if (c === 0x644 && i + 1 < cl.length && LAM_ALEF[cl[i + 1].o]) {
        cl[i].c = LAM_ALEF[cl[i + 1].o] + (prevJ ? 1 : 0);
        cl[i].marks = cl[i].marks.concat(cl[i + 1].marks);
        cl[i].lig = true;
        cl.splice(i + 1, 1);
        continue;
      }
      const nextJ = i + 1 < cl.length && joins(cl[i + 1].o);
      const f = F[c];
      if (f.length === 4) cl[i].c = prevJ && nextJ ? f[3] : prevJ ? f[1] : nextJ ? f[2] : f[0];
      else if (f.length === 2) cl[i].c = prevJ ? f[1] : f[0];
      else cl[i].c = f[0];
    }
    // ترتيب العرض: مقاطع يمين-لليسار تُعكس، والأرقام والحروف اللاتينية تبقى كما هي
    const dir = cl.map(x => isLTR(x.o) ? 'L' : isRTL(x.o) ? 'R' : 'N');
    for (let i = 0; i < dir.length; i++) {
      if (dir[i] !== 'N') continue;
      let a = i - 1; while (a >= 0 && dir[a] === 'N') a--;
      let b = i + 1; while (b < dir.length && dir[b] === 'N') b++;
      const l = a >= 0 ? dir[a] : 'R', r = b < dir.length ? dir[b] : 'R';
      dir[i] = l === 'L' && r === 'L' ? 'L' : 'r';   // محايد بين رقمين يتبعهما، وإلا يتبع اتجاه الفقرة
    }
    const runs = [];
    cl.forEach((x, i) => {
      const d = dir[i] === 'L' ? 'L' : 'R';
      if (runs.length && runs[runs.length - 1].d === d) runs[runs.length - 1].items.push(x);
      else runs.push({ d, items: [x] });
    });
    const out = [];
    for (let k = runs.length - 1; k >= 0; k--) {
      const r = runs[k];
      if (r.d === 'L') out.push(...r.items);
      else for (let j = r.items.length - 1; j >= 0; j--) {
        const x = r.items[j];
        out.push(MIRROR[x.c] ? Object.assign({}, x, { c: MIRROR[x.c] }) : x);
      }
    }
    return out;
  }

  // ---------------- جمع عناصر الورقة من تخطيط المتصفح ----------------
  /** لون أبيض أو شفاف (لا يُرسم) */
  const isWhite = c => {
    if (!c || c === 'transparent') return true;
    const m = (c.match(/[\d.]+/g) || []).map(Number);
    if (m.length === 4 && m[3] === 0) return true;
    return m[0] >= 250 && m[1] >= 250 && m[2] >= 250;
  };
  const rgb = c => { const m = c.match(/[\d.]+/g) || ['0', '0', '0']; return m.slice(0, 3).map(v => (+v / 255).toFixed(3)).join(' '); };
  const baseCache = new Map();
  /** نسبة خط القاعدة داخل صندوق النص (تُقاس فعليًا في المتصفح لكل حجم ووزن) */
  function baselineRatio(fs, weight) {
    const k = fs + '|' + weight;
    if (baseCache.has(k)) return baseCache.get(k);
    const s = document.createElement('span');
    s.style.cssText = `position:absolute;left:-9999px;top:0;font-family:Amiri,serif;font-size:${fs}px;font-weight:${weight};line-height:normal;white-space:nowrap`;
    s.textContent = 'بـ';
    const i = document.createElement('i');
    i.style.cssText = 'display:inline-block;width:1px;height:0;vertical-align:baseline';
    s.appendChild(i);
    document.body.appendChild(s);
    const rg = document.createRange(); rg.selectNodeContents(s.firstChild);
    const tr = rg.getBoundingClientRect(), br = i.getBoundingClientRect();
    const v = tr.height ? (br.top - tr.top) / tr.height : 0.68;
    s.remove(); baseCache.set(k, v);
    return v;
  }

  function collect(root) {
    const R = root.getBoundingClientRect(), ox = R.left, oy = R.top;
    const boxes = [], words = [], images = [], avoid = [];
    const rel = r => ({ x: r.left - ox, y: r.top - oy, w: r.width, h: r.height });
    root.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const b = rel(r);
      if (!isWhite(cs.backgroundColor)) boxes.push({ type: 'bg', ...b, color: rgb(cs.backgroundColor) });
      for (const [side, w, st, col] of [['top', cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor], ['bottom', cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor],
                                       ['left', cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor], ['right', cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor]]) {
        const bw = parseFloat(w);
        if (bw > 0 && st !== 'none' && st !== 'hidden' && !isWhite(col)) boxes.push({ type: 'border', side, bw, style: st, color: rgb(col), ...b });
      }
      if (el.tagName === 'IMG' && el.complete && el.naturalWidth) images.push({ el, ...b });
      if (/avoid/.test(cs.breakInside) || el.matches('.head, tr, .sigbox, .sigrow, .sigs, .lt-sig')) avoid.push(b);
    });
    // الكلمات: كل كلمة بمستطيلها الفعلي في الصفحة
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      const el = n.parentElement, cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || !n.data.trim()) continue;
      const fs = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
      let deco = null;
      for (let a = el; a && a !== root.parentElement; a = a.parentElement) {
        if (/underline/.test(getComputedStyle(a).textDecorationLine)) { deco = a; break; }
      }
      const stroke = parseFloat(cs.webkitTextStrokeWidth || '0') || 0;
      const ratio = baselineRatio(fs, weight >= 600 ? 700 : 400);
      const re = /\S+/g;
      let m;
      while ((m = re.exec(n.data))) {
        const rg = document.createRange();
        rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
        let rects = Array.from(rg.getClientRects()).filter(r => r.width > 0.5 && r.height > 0);
        if (!rects.length) continue;
        // المستطيلات التي في سطر الكلمة فقط (قد يعيد المتصفح مستطيلًا لنهاية السطر السابق أو صندوقًا يغطي عدة أسطر)
        const minH = Math.min(...rects.map(r => r.height));
        const main = rects.filter(r => r.height < minH * 1.2).reduce((a, r) => r.width > a.width ? r : a);
        rects = rects.filter(r => Math.abs((r.top + r.bottom) / 2 - (main.top + main.bottom) / 2) < main.height / 2 && r.height < main.height * 1.5);
        // الكلمة قد تُعاد مستطيلين (أرقام وحروف) — نجمع ما في السطر نفسه
        const top = Math.min(...rects.map(r => r.top)), bottom = Math.max(...rects.map(r => r.bottom));
        const left = Math.min(...rects.map(r => r.left)), right = Math.max(...rects.map(r => r.right));
        words.push({ t: m[0], x: left - ox, y: top - oy, w: right - left, h: bottom - top, base: top - oy + ratio * (bottom - top),
                     fs, bold: weight >= 600, color: rgb(cs.color), stroke, deco });
      }
    }
    // الارتفاع الفعلي: قد يتجاوز المحتوى صندوق الورقة الداخلي قليلًا (مثل سطر التوقيع الأخير)
    const bottom = Math.max(R.height, ...words.map(w => w.y + w.h), ...images.map(i => i.y + i.h), ...boxes.map(b => b.y + b.h));
    return { width: R.width, height: bottom + 1, boxes, words, images, avoid };
  }

  // ---------------- تقسيم الصفحات بين الأسطر ----------------
  function paginate(doc) {
    const H = (297 - 2 * MARGIN_MM) * MM, pages = [];
    let start = 0;
    while (start < doc.height - 1) {
      let end = start + H;
      if (end >= doc.height) { pages.push([start, doc.height]); break; }
      let cut = end;
      const cross = (y0, y1) => y0 < cut && y1 > cut && y0 > start + 1;
      for (let guard = 0; guard < 50; guard++) {
        let moved = false;
        for (const a of doc.avoid) if (a.h < H * 0.6 && cross(a.y, a.y + a.h)) { cut = a.y; moved = true; }
        // الكلمة بارتفاع حروفها (لا صندوقها الكامل، فصناديق الأسطر المتقاربة تتداخل)
        for (const w of doc.words) if (cross(w.base - w.fs * 0.85, w.base + w.fs * 0.35)) { cut = w.base - w.fs * 0.85; moved = true; }
        for (const im of doc.images) if (cross(im.y, im.y + im.h)) { cut = im.y; moved = true; }
        if (!moved) break;
      }
      if (cut <= start + 1) cut = end;
      pages.push([start, cut]);
      start = cut;
    }
    return pages;
  }

  // ---------------- كتابة ملف PDF ----------------
  const enc = new TextEncoder();
  async function deflate(bytes) {
    if (typeof CompressionStream !== 'function') return null;
    try {
      const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
      return new Uint8Array(await new Response(s).arrayBuffer());
    } catch (e) { return null; }
  }
  async function imageJpeg(img) {
    const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    const bin = atob(c.toDataURL('image/jpeg', 0.92).split(',')[1]), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return { data: a, w: c.width, h: c.height };
  }
  const num = v => (Math.round(v * 100) / 100).toString();
  const hex4 = g => g.toString(16).padStart(4, '0');

  async function make(root) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const doc = collect(root);
    const fonts = { r: await loadFont(false), b: doc.words.some(w => w.bold) ? await loadFont(true) : null };
    const pages = paginate(doc);
    const scale = Math.min(1, (210 - 2 * MARGIN_MM) * MM / doc.width);   // الورقة أعرض من الصفحة؟ تُصغَّر لتتسع
    const mL = MARGIN_MM * MM * PX, mT = MARGIN_MM * MM * PX;
    const X = x => mL + x * scale * PX, Y = (y, p0) => PAGE_H - (mT + (y - p0) * scale * PX);
    const imgs = await Promise.all(doc.images.map(i => imageJpeg(i.el).catch(() => null)));

    const contents = pages.map(([p0, p1]) => {
      const out = [];
      const vis = (y, h) => y + h > p0 - 0.5 && y < p1 + 0.5;
      // قصّ المحتوى على حدود الصفحة حتى لا يظهر جزء من سطر الصفحة التالية
      out.push('q', `${num(mL - 4)} ${num(Y(p1, p0) - 2)} ${num(doc.width * scale * PX + 8)} ${num((p1 - p0) * scale * PX + 4)} re W n`);
      for (const b of doc.boxes) if (b.type === 'bg' && vis(b.y, b.h))
        out.push(`${b.color} rg ${num(X(b.x))} ${num(Y(b.y + b.h, p0))} ${num(b.w * scale * PX)} ${num(b.h * scale * PX)} re f`);
      for (const b of doc.boxes) if (b.type === 'border' && vis(b.y, b.h)) {
        const lw = b.bw * scale * PX, h = lw / 2;
        let x1, y1, x2, y2;
        if (b.side === 'top') { x1 = X(b.x); x2 = X(b.x + b.w); y1 = y2 = Y(b.y, p0) - h; }
        else if (b.side === 'bottom') { x1 = X(b.x); x2 = X(b.x + b.w); y1 = y2 = Y(b.y + b.h, p0) + h; }
        else if (b.side === 'left') { x1 = x2 = X(b.x) + h; y1 = Y(b.y, p0); y2 = Y(b.y + b.h, p0); }
        else { x1 = x2 = X(b.x + b.w) - h; y1 = Y(b.y, p0); y2 = Y(b.y + b.h, p0); }
        const dash = b.style === 'dotted' ? `1 J [0 ${num(lw * 2.2)}] 0 d` : b.style === 'dashed' ? `0 J [${num(lw * 3)} ${num(lw * 2)}] 0 d` : '0 J [] 0 d';
        out.push(`${b.color} RG ${num(lw)} w ${dash} ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
      }
      doc.images.forEach((im, i) => {
        if (!imgs[i] || !vis(im.y, im.h)) return;
        out.push(`q ${num(im.w * scale * PX)} 0 0 ${num(im.h * scale * PX)} ${num(X(im.x))} ${num(Y(im.y + im.h, p0))} cm /Im${i} Do Q`);
      });
      // خط تحت النص (العناوين المسطّرة): يمتد من أول كلمة لآخر كلمة في السطر
      const lines = new Map(), ids = new Map();
      for (const w of doc.words) if (w.deco && w.base >= p0 && w.base < p1) {
        if (!ids.has(w.deco)) ids.set(w.deco, ids.size);
        const key = ids.get(w.deco) + '|' + Math.round(w.base);
        const l = lines.get(key) || { x0: Infinity, x1: -Infinity, base: w.base, fs: w.fs, color: w.color };
        l.x0 = Math.min(l.x0, w.x); l.x1 = Math.max(l.x1, w.x + w.w); lines.set(key, l);
      }
      for (const l of lines.values()) {
        const y = Y(l.base + l.fs * 0.13, p0), lw = Math.max(0.5, l.fs * 0.055 * scale * PX);
        out.push(`${l.color} RG ${num(lw)} w 0 J [] 0 d ${num(X(l.x0))} ${num(y)} m ${num(X(l.x1))} ${num(y)} l S`);
      }
      // النص
      out.push('BT');
      for (const w of doc.words) {
        if (w.base < p0 || w.base >= p1) continue;   // كل سطر في صفحة واحدة حسب خط قاعدته
        const font = w.bold && fonts.b ? fonts.b : fonts.r, fname = font === fonts.b ? '/F2' : '/F1';
        const k = w.fs / font.upm;
        const cl = shapeWord(w.t).map(x => ({ g: font.cmap.get(x.c) || font.cmap.get(x.o) || 0, marks: x.marks.map(m => font.cmap.get(m) || 0).filter(Boolean) }));
        const total = cl.reduce((s, x) => s + font.adv[x.g], 0) * k;
        if (!total) continue;
        const sx = Math.max(0.7, Math.min(1.3, w.w / total));
        const fsPt = w.fs * scale * PX;
        out.push(`${w.color} rg ${w.color} RG`);
        out.push(w.stroke > 0 ? `2 Tr ${num(w.stroke * scale * PX)} w` : '0 Tr');
        out.push(`${fname} ${num(fsPt)} Tf`);
        let x = w.x;
        const by = Y(w.base, p0);
        for (const c of cl) {
          const aw = font.adv[c.g] * k * sx;
          font.used.add(c.g);
          out.push(`${num(sx)} 0 0 1 ${num(X(x))} ${num(by)} Tm <${hex4(c.g)}> Tj`);
          for (const mg of c.marks) {   // الحركة فوق/تحت حرفها في المنتصف
            font.used.add(mg);
            const bb = font.gbox(mg), gb = font.gbox(c.g);
            const mc = bb ? (bb[0] + bb[2]) / 2 : 0, gc = gb ? (gb[0] + gb[2]) / 2 : font.adv[c.g] / 2;
            out.push(`1 0 0 1 ${num(X(x + (gc * sx - mc) * k))} ${num(by)} Tm <${hex4(mg)}> Tj`);
          }
          x += aw;
        }
      }
      out.push('ET', 'Q');
      return out.join('\n');
    });

    // ---- الكائنات ----
    const objs = [];   // [رقم] = Uint8Array[]
    const add = parts => { objs.push(parts); return objs.length; };
    const str = s => enc.encode(s);
    const stream = async (dict, bytes, allowZip) => {
      const z = allowZip ? await deflate(bytes) : null;
      return [str(`<< ${dict} ${z ? '/Filter /FlateDecode ' : ''}/Length ${(z || bytes).length} >>\nstream\n`), z || bytes, str('\nendstream')];
    };
    const catalog = add(null), pagesObj = add(null);
    const fontRefs = {};
    for (const [key, font] of [['F1', fonts.r], ['F2', fonts.b]]) {
      if (!font || !font.used.size) continue;
      const ff = add(await stream(`/Length1 ${font.buf.byteLength}`, new Uint8Array(font.buf), true));
      const k = 1000 / font.upm, fb = font.bbox.map(v => Math.round(v * k));
      const fd = add([str(`<< /Type /FontDescriptor /FontName /Amiri${key} /Flags 4 /FontBBox [${fb.join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(font.asc * k)} /Descent ${Math.round(font.desc * k)} /CapHeight ${Math.round(font.asc * k)} /StemV 80 /FontFile2 ${ff} 0 R >>`)]);
      const gids = [...font.used].sort((a, b) => a - b);
      const W = gids.map(g => `${g} [${Math.round(font.adv[g] * k)}]`).join(' ');
      const cid = add([str(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Amiri${key} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${fd} 0 R /CIDToGIDMap /Identity /DW 500 /W [${W}] >>`)]);
      fontRefs[key] = add([str(`<< /Type /Font /Subtype /Type0 /BaseFont /Amiri${key} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] >>`)]);
    }
    const imgRefs = [];
    for (let i = 0; i < imgs.length; i++) if (imgs[i])
      imgRefs[i] = add(await stream(`/Type /XObject /Subtype /Image /Width ${imgs[i].w} /Height ${imgs[i].h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, imgs[i].data, false));
    const res = `/Font << ${Object.entries(fontRefs).map(([k, r]) => `/${k} ${r} 0 R`).join(' ')} >> /XObject << ${imgRefs.map((r, i) => r ? `/Im${i} ${r} 0 R` : '').join(' ')} >>`;
    const pageRefs = [];
    for (const c of contents) {
      const ct = add(await stream('', str(c), true));
      pageRefs.push(add([str(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << ${res} >> /Contents ${ct} 0 R >>`)]));
    }
    objs[catalog - 1] = [str(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`)];
    objs[pagesObj - 1] = [str(`<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map(r => r + ' 0 R').join(' ')}] >>`)];

    const parts = [str('%PDF-1.4\n%âãÏÓ\n')];
    let len = parts[0].length;
    const offs = [];
    objs.forEach((o, i) => {
      offs[i] = len;
      for (const p of [str(`${i + 1} 0 obj\n`), ...o, str('\nendobj\n')]) { parts.push(p); len += p.length; }
    });
    let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offs.forEach(o => { x += String(o).padStart(10, '0') + ' 00000 n \n'; });
    x += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${len}\n%%EOF`;
    parts.push(str(x));
    fonts.r.used.clear(); if (fonts.b) fonts.b.used.clear();
    return { blob: new Blob(parts, { type: 'application/pdf' }), pages: pages.length };
  }

  window.PDFGEN = { make, shapeWord, collect, paginate };
})();
