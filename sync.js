/* Cloud save for the GitHub Pages copy of Melissa 的小島.
   The game talks to window.claude.use('db') (the claude.ai artifact database, Firestore-style API).
   Off claude.ai this file provides the same API backed by the family's own Firebase or Supabase project.
   The connection settings never live in this repo: they are stored in this device's localStorage,
   set once from a setup link (#sync=...) or from sync.html. */
(function () {
  const KEY = 'melissa-island:sync';
  if (window.claude && typeof window.claude.use === 'function') return; // running on claude.ai

  // a setup link carries the settings in the hash; keep them and drop them from the address bar
  try {
    const m = location.hash.match(/[#&]sync=([^&]+)/);
    if (m) {
      const cfg = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      localStorage.setItem(KEY, JSON.stringify(cfg));
      history.replaceState(null, '', location.pathname + location.search);
    }
  } catch (e) { console.warn('sync link', e); }

  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  // a small note in the corner so a grown-up can tell whether this device syncs; tapping it opens sync.html
  function badge(text, warn, ms) {
    const show = () => {
      const a = document.createElement('a');
      a.href = 'sync.html'; a.textContent = text;
      a.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom));z-index:99999;padding:6px 14px;border-radius:999px;font:600 13px system-ui,sans-serif;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:opacity .6s;' +
        (warn ? 'background:#fff3e6;color:#a4501f;' : 'background:rgba(255,255,255,.92);color:#2f7a55;');
      document.body.appendChild(a);
      setTimeout(() => { a.style.opacity = '0'; setTimeout(() => a.remove(), 700); }, ms);
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }
  if (!cfg || !cfg.type) { badge('\ud83d\udcf1 \u5b58\u6a94\u53ea\u5728\u9019\u53f0\u88dd\u7f6e \u00b7 \u9ede\u9019\u88e1\u8a2d\u5b9a\u96f2\u7aef\u540c\u6b65', true, 12000); return; } // no cloud: saves stay in this browser

  const loadScript = src => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });

  /* ---------------- Firebase: Firestore's compat API is the same shape the game already uses */
  async function firebaseDb() {
    const v = '10.12.2';
    await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
    await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`);
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg.firebase);
    return app.firestore();
  }

  /* ---------------- Supabase: one table island_docs(path, col, id, data, updated_at) over REST; snapshots poll */
  function supabaseDb() {
    const base = cfg.url.replace(/\/$/, '') + '/rest/v1/island_docs';
    const hdr = { apikey: cfg.key, 'Content-Type': 'application/json' };
    if (/^eyJ/.test(cfg.key)) hdr.Authorization = 'Bearer ' + cfg.key; // legacy anon key is a JWT; new publishable keys go in apikey only
    const enc = encodeURIComponent;
    const rid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    const snapOf = rows => ({ docs: rows.map(r => ({ id: r.id, exists: true, data: () => r.data })), empty: !rows.length, size: rows.length });
    async function req(url, opt = {}) {
      const r = await fetch(url, Object.assign({ headers: hdr }, opt));
      if (!r.ok) throw new Error('supabase ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return r.status === 204 ? null : r.json().catch(() => null);
    }
    const put = (col, id, data) => req(base + '?on_conflict=path', {
      method: 'POST', headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, hdr),
      body: JSON.stringify({ path: col + '/' + id, col, id, data, updated_at: new Date().toISOString() }),
    });
    const split = p => { const i = p.lastIndexOf('/'); return [p.slice(0, i), p.slice(i + 1)]; };
    function query(col, wh = [], ord = null) {
      const q = {
        where: (f, op, v) => { if (op !== '==') throw new Error('only == is supported'); return query(col, wh.concat([[f, v]]), ord); },
        orderBy: (f, dir = 'asc') => query(col, wh, [f, dir]),
        async get() {
          let url = base + '?select=id,data&col=eq.' + enc(col);
          wh.forEach(([f, v]) => { url += '&data->>' + enc(f) + '=eq.' + enc(String(v)); });
          let rows = await req(url);
          if (ord) { const [f, d] = ord, k = d === 'desc' ? -1 : 1; rows.sort((a, b) => ((a.data[f] > b.data[f]) - (a.data[f] < b.data[f])) * k); }
          return snapOf(rows);
        },
        add: async data => { const id = rid(); await put(col, id, data); return { id }; },
        onSnapshot(cb, err) {
          let last = null, stop = false, t = null;
          const tick = async () => {
            if (stop) return;
            if (!document.hidden) {
              try { const s = await q.get(); const sig = JSON.stringify(s.docs.map(d => [d.id, d.data()])); if (sig !== last) { last = sig; cb(s); } }
              catch (e) { if (err) err(e); }
            }
            if (!stop) t = setTimeout(tick, 6000);
          };
          tick();
          return () => { stop = true; clearTimeout(t); };
        },
      };
      return q;
    }
    return {
      collection: col => query(col),
      doc: path => {
        const [col, id] = split(path);
        return {
          id,
          async get() { const rows = await req(base + '?select=data&path=eq.' + enc(path)); const r = rows && rows[0]; return { id, exists: !!r, data: () => (r ? r.data : undefined) }; },
          set: data => put(col, id, data),
          delete: () => req(base + '?path=eq.' + enc(path), { method: 'DELETE' }),
        };
      },
    };
  }

  let dbPromise = null;
  const getDb = () => dbPromise || (dbPromise = (async () => {
    const db = cfg.type === 'firebase' ? await firebaseDb() : supabaseDb();
    try { await db.collection('profiles').get(); badge('\u2601\ufe0f \u96f2\u7aef\u5b58\u6a94\u5df2\u9023\u4e0a', false, 4000); }
    catch (e) { badge('\u26a0\ufe0f \u9023\u4e0d\u4e0a\u96f2\u7aef\u5b58\u6a94\uff0c\u9032\u5ea6\u5148\u5b58\u5728\u9019\u53f0 \u00b7 \u9ede\u9019\u88e1\u6aa2\u67e5', true, 12000); throw e; }
    return db;
  })());
  window.claude = {
    use: async name => {
      if (name !== 'db') throw new Error('not available on this site: ' + name); // photos stay inside the journal entry
      return getDb();
    },
  };
})();
