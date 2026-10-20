/* طبقة التخزين: مجلد على الجهاز (File System Access API) أو داخل المتصفح (IndexedDB) */
'use strict';

const IDB_NAME = 'cases-platform';
const DATA_FILE = 'data.json';
const PREV_FILE = 'data.prev.json';

// ------------------------- IndexedDB مساعد -------------------------
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
let _idb = null;
async function idb() { return _idb || (_idb = await idbOpen()); }
async function idbReq(store, mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}
const kvGet = k => idbReq('kv', 'readonly', s => s.get(k));
const kvSet = (k, v) => idbReq('kv', 'readwrite', s => s.put(v, k));
const kvDel = k => idbReq('kv', 'readwrite', s => s.delete(k));

// ------------------------- التخزين داخل المتصفح -------------------------
const BrowserBackend = {
  kind: 'browser',
  label: 'داخل المتصفح على هذا الجهاز',
  async load() { return (await kvGet('db')) || null; },
  async save(data) { await kvSet('db', data); },
  async putFile(path, blob) { await idbReq('files', 'readwrite', s => s.put(blob, path)); },
  async getFile(path) { return (await idbReq('files', 'readonly', s => s.get(path))) || null; },
  async delFile(path) { await idbReq('files', 'readwrite', s => s.delete(path)); },
  async listFiles() { return (await idbReq('files', 'readonly', s => s.getAllKeys())) || []; },
};

// ------------------------- التخزين في مجلد -------------------------
function makeFolderBackend(dir) {
  async function walk(path, create) {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    let d = dir;
    for (const p of parts) d = await d.getDirectoryHandle(p, { create });
    return { d, name };
  }
  async function writeText(name, text) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }
  return {
    kind: 'folder',
    dir,
    label: 'المجلد: ' + dir.name,
    async load() {
      try {
        const fh = await dir.getFileHandle(DATA_FILE);
        const txt = await (await fh.getFile()).text();
        return txt.trim() ? JSON.parse(txt) : null;
      } catch (e) {
        if (e.name === 'NotFoundError') return null;
        throw e;
      }
    },
    async save(data) {
      // نسخة من الحفظ السابق قبل الكتابة (للاحتياط)
      try {
        const old = await (await (await dir.getFileHandle(DATA_FILE)).getFile()).text();
        if (old.trim()) await writeText(PREV_FILE, old);
      } catch (e) { /* لا يوجد ملف سابق */ }
      await writeText(DATA_FILE, JSON.stringify(data, null, 1));
    },
    async putFile(path, blob) {
      const { d, name } = await walk(path, true);
      const w = await (await d.getFileHandle(name, { create: true })).createWritable();
      await w.write(blob);
      await w.close();
    },
    async getFile(path) {
      try {
        const { d, name } = await walk(path, false);
        return await (await d.getFileHandle(name)).getFile();
      } catch (e) { return null; }
    },
    async delFile(path) {
      try {
        const { d, name } = await walk(path, false);
        await d.removeEntry(name);
      } catch (e) { /* غير موجود */ }
    },
    async listFiles() {
      const out = [];
      async function rec(d, prefix) {
        for await (const [name, h] of d.entries()) {
          if (h.kind === 'directory') await rec(h, prefix + name + '/');
          else if (prefix) out.push(prefix + name);   // ملفات الجذر هي ملفات البيانات
        }
      }
      await rec(dir, '');
      return out;
    },
  };
}

const Store = {
  backend: null,
  folderSupported: typeof window.showDirectoryPicker === 'function',

  /** يحاول فتح التخزين المحفوظ. يرجع: 'ready' | 'choose' | 'permission' */
  async init() {
    const mode = await kvGet('mode');
    if (mode === 'browser') { this.backend = BrowserBackend; return 'ready'; }
    if (mode === 'folder' && this.folderSupported) {
      const dir = await kvGet('dir');
      if (dir) {
        this._pendingDir = dir;
        const p = await dir.queryPermission({ mode: 'readwrite' });
        if (p === 'granted') { this.backend = makeFolderBackend(dir); return 'ready'; }
        return 'permission';
      }
    }
    return 'choose';
  },
  pendingFolderName() { return this._pendingDir ? this._pendingDir.name : ''; },

  /** يُستدعى من ضغطة زر (يتطلب تفاعل المستخدم) */
  async grantPending() {
    const dir = this._pendingDir;
    const p = await dir.requestPermission({ mode: 'readwrite' });
    if (p !== 'granted') return false;
    this.backend = makeFolderBackend(dir);
    return true;
  },

  async pickFolder() {
    const dir = await window.showDirectoryPicker({ id: 'cases-platform', mode: 'readwrite' });
    return makeFolderBackend(dir);
  },

  async useBackend(b) {
    this.backend = b;
    await kvSet('mode', b.kind);
    if (b.kind === 'folder') await kvSet('dir', b.dir);
    else await kvDel('dir');
    if (b.kind === 'browser' && navigator.storage && navigator.storage.persist) {
      try { await navigator.storage.persist(); } catch (e) {}
    }
  },

  browser: BrowserBackend,
};
