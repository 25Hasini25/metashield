/* MetaShield content script – runs on every page, entirely client-side. No network requests. */
(() => {
  'use strict';

  /* ---------- EXIF reader (JPEG) ---------- */
  function readExif(buf) {
    const v = new DataView(buf), out = {};
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return out;
    let p = 2;
    while (p + 4 < v.byteLength) {
      const m = v.getUint16(p), len = v.getUint16(p + 2);
      if (m === 0xFFE1 && v.getUint32(p + 4) === 0x45786966) { parseTiff(v, p + 10, out); break; }
      if ((m & 0xFF00) !== 0xFF00 || m === 0xFFDA) break;
      p += 2 + len;
    }
    return out;
  }
  function parseTiff(v, b, out) {
    const le = v.getUint16(b) === 0x4949, u16 = o => v.getUint16(o, le), u32 = o => v.getUint32(o, le);
    const str = (o, n) => { let s = ''; for (let i = 0; i < n; i++) { const c = v.getUint8(o + i); if (!c) break; s += String.fromCharCode(c); } return s.trim(); };
    const tsize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };
    function ifd(off) {
      const r = {}, n = u16(b + off);
      for (let i = 0; i < n; i++) {
        const e = b + off + 2 + i * 12, tag = u16(e), t = u16(e + 2), c = u32(e + 4);
        const sz = (tsize[t] || 1) * c, vo = sz > 4 ? b + u32(e + 8) : e + 8;
        if (t === 2) r[tag] = str(vo, c);
        else if ((t === 1 || t === 7) && c === 1) r[tag] = v.getUint8(vo);
        else if (t === 3) r[tag] = u16(vo);
        else if (t === 4) r[tag] = u32(vo);
        else if (t === 5) { const a = []; for (let k = 0; k < c; k++) a.push(u32(vo + k * 8) / (u32(vo + k * 8 + 4) || 1)); r[tag] = a; }
      }
      return r;
    }
    try {
      const i0 = ifd(u32(b + 4));
      out.make = i0[0x10F]; out.model = i0[0x110]; out.software = i0[0x131];
      out.artist = i0[0x13B]; out.copyright = i0[0x8298];
      if (i0[0x8769]) { const ex = ifd(i0[0x8769]); out.taken = ex[0x9003]; out.serial = ex[0xA431]; }
      if (i0[0x8825]) {
        const g = ifd(i0[0x8825]);
        if (g[2] && g[4]) {
          const d = a => a[0] + a[1] / 60 + a[2] / 3600;
          out.lat = d(g[2]) * (g[1] === 'S' ? -1 : 1);
          out.lon = d(g[4]) * (g[3] === 'W' ? -1 : 1);
        }
        if (g[6] && g[6].length) out.alt = g[6][0] * (g[5] === 1 ? -1 : 1);   // GPSAltitude / GPSAltitudeRef (read even without lat/lon)
      }
    } catch (_) { /* malformed EXIF – ignore */ }
  }

  /* ---------- plain-English risk analysis ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function when(s) {
    const m = /(\d+):(\d+):(\d+) (\d+):(\d+)/.exec(s || ''); if (!m) return s;
    const d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]), now = new Date();
    const day = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (day === 0) return 'Today at ' + t; if (day === 1) return 'Yesterday at ' + t;
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ' at ' + t;
  }
  function analyse(m) {
    const items = []; let score = 0;
    const add = (sev, pts, ic, label, value, why) => { score += pts; items.push({ sev, ic, label, value, why }); };
    if (m.lat != null) add('high', 50, 'pin', 'Location', `${Math.abs(m.lat).toFixed(5)}° ${m.lat < 0 ? 'S' : 'N'}, ${Math.abs(m.lon).toFixed(5)}° ${m.lon < 0 ? 'W' : 'E'}`, 'Pinpoints where this was taken, often a home, office or school, to within a few metres.');
    if (m.alt != null) add('med', 5, 'alt', 'Altitude', `${Math.abs(Math.round(m.alt))} m ${m.alt < 0 ? 'below' : 'above'} sea level`, 'Shows how high you were. Enough to hint at the floor of a building or a hillside.');
    if (m.model || m.make) add('med', 15, 'dev', 'Device', [m.make && m.model && m.model.toLowerCase().startsWith(m.make.toLowerCase()) ? '' : m.make, m.model].filter(Boolean).join(' '), 'Reveals the exact phone or camera you own. Useful for targeted scams.');
    if (m.taken) add('med', 15, 'time', 'Captured', when(m.taken), 'Shows your daily routine, such as when you are usually home or away.');
    if (m.artist || m.copyright) add('high', 15, 'user', 'Author', m.artist || m.copyright, 'Your real name is stored inside the file.');
    if (m.software) add('low', 5, 'tool', 'Software', m.software, 'Shows which apps and versions you use.');
    if (m.serial) add('med', 5, 'id', 'Serial number', m.serial, 'A unique ID that can link separate photos back to one device.');
    return { items, score: Math.min(score, 100) };
  }
  if (window.__MS_DEMO) window.__MS_API = { readExif, analyse };   // lets the demo page label received files


  /* ---------- altitude visual ---------- */
  function altCard(m) {
    if (m.alt == null) return '';
    const a = m.alt, top = Math.max(300, Math.ceil((Math.abs(a) + 150) / 100) * 100), H = 88, base = 66;
    const y = Math.max(14, Math.min(base - 6, base - Math.max(0, a) / top * (base - 14)));
    const ground = [[0, y + 9], [60, y + 4], [130, y + 8], [210, y + 3], [290, y + 9], [360, y + 5], [420, y + 8]].map(p => p.join(',')).join(' ');
    const inCity = m.lat != null && m.lat > 12.82 && m.lat < 13.12 && m.lon > 77.46 && m.lon < 77.78;
    const hint = !inCity ? 'Elevation can show whether you were on a hill, a high floor or at ground level.' :
      a > 960 ? `About ${Math.round(a - 920)} m above typical Bengaluru ground level (~920 m). May suggest a high floor or rooftop.` :
      a >= 880 ? 'Close to Bengaluru ground level (~920 m), so likely taken near street level.' : 'Below typical Bengaluru ground level (~920 m).';
    const lbl = `${Math.abs(Math.round(a))} m ${a < 0 ? 'below' : 'above'} sea level`;
    return `<div class="alt"><div class="alth"><span>Altitude</span><b>${lbl}</b></div>
<svg viewBox="0 0 420 ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Elevation: ${lbl}"><defs><linearGradient id="msSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16233a"/><stop offset="1" stop-color="#27415f"/></linearGradient>
<linearGradient id="msGnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b5a52"/><stop offset="1" stop-color="#1d2f2d"/></linearGradient></defs>
<rect width="420" height="${H}" fill="url(#msSky)"/><polygon points="0,${H} ${ground} 420,${H}" fill="url(#msGnd)"/>
<line x1="0" y1="${base + 8}" x2="420" y2="${base + 8}" stroke="#58c4dd" stroke-width="1" stroke-dasharray="4 3"/>
<text x="8" y="${base + 5}" fill="#58c4dd" font-size="9" font-family="IBM Plex Mono,monospace">0 m · sea level</text>
<line x1="210" y1="${y}" x2="210" y2="${base + 8}" stroke="#ff7b80" stroke-width="1.2" stroke-dasharray="3 2"/>
<circle cx="210" cy="${y}" r="5" fill="#ff5a5f" stroke="#fff" stroke-width="1.5"/><path d="M142 ${y + 14}h16" stroke="#ff7b80" stroke-width="1.2" opacity="0"/>
<text x="222" y="${Math.max(18, y - 6)}" fill="#fff" font-size="10" font-weight="600" font-family="IBM Plex Mono,monospace">${lbl}</text></svg>
<p>${hint}</p></div>`;
  }

  /* ---------- modal (Shadow DOM so site CSS can't break it) ---------- */
  const ICONS = {
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    alt: '<path d="M3 20l6-10 4 6 3-4 5 8z"/><path d="M14 6l1.5-2L17 6"/>',
    dev: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
    tool: '<path d="M14 7a4 4 0 105 5l-9 9a2 2 0 01-3-3l9-9z"/>',
    id: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>'
  };
  const icon = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
  const SHIELD = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';

  const CSS = `
:host{all:initial}
*{box-sizing:border-box}
.ov{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,9,18,.62);backdrop-filter:blur(8px);font:14px/1.5 "IBM Plex Sans",Inter,"Segoe UI",system-ui,sans-serif;color:#e8edf3}
.modal{width:min(960px,100%);max-height:96vh;overflow:auto;border-radius:18px;padding:26px;background:linear-gradient(160deg,rgba(18,26,43,.9),rgba(10,15,27,.9));backdrop-filter:blur(26px) saturate(1.5);border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 90px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08)}
.mh{display:flex;gap:14px;align-items:flex-start;margin-bottom:18px}
.shield{flex:none;width:42px;height:42px;border-radius:11px;background:rgba(255,90,95,.14);border:1px solid rgba(255,90,95,.35);color:#ff7b80;display:grid;place-items:center}
h2{margin:0;font-size:21px;font-weight:600;letter-spacing:-.01em}
.sub{margin:3px 0 0;color:#93a1b3}.fname{font-family:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:#cfd8e3;word-break:break-all}
.local{margin-left:auto;flex:none;display:flex;align-items:center;gap:6px;font-size:12px;color:#7fd6b0;border:1px solid rgba(127,214,176,.3);background:rgba(52,195,143,.08);padding:4px 10px;border-radius:99px;white-space:nowrap}
.grid{display:grid;grid-template-columns:1.1fr 1fr;gap:20px}
@media(max-width:760px){.grid{grid-template-columns:1fr}.local{display:none}}
.summary{display:flex;align-items:center;gap:16px;padding:14px 16px;margin-bottom:12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09)}
.gauge{position:relative;width:78px;height:78px;flex:none}.gauge svg{transform:rotate(-90deg)}
.gauge b{position:absolute;inset:0;display:grid;place-items:center;font:600 22px "IBM Plex Mono",ui-monospace,monospace}
.lvl{font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:#93a1b3}.lvlname{font-size:19px;font-weight:600;margin:1px 0 2px}
.hi{--c:#ff5a5f}.md{--c:#f5a623}.lo{--c:#34c38f}.nn{--c:#7b8aa0}.ver{margin-right:auto;align-self:center;font-size:11.5px;color:#7b8aa0}
.lvlname{color:var(--c)}.summary p{margin:0;color:#aab7c6;font-size:13px}
.list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.f{display:grid;grid-template-columns:36px 1fr auto;gap:12px;align-items:start;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-left:3px solid var(--c)}
.ic{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
.f small{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8191a5}
.f b{display:block;font:500 13.5px "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;color:#f1f5f9;word-break:break-word}
.f span.d{display:block;font-size:12.5px;color:#93a1b3;margin-top:2px}
.chip{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:var(--c);border:1px solid color-mix(in srgb,var(--c) 45%,transparent);padding:2px 8px;border-radius:99px}
.rcol{display:flex;flex-direction:column;gap:12px;min-height:0}.rcol .mapbox{flex:1}
.alt{border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}
.alth{display:flex;justify-content:space-between;align-items:baseline;padding:9px 12px 6px}.alth span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8191a5}.alth b{font:500 13px "IBM Plex Mono",ui-monospace,monospace;color:#f5a623}
.alt svg{display:block;width:100%;height:auto;aspect-ratio:420/88}.alt p{margin:0;padding:8px 12px 10px;font-size:12.5px;color:#93a1b3}
.mapbox{border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#f2efe9;position:relative;min-height:300px;box-shadow:0 8px 30px rgba(0,0,0,.35)}
.mapbox svg{display:block;position:absolute;inset:0;width:100%;height:100%}
.ring{transform-box:fill-box;transform-origin:center;animation:ping 2.2s ease-out infinite}
@keyframes ping{from{transform:scale(.5);opacity:.6}to{transform:scale(2.2);opacity:0}}
@media(prefers-reduced-motion:reduce){.ring{animation:none}}
.mchip{position:absolute;left:10px;top:10px;background:#fff;color:#202124;border-radius:8px;padding:6px 10px;box-shadow:0 1px 4px rgba(0,0,0,.3);font-family:Roboto,Arial,sans-serif}
.mchip span{display:block;font-size:10.5px;color:#5f6368}.mchip b{font:500 12px "IBM Plex Mono",ui-monospace,monospace}
.mzoom{position:absolute;right:10px;top:10px;display:grid;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.3);overflow:hidden}
.mzoom i{font-style:normal;width:30px;height:30px;display:grid;place-items:center;color:#5f6368;font:300 20px Roboto,Arial,sans-serif}.mzoom i+i{border-top:1px solid #e6e6e6}
.mattr{position:absolute;right:0;bottom:0;background:rgba(255,255,255,.85);color:#5f6368;font:10px Roboto,Arial,sans-serif;padding:2px 8px;border-top-left-radius:6px}
.nomap{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:20px;color:#5f6368;font-family:Roboto,Arial,sans-serif}
.acts{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.09)}
button{font:inherit;font-weight:500;cursor:pointer;padding:11px 18px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#dbe3ec;display:inline-flex;align-items:center;gap:8px}
button:hover{background:rgba(255,255,255,.07)}
button:focus-visible{outline:2px solid #7fd6f5;outline-offset:2px}
.orig{color:#ff8a8f;border-color:rgba(255,90,95,.45)}.orig:hover{background:rgba(255,90,95,.1)}
.pri{background:#e8f6f1;border-color:#e8f6f1;color:#0a2a24;font-weight:600}.pri:hover{background:#fff}
@media(max-width:560px){button{flex:1 1 100%;justify-content:center}}`;

  let host = null, root = null, pending = null;
  function ensureUI() {
    if (host) return;
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;display:none';
    root = host.attachShadow({ mode: window.__MS_DEMO ? 'open' : 'closed' });
    root.innerHTML = `<style>${CSS}</style>
<div class="ov" role="dialog" aria-modal="true" aria-labelledby="mt"><div class="modal">
  <div class="mh"><div class="shield">${SHIELD}</div>
    <div><h2 id="mt">Hidden metadata detected</h2><p class="sub"><span class="fname" id="mf"></span><span id="more"></span> carries data you can't see.</p></div>
    <div class="local">${LOCK} Analysed on this device</div></div>
  <div class="grid"><div>
    <div class="summary" id="sum"><div class="gauge"><svg width="78" height="78" viewBox="0 0 78 78"><circle cx="39" cy="39" r="33" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="7"/><circle id="arc" cx="39" cy="39" r="33" fill="none" stroke="var(--c)" stroke-width="7" stroke-linecap="round" stroke-dasharray="0 208"/></svg><b id="rs"></b></div>
      <div><div class="lvl">Privacy risk</div><div class="lvlname" id="rl"></div><p id="rt"></p></div></div>
    <ul class="list" id="leaks"></ul></div>
  <div class="rcol"><div class="mapbox" id="map"></div><div id="altc"></div></div></div>
  <div class="acts"><span class="ver">MetaShield v0.2 &middot; altitude check on</span><button id="cancel">Cancel upload</button><button class="orig" id="orig">Upload original anyway</button><button class="pri" id="strip">${SHIELD.replace('width="22" height="22"', 'width="18" height="18"')} Strip metadata &amp; upload clean</button></div>
</div></div>`;
    (document.documentElement || document).appendChild(host);
    const $ = s => root.querySelector(s);
    $('#cancel').onclick = cancel;
    $('#orig').onclick = () => { const p = pending; hide(); release(p.input, p.all, {}); };
    $('#strip').onclick = async () => {
      const p = pending, map = {}, btn = $('#strip'), html = btn.innerHTML;
      btn.textContent = 'Removing metadata…';
      for (const x of p.found) map[x.file.name] = await stripFile(x.file);
      btn.innerHTML = html; hide(); release(p.input, p.all, map);
    };
    root.querySelector('.ov').addEventListener('click', e => { if (e.target.classList.contains('ov')) cancel(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && pending) cancel(); }, true);
  }
  const q = s => root.querySelector(s);
  function show() {
    ensureUI();
    const { found } = pending, { file, meta, a } = found[0];
    q('#mf').textContent = file.name;
    q('#more').textContent = found.length > 1 ? ` (+${found.length - 1} more)` : '';
    const lvl = a.score >= 70 ? ['hi', 'High risk', 'Anyone who receives this file can locate you.'] : a.score >= 35 ? ['md', 'Medium risk', 'Personal details are readable inside this file.'] : ['lo', 'Low risk', 'Minor technical details are embedded.'];
    q('#sum').className = 'summary ' + lvl[0]; q('#rl').textContent = lvl[1]; q('#rt').textContent = lvl[2];
    q('#rs').textContent = a.score; q('#arc').setAttribute('stroke-dasharray', `${(a.score / 100 * 207.3).toFixed(1)} 208`);
    const cls = { high: 'hi', med: 'md', low: 'lo', none: 'nn' }, name = { high: 'High', med: 'Medium', low: 'Low', none: 'None' };
    const rows = a.items.slice();
    if (!rows.some(x => x.label === 'Altitude')) {            // always show the altitude check, even when absent
      const at = rows.findIndex(x => x.label === 'Location') + 1;
      rows.splice(at, 0, { sev: 'none', ic: 'alt', label: 'Altitude', value: 'Not recorded in this file', why: 'This photo has no elevation data, so nothing is leaked here.' });
    }
    q('#leaks').innerHTML = rows.map(x => `<li class="f ${cls[x.sev]}"><div class="ic">${icon(x.ic)}</div><div><small>${x.label}</small><b>${esc(x.value)}</b><span class="d">${esc(x.why)}</span></div><span class="chip">${name[x.sev]}</span></li>`).join('');
    q('#map').innerHTML = bengaluruMapSvg(meta); q('#altc').innerHTML = altCard(meta);
    host.style.display = 'block'; q('#strip').focus({ preventScroll: true });
  }
  function hide() { host.style.display = 'none'; pending = null; }
  function cancel() { if (!pending) return; pending.input.value = ''; hide(); }

  /* ---------- strip + replace via DataTransfer ---------- */
  async function stripFile(file) {
    if (!/^image\//.test(file.type)) return file;           // TODO: PDF / DOCX sanitising
    const bmp = await createImageBitmap(file), c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise(r => c.toBlob(r, type, 0.92));
    return new File([blob], file.name, { type, lastModified: Date.now() });
  }
  function release(input, files, replacements) {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(replacements[f.name] || f));
    input.files = dt.files;
    input.__msPass = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.__msPass = false;
  }

  /* ---------- interception: capture phase runs before the site's handlers ---------- */
  document.addEventListener('change', async e => {
    const inp = e.target;
    if (!(inp instanceof HTMLInputElement) || inp.type !== 'file' || inp.__msPass) return;
    e.stopImmediatePropagation();
    const files = [...inp.files]; if (!files.length) return;
    const found = [];
    for (const f of files) {
      let meta = {};
      if (/jpe?g$/i.test(f.type) || /\.jpe?g$/i.test(f.name)) { try { meta = readExif(await f.arrayBuffer()); } catch (_) {} }
      const a = analyse(meta); if (a.items.length) found.push({ file: f, meta, a });
    }
    if (!found.length) return release(inp, files, {});      // nothing sensitive → continue normally
    pending = { input: inp, all: files, found }; show();
  }, true);
})();
