/* zulfatesnew — Quizizz/Wayground answer loader (bookmarklet)
 * Tempel ke bookmark dengan prefix "javascript:".
 *
 * Fitur:
 *   - Bypass proteksi (blur/focus/visibility/resize/fullscreen/contextmenu).
 *   - Spoof player state + block infraction/extension event.
 *   - Ambil kunci jawaban via quizit.online pakai Room Code (auto-detect).
 *   - Highlight + klik jawaban otomatis, auto-submit untuk multi-jawab.
 *   - Panel tema pink.
 */
(function () {
  "use strict";
  if (window.__zulfaTesLoaded) { window.__zulfaTesShow && window.__zulfaTesShow(); return; }
  window.__zulfaTesLoaded = true;

  /* ================= konfigurasi ================= */
  const BLOCKED_KEYS = ["playerExited", "playerResumed", "infractionType", "extensionDetected", "windowResizeDetected", "rightClickDetected", "pasteDetected"];
  const blockBody = (d) => typeof d === "string" && BLOCKED_KEYS.some((k) => d.includes(k));
  const STOP_EVENTS = ["visibilitychange", "blur", "mouseleave", "pagehide", "resize", "contextmenu", "copy", "paste", "fullscreenchange", "webkitfullscreenchange"];

  const _fetch = window.fetch;
  const _xhrSend = XMLHttpRequest.prototype.send;
  const _parse = JSON.parse;
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _addEvent = EventTarget.prototype.addEventListener;

  /* ================= storage ================= */
  const LS = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };

  /* ================= state ================= */
  const state = { answers: new Map(), lastQid: "", autoReady: false, qidTimer: null };
  const els = {};

  /* ================= helpers ================= */
  const clean = (t) => (t == null ? "" : String(t).replace(/<\/?p>/g, "").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim());
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const def = (o, p, v) => { try { const d = Object.getOwnPropertyDescriptor(o, p); if (!d || d.configurable !== false) Object.defineProperty(o, p, { get: () => v, configurable: true }); } catch {} };

  /* ================= hook jaringan (block + spoof state) ================= */
  function installHooks() {
    try {
      window.fetch = function (...a) {
        try { const body = a[1]?.body; if (blockBody(body)) return Promise.resolve(new Response('{"success":true}', { status: 200 })); } catch {}
        return _fetch.apply(this, a);
      };
    } catch {}
    try {
      XMLHttpRequest.prototype.send = function (b) {
        if (blockBody(b)) {
          try {
            Object.defineProperties(this, { readyState: { value: 4, configurable: true }, status: { value: 200, configurable: true } });
            this.onreadystatechange?.();
          } catch {}
          return;
        }
        return _xhrSend.apply(this, arguments);
      };
    } catch {}
    try {
      JSON.parse = function (...a) {
        const r = _parse.apply(this, a);
        if (r && r.type === "RN_APP_STATE_CHANGE" && r.value === "background") r.value = "foreground";
        return r;
      };
    } catch {}
  }

  /* ================= bypass event + spoof fullscreen/focus ================= */
  function installBypass() {
    const stop = (e) => { try { e.stopImmediatePropagation(); } catch {} };
    STOP_EVENTS.forEach((evt) => {
      try { window.addEventListener(evt, stop, true); } catch {}
      try { document.addEventListener(evt, stop, true); } catch {}
    });
    try {
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (STOP_EVENTS.includes(type)) return;
        return _addEvent.call(this, type, listener, options);
      };
    } catch {}
    const el = () => document.documentElement;
    for (const o of [Document.prototype, document]) {
      def(o, "visibilityState", "visible");
      def(o, "hidden", false);
      def(o, "fullscreenElement", el);
      def(o, "webkitFullscreenElement", el);
    }
    try { window.onblur = document.onblur = null; } catch {}
    try { document.hasFocus = () => true; } catch {}
    try {
      const style = document.createElement("style");
      style.textContent = "*{user-select:text!important;-webkit-user-select:text!important;-moz-user-select:text!important;-ms-user-select:text!important}";
      document.documentElement.appendChild(style);
    } catch {}
    try {
      window.addEventListener("keydown", (e) => {
        if (e.key === "F2") (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
      }, true);
    } catch {}
  }

  /* ================= panel UI (tema pink) ================= */
  const CSS = `
  #solver-panel{position:fixed!important;bottom:20px!important;left:20px!important;z-index:2147483647!important;padding:14px!important;background:linear-gradient(160deg,#fff1f6,#ffe3ef)!important;border:1px solid #ffc2dd!important;border-radius:18px!important;box-shadow:0 10px 30px rgba(255,105,160,.35)!important;min-width:280px!important;max-width:340px!important;font-family:'Segoe UI',Inter,system-ui,sans-serif!important}
  #solver-status{color:#7a3a56!important;font-size:14px!important;font-weight:600!important;margin-bottom:10px!important;transition:.3s!important;text-align:left!important;word-wrap:break-word!important;white-space:normal!important;line-height:1.5!important}
  #solver-status[data-kind="ok"]{color:#c0277d!important}
  #solver-status[data-kind="warn"]{color:#b8791a!important}
  #solver-status[data-kind="err"]{color:#d0284f!important}
  #pin-container{display:flex!important;gap:8px!important}
  #pin-input{flex:1!important;min-width:0!important;border:1px solid #ffc2dd!important;background:#fff!important;color:#7a3a56!important;border-radius:10px!important;padding:9px 12px!important;font-size:14px!important;outline:0!important;text-align:center!important;transition:.2s!important;box-sizing:border-box!important}
  #pin-input:focus{border-color:#ff6aa8!important;box-shadow:0 0 0 3px rgba(255,106,168,.18)!important}
  #load-btn{background:linear-gradient(135deg,#ff8fc0,#ff5fa2)!important;border:0!important;border-radius:10px!important;color:#fff!important;font-weight:700!important;padding:0 20px!important;cursor:pointer!important;transition:.2s!important;box-shadow:0 2px 8px rgba(255,95,162,.3)!important}
  #load-btn:hover{transform:scale(1.05)!important}
  #load-btn:disabled{cursor:not-allowed!important;background:#e6b7cd!important;box-shadow:none!important}
  .solver-ans-box{margin-top:6px!important;color:#b83280!important;font-weight:700!important;background:linear-gradient(135deg,#ffe3ef,#ffd0e6)!important;border:1px solid #ff9ecb!important;border-radius:10px!important;padding:7px 10px!important;line-height:1.5!important}
  #solver-fab{position:fixed!important;bottom:14px!important;left:14px!important;width:34px!important;height:34px!important;border-radius:50%!important;border:none!important;background:radial-gradient(circle at 35% 30%,#ffb3d4,#ff5fa2)!important;opacity:.85!important;padding:0!important;cursor:pointer!important;z-index:2147483647!important;box-shadow:0 4px 14px rgba(255,95,162,.45)!important;transition:opacity .15s,transform .15s!important;display:none!important}
  #solver-fab:hover{opacity:1!important;transform:scale(1.15)!important}
  `;
  function injectCSS() {
    if (document.getElementById("solver-style")) return;
    const s = document.createElement("style");
    s.id = "solver-style";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function buildUI() {
    if ($("#solver-panel")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div id="solver-panel">
        <div id="solver-status">🔎 Mencari Room Code…</div>
        <div id="pin-container">
          <input type="text" id="pin-input" placeholder="Room Code / PIN" />
          <button id="load-btn" type="button">Muat</button>
        </div>
      </div>`);
    const fab = document.createElement("button");
    fab.id = "solver-fab";
    fab.title = "zulfatesnew (Alt+J)";
    document.documentElement.appendChild(fab);
    bindUI();
  }

  function bindUI() {
    els.panel = $("#solver-panel");
    els.status = $("#solver-status");
    els.input = $("#pin-input");
    els.btn = $("#load-btn");
    els.pinBox = $("#pin-container");
    els.fab = $("#solver-fab");

    const handleLoad = async () => {
      const pin = (els.input.value || "").trim().replace(/\s/g, "");
      if (!pin) return;
      els.btn.disabled = els.input.disabled = true;
      if (await fetchAnswers(pin)) {
        els.pinBox.style.display = "none";
        setStatus("Siap! Menunggu soal…", "ok");
        state.autoReady = true;
        startObserver();
      } else {
        els.btn.disabled = els.input.disabled = false;
      }
    };
    els.btn.onclick = handleLoad;
    els.input.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLoad(); });

    els.fab.onclick = () => showPanel();
    document.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        if (els.panel && els.panel.style.getPropertyValue("display") === "none") showPanel(); else hidePanel();
      }
    }, true);

    const saved = LS.get("zulfa_tes_pin");
    if (saved) els.input.value = saved;

    const finder = setInterval(() => {
      const pin = findGamePin();
      if (pin) {
        clearInterval(finder);
        els.input.value = pin;
        setStatus("Room Code ditemukan", "ok");
        setTimeout(handleLoad, 500);
      }
    }, 1000);
    setTimeout(() => clearInterval(finder), 20000);
  }

  function showPanel() { if (els.panel) els.panel.style.setProperty("display", "block", "important"); if (els.fab) els.fab.style.setProperty("display", "none", "important"); }
  function hidePanel() { if (els.panel) els.panel.style.setProperty("display", "none", "important"); if (els.fab) els.fab.style.setProperty("display", "block", "important"); }
  window.__zulfaTesShow = showPanel;

  function setStatus(text, kind = "") { if (!els.status) return; els.status.textContent = text; els.status.dataset.kind = kind; }

  /* ================= deteksi & fetch PIN ================= */
  function findGamePin() {
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const m = node.nodeValue.trim().match(/\b(\d{4})\s(\d{4})\b/);
        if (m && node.parentElement && node.parentElement.offsetParent !== null) return m[0].replace(/\s/g, "");
      }
    } catch {}
    return null;
  }

  async function fetchAnswers(pin) {
    setStatus("Memuat kunci jawaban…", "");
    try {
      const res = await _fetch(`https://api.quizit.online/quizizz/bot?pin=${encodeURIComponent(pin)}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const list = data.answers || data.data?.answers;
      if (!list?.length) throw new Error("kunci kosong dari API");
      state.answers.clear();
      for (const item of list) {
        const id = item.id || item._id;
        if (!id) continue;
        if (item.type === "OPEN") { state.answers.set(id, "Tulis jawaban manual"); continue; }
        if (item.type === "MSQ" && Array.isArray(item.answers)) {
          const ans = item.answers.map((a) => clean(a.text)).filter(Boolean);
          if (ans.length) state.answers.set(id, ans);
        } else {
          const ans = clean(item.answers?.[0]?.text);
          if (ans) state.answers.set(id, ans);
        }
      }
      if (!state.answers.size) throw new Error("kunci kosong");
      LS.set("zulfa_tes_pin", pin);
      return true;
    } catch (e) {
      setStatus(`Gagal: ${e.message}`, "err");
      return false;
    }
  }

  /* ================= baca soal & jawab ================= */
  function getQuestion() {
    const container = $("[data-quesid]");
    if (!container) return null;
    const qid = container.dataset.quesid;
    const options = $$(".option.is-selectable, .option").map((el) => ({
      text: clean(el.querySelector(".option-text-inner, .text-container, .option-text")?.innerText || el.innerText),
      element: el,
    })).filter((o) => o.text);
    if (options.length) return { qid, type: "CHOICE", options };
    if ($('input.question-input, textarea.question-input, input[type="text"], textarea')) return { qid, type: "BLANK" };
    return null;
  }

  function autoSubmit() {
    clearTimeout(state.qidTimer);
    state.qidTimer = setTimeout(() => {
      const btn = $$("button").find((b) => b.innerText.trim().toLowerCase() === "submit")
        || $(".submit-button-wrapper button, button.submit-btn");
      if (btn && !btn.disabled) btn.click();
    }, 350);
  }

  function solve(answer, q) {
    if (q.type === "CHOICE") {
      const targets = Array.isArray(answer) ? answer : [answer];
      targets.forEach((t) => {
        const opt = q.options.find((o) => o.text === t);
        if (opt) { opt.element.style.border = "4px solid #00FF00"; opt.element.click(); }
      });
      if (Array.isArray(answer)) autoSubmit();
    } else if (q.type === "BLANK") {
      const input = $('input.question-input, textarea.question-input, input[type="text"], textarea');
      if (input) {
        input.value = answer;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        autoSubmit();
      }
    }
  }

  function mainSolver() {
    if (!state.answers.size) return;
    const q = getQuestion();
    if (!q?.qid) return;
    const ans = state.answers.get(q.qid);
    if (!ans) { setStatus("Jawaban tidak ditemukan untuk soal ini", "warn"); return; }
    const display = Array.isArray(ans) ? ans.map(esc).join("<br>") : esc(ans);
    els.status.innerHTML = `Jawaban:<div class="solver-ans-box">${display}</div>`;
    els.status.dataset.kind = "ok";
    if (typeof ans === "string" && ans.startsWith("Tulis jawaban")) return;
    solve(ans, q);
  }

  function startObserver() {
    if (state.observer) return;
    state.observer = new MutationObserver(() => {
      const qid = $("[data-quesid]")?.dataset.quesid;
      if (qid && qid !== state.lastQid) {
        state.lastQid = qid;
        setTimeout(mainSolver, 500);
      }
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ================= init ================= */
  function boot() {
    injectCSS();
    buildUI();
    installHooks();
    installBypass();
    console.log("%c[zulfatesnew] ready", "color:#ff5fa2;font-weight:bold");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 500)); else setTimeout(boot, 500);
})();
