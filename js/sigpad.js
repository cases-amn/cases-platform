/* لوحة توقيع بقلم ناعم: عرض الخط يتغير مع سرعة اليد أو ضغط القلم */
'use strict';

const SIG_COLORS = [
  { name: 'أزرق', v: '#1838a8' },
  { name: 'كحلي', v: '#0b1d5c' },
  { name: 'أسود', v: '#111111' },
  { name: 'أخضر', v: '#0d6a3a' },
];
const SIG_WIDTHS = [
  { name: 'رفيع', v: 2.6 },
  { name: 'متوسط', v: 3.8 },
  { name: 'عريض', v: 5.4 },
];
// إحداثيات منطقية ثابتة حتى لا يضيع التوقيع عند تغيير حجم الشاشة
const LW = 1000, LH = 380;

class SignaturePad {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.strokes = [];
    this.cur = null;
    this.color = lsGet('sig_color', SIG_COLORS[0].v);
    this.width = parseFloat(lsGet('sig_width', SIG_WIDTHS[1].v));
    this.onchange = null;
    this._resize = () => this.fit();
    window.addEventListener('resize', this._resize);
    const c = canvas;
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('pointermove', e => this.move(e));
    c.addEventListener('pointerup', e => this.up(e));
    c.addEventListener('pointercancel', e => this.up(e));
    c.addEventListener('lostpointercapture', e => this.up(e));
    this.fit();
  }
  destroy() { window.removeEventListener('resize', this._resize); }
  isEmpty() { return this.strokes.length === 0; }
  setColor(v) { this.color = v; lsSet('sig_color', v); }
  setWidth(v) { this.width = v; lsSet('sig_width', v); }

  fit() {
    const r = this.cv.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    this.cv.width = Math.round(r.width * dpr);
    this.cv.height = Math.round(r.height * dpr);
    this.scale = this.cv.width / LW;
    this.redraw();
  }
  pt(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * LW, y: (e.clientY - r.top) / r.height * LH, t: e.timeStamp,
             p: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : null };
  }
  down(e) {
    if (e.button > 0) return;
    e.preventDefault();
    this.cv.setPointerCapture(e.pointerId);
    const p = this.pt(e);
    p.w = this.width * (p.p != null ? 0.45 + p.p * 1.1 : 1);
    this.cur = { color: this.color, w: this.width, pts: [p] };
    this.strokes.push(this.cur);
    this.drawDot(this.ctx, this.scale, this.cur, p);
  }
  move(e) {
    if (!this.cur) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) this.add(this.pt(ev));
  }
  add(p) {
    const s = this.cur, pts = s.pts, last = pts[pts.length - 1];
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    if (dist < 0.8) return;
    let target;
    if (p.p != null) target = s.w * (0.45 + p.p * 1.1);
    else {
      const v = dist / Math.max(1, p.t - last.t);          // وحدة/ملّي ثانية
      target = s.w * Math.max(0.5, Math.min(1.35, 1.35 - v * 0.22));
    }
    p.w = last.w * 0.72 + target * 0.28;                    // تنعيم تغيّر العرض
    pts.push(p);
    this.drawSeg(this.ctx, this.scale, s, pts.length - 1);
  }
  up() {
    if (!this.cur) return;
    this.cur = null;
    this.onchange && this.onchange();
  }
  drawDot(ctx, sc, s, p) {
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(p.x * sc, p.y * sc, p.w * sc / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // منحنى تربيعي بين منتصفات النقاط للحصول على خط ناعم
  drawSeg(ctx, sc, s, i) {
    const pts = s.pts, p0 = pts[Math.max(0, i - 2)], p1 = pts[i - 1], p2 = pts[i];
    const m1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const m2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    if (i === 1) { m1.x = p1.x; m1.y = p1.y; }
    ctx.strokeStyle = s.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = ((p1.w + p2.w) / 2) * sc;
    ctx.beginPath();
    ctx.moveTo(m1.x * sc, m1.y * sc);
    ctx.quadraticCurveTo(p1.x * sc, p1.y * sc, m2.x * sc, m2.y * sc);
    ctx.stroke();
  }
  paint(ctx, sc) {
    for (const s of this.strokes) {
      this.drawDot(ctx, sc, s, s.pts[0]);
      for (let i = 1; i < s.pts.length; i++) this.drawSeg(ctx, sc, s, i);
      if (s.pts.length > 1) {
        const a = s.pts[s.pts.length - 1];
        ctx.strokeStyle = s.color; ctx.lineWidth = a.w * sc; ctx.lineCap = 'round';
        const b = s.pts[s.pts.length - 2];
        ctx.beginPath(); ctx.moveTo((a.x + b.x) / 2 * sc, (a.y + b.y) / 2 * sc); ctx.lineTo(a.x * sc, a.y * sc); ctx.stroke();
      }
    }
  }
  redraw() {
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    this.paint(this.ctx, this.scale);
  }
  undo() { this.strokes.pop(); this.redraw(); this.onchange && this.onchange(); }
  clear() { this.strokes = []; this.redraw(); this.onchange && this.onchange(); }

  /** صورة PNG شفافة مقصوصة على حدود التوقيع وبدقة عالية للطباعة */
  async toBlob() {
    if (this.isEmpty()) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of this.strokes) for (const p of s.pts) {
      x0 = Math.min(x0, p.x - p.w); y0 = Math.min(y0, p.y - p.w);
      x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.w);
    }
    const pad = 8, sc = 2.5;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const c = document.createElement('canvas');
    c.width = Math.ceil((x1 - x0) * sc); c.height = Math.ceil((y1 - y0) * sc);
    const ctx = c.getContext('2d');
    ctx.translate(-x0 * sc, -y0 * sc);
    this.paint(ctx, sc);
    return new Promise(res => c.toBlob(res, 'image/png'));
  }
}
