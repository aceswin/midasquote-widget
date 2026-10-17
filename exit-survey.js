/**
 * MidasQuote - exit survey popup (for midasquote.com)
 *
 * A small "Thanks for visiting - what stopped you?" popup shown to visitors who
 * are about to leave without signing up. The answer is emailed to Jordan through
 * the email Worker's /exit-survey route (the recipient lives in the Worker, never
 * in this file). Nothing is stored in a database.
 *
 * HOW TO INSTALL: in Webflow -> Site settings -> Custom code -> "Footer code":
 *   <script src="https://widget.midasquote.com/exit-survey.js" defer></script>
 *
 * WHEN IT SHOWS (all must be true):
 *   - top-level page (not inside an iframe, e.g. the embedded showroom)
 *   - not a login / signup / dashboard / checkout style page
 *   - visitor is NOT a logged-in Memberstack member
 *   - visitor hasn't answered/dismissed it in the last 30 days (remembered in this browser)
 *   - visitor hasn't started signing up / checking out this visit
 *   - at least ~6 seconds on the page
 *   - and one of these "about to leave" signals fires, once per page view:
 *       desktop: mouse leaves through the top of the window (heading for tabs/close/back)
 *       phone:   a fast scroll back toward the top after reading, or ~40s of no activity
 *
 * TESTING:  add ?mq_survey=force to the page URL - it ignores the 30-day memory,
 *           the member check and the 6-second rule, and pops up after ~1 second.
 *           ?mq_survey=off disables it for that visit.
 *
 * Everything is drawn inside a Shadow DOM so Webflow's own CSS can't restyle it.
 */
(function () {
  'use strict';
  if (window.__mqExitSurvey) return;
  window.__mqExitSurvey = true;
  if (window.self !== window.top) return; // never inside an iframe

  var CFG = {
    ENDPOINT: 'https://midasquote-email.jordan132001.workers.dev/exit-survey',
    COOLDOWN_DAYS: 30,
    MIN_SECONDS: 6,
    IDLE_SECONDS: 40,
    SKIP_PATHS: /^\/(log-?in|sign-?up|forgot|reset|account|dashboard|checkout|thank|success|welcome|members?)\b/i,
  };
  try { var o = window.MQ_EXIT_SURVEY; if (o) for (var k in o) CFG[k] = o[k]; } catch (e) {}

  var qs = new URLSearchParams(location.search);
  var MODE = (qs.get('mq_survey') || '').toLowerCase(); // 'force' | 'off' | ''
  if (MODE === 'off') return;
  if (MODE !== 'force' && CFG.SKIP_PATHS.test(location.pathname)) return;

  var STORE_KEY = 'mq_exit_survey_v1';
  var startedAt = Date.now();
  var shown = false;

  // -- tiny safe storage helpers (Safari private mode etc. can throw) --
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  function inCooldown() {
    var raw = lsGet(STORE_KEY);
    if (!raw) return false;
    try {
      var d = JSON.parse(raw);
      return d && d.t && (Date.now() - d.t) < CFG.COOLDOWN_DAYS * 86400000;
    } catch (e) { return false; }
  }
  function remember(state) { lsSet(STORE_KEY, JSON.stringify({ t: Date.now(), s: state })); }

  // -- first-touch traffic source, kept for the whole visit --
  function captureSource() {
    var existing = ssGet('mq_es_src');
    if (existing) { try { return JSON.parse(existing); } catch (e) {} }
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) {}
    if (ref && ref === location.hostname.replace(/^www\./, '')) ref = '';
    var ua = navigator.userAgent || '';
    var src = {
      utm_source: (qs.get('utm_source') || '').slice(0, 80),
      utm_medium: (qs.get('utm_medium') || '').slice(0, 80),
      utm_campaign: (qs.get('utm_campaign') || '').slice(0, 120),
      fbclid: !!qs.get('fbclid'),
      referrer: ref.slice(0, 120),
      landing: location.pathname.slice(0, 160),
      inApp: /FBAN|FBAV|FB_IAB/i.test(ua) ? 'facebook' : (/Instagram/i.test(ua) ? 'instagram' : ''),
    };
    ssSet('mq_es_src', JSON.stringify(src));
    return src;
  }
  var SOURCE = captureSource();

  // -- "this visitor is already converting" flag --
  var CONVERT_SEL = '[data-ms-modal],[data-ms-price\\:add],[data-ms-plan\\:add],a[href*="signup" i],a[href*="sign-up" i],a[href*="checkout" i],a[href*="get-started" i]';
  document.addEventListener('click', function (e) {
    try { if (e.target && e.target.closest && e.target.closest(CONVERT_SEL)) ssSet('mq_es_converting', '1'); } catch (err) {}
  }, true);

  // -- logged-in member check (async; API first, stored session as fallback) --
  function isMember() {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      try {
        if (window.$memberstackDom && typeof window.$memberstackDom.getCurrentMember === 'function') {
          setTimeout(function () { finish(false); }, 1500);
          window.$memberstackDom.getCurrentMember().then(function (r) { finish(!!(r && r.data)); }, function () { finish(false); });
          return;
        }
      } catch (e) {}
      finish(!!lsGet('_ms-mem'));
    });
  }

  // -- decide whether we may show right now --
  function trigger(kind) {
    if (shown) return;
    if (MODE !== 'force') {
      if ((Date.now() - startedAt) < CFG.MIN_SECONDS * 1000) return;
      if (inCooldown()) return;
      if (ssGet('mq_es_converting')) return;
    }
    shown = true; // claim it now so a second trigger can't double-fire while we check membership
    if (MODE === 'force') return show(kind);
    isMember().then(function (member) { if (member) { shown = true; return; } show(kind); });
  }

  // -- triggers --
  var finePointer = false;
  try { finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}

  if (finePointer) {
    // desktop: cursor leaves through the TOP edge of the window
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget && e.clientY <= 0) trigger('exit-intent');
    });
  } else {
    // phone / tablet: fast scroll back up after reading, or long inactivity
    var lastY = window.scrollY, maxY = window.scrollY, upDist = 0, upStart = 0;
    window.addEventListener('scroll', function () {
      var y = window.scrollY, now = Date.now();
      if (y > maxY) maxY = y;
      if (y < lastY) {
        if (!upStart || now - upStart > 700) { upStart = now; upDist = 0; }
        upDist += lastY - y;
        var vh = window.innerHeight || 600;
        if (upDist > vh * 0.5 && maxY > vh * 0.6) trigger('scroll-up');
      } else { upDist = 0; upStart = 0; }
      lastY = y;
      bump();
    }, { passive: true });

    var idleTimer = null;
    function bump() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { if (!document.hidden) trigger('idle'); }, CFG.IDLE_SECONDS * 1000);
    }
    ['touchstart', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, bump, { passive: true }); });
    bump();
  }

  if (MODE === 'force') setTimeout(function () { trigger('forced'); }, 1000);

  // -- the popup --
  var REASONS = [
    ['not_shop', "I'm not a cabinet or countertop shop"],
    ['too_expensive', 'MidasQuote is too expensive'],
    ['confusing', "It doesn't make sense / I don't get what it does"],
    ['just_looking', 'Just looking / not ready yet'],
    ['have_question', 'I have a question'],
    ['other', 'Something else'],
  ];

  var CSS = '' +
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif}' +
    '.veil{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(14,14,14,.48);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;transition:opacity .22s ease}' +
    '.veil.in{opacity:1}' +
    '.card{position:relative;width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#1a1917;border-radius:18px;padding:28px 26px 22px;box-shadow:0 2px 6px rgba(0,0,0,.08),0 30px 80px -10px rgba(0,0,0,.45);transform:translateY(14px) scale(.98);transition:transform .28s cubic-bezier(.2,.7,.2,1);outline:none}' +
    '.veil.in .card{transform:none}' +
    '.x{position:absolute;top:10px;right:10px;width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:#6b7280;font-size:22px;line-height:1;cursor:pointer}' +
    '.x:hover{background:#f3f4f6;color:#111}' +
    '.eyebrow{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#9e9b92;margin-bottom:8px}' +
    'h2{font-size:21px;line-height:1.25;font-weight:650;letter-spacing:-.01em;margin:0 0 6px}' +
    '.sub{font-size:14px;line-height:1.55;color:#5c5a54;margin:0 0 16px}' +
    '.opts{display:flex;flex-direction:column;gap:8px;margin:0 0 14px;border:0;padding:0}' +
    '.opt{display:flex;align-items:center;gap:11px;padding:12px 14px;border:1px solid #e2e0d9;border-radius:11px;cursor:pointer;font-size:14px;line-height:1.35;color:#1a1917;transition:border-color .12s,background .12s,box-shadow .12s;-webkit-tap-highlight-color:transparent}' +
    '.opt:hover{border-color:#9e9b92}' +
    '.opt input{position:absolute;opacity:0;pointer-events:none}' +
    '.dot{flex:0 0 18px;height:18px;border-radius:50%;border:1.5px solid #cfccc3;display:inline-block;position:relative;transition:border-color .12s}' +
    '.opt.sel{border-color:#1a1a1a;background:#fafaf8;box-shadow:0 0 0 1px #1a1a1a}' +
    '.opt.sel .dot{border-color:#1a1a1a}' +
    '.opt.sel .dot::after{content:"";position:absolute;inset:3px;border-radius:50%;background:#1a1a1a}' +
    '.opt:focus-within{box-shadow:0 0 0 2px rgba(26,26,26,.35)}' +
    '.more{display:none;margin:0 0 14px}' +
    '.more.on{display:block}' +
    'textarea,input[type=email]{width:100%;font-size:14px;line-height:1.45;border:1px solid #e2e0d9;border-radius:10px;padding:10px 12px;color:#1a1917;background:#fff;resize:vertical}' +
    'textarea{min-height:68px;margin-bottom:8px}' +
    'textarea:focus,input[type=email]:focus{outline:none;border-color:#1a1a1a}' +
    '.hint{font-size:12px;color:#9e9b92;margin:0 0 6px}' +
    '.row{display:flex;align-items:center;gap:10px;margin-top:4px}' +
    '.go{flex:1;border:0;border-radius:11px;background:#1a1a1a;color:#fff;font-size:14.5px;font-weight:600;padding:13px 16px;cursor:pointer;transition:opacity .15s}' +
    '.go:disabled{opacity:.35;cursor:not-allowed}' +
    '.go:not(:disabled):hover{opacity:.88}' +
    '.no{border:0;background:transparent;color:#6b7280;font-size:13.5px;padding:10px 6px;cursor:pointer}' +
    '.no:hover{color:#111}' +
    '.thanks{text-align:center;padding:18px 0 8px}' +
    '.tick{width:46px;height:46px;border-radius:50%;background:#1a1a1a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 14px}' +
    '.qonly{display:none}.qonly.on{display:block}' +
    '.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
    '@media (max-width:600px){.veil{align-items:flex-end;padding:0}.card{max-width:none;border-radius:20px 20px 0 0;padding:26px 20px calc(20px + env(safe-area-inset-bottom));max-height:92vh;transform:translateY(40px)}}' +
    '@media (prefers-reduced-motion:reduce){.veil,.card{transition:none}}';

  function show(kind) {
    var host = document.createElement('div');
    host.id = 'mq-exit-survey';
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var opts = REASONS.map(function (r) {
      return '<label class="opt"><input type="radio" name="why" value="' + r[0] + '"><span class="dot"></span><span>' + r[1] + '</span></label>';
    }).join('');
    root.innerHTML =
      '<style>' + CSS + '</style>' +
      '<div class="veil" role="presentation"><div class="card" role="dialog" aria-modal="true" aria-labelledby="mqes-t" tabindex="-1">' +
        '<button class="x" type="button" aria-label="Close">\u00d7</button>' +
        '<div id="mqes-form">' +
          '<div class="eyebrow">Thanks for visiting</div>' +
          '<h2 id="mqes-t">Help us improve \u2014 what stopped you today?</h2>' +
          '<p class="sub">Ten seconds, one tap. It tells us what to fix.</p>' +
          '<fieldset class="opts" role="radiogroup" aria-label="Reason for leaving">' + opts + '</fieldset>' +
          '<div class="more" id="mqes-more">' +
            '<textarea id="mqes-c" maxlength="1000" placeholder="Anything you\'d like to add? (optional)"></textarea>' +
            '<div class="qonly" id="mqes-q">' +
              '<p class="hint">Where should we send the answer?</p>' +
              '<input type="email" id="mqes-e" maxlength="200" placeholder="you@example.com" autocomplete="email">' +
            '</div>' +
            '<input class="hp" type="text" id="mqes-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '</div>' +
          '<div class="row"><button class="go" id="mqes-go" type="button" disabled>Send feedback</button><button class="no" id="mqes-no" type="button">No thanks</button></div>' +
        '</div>' +
        '<div class="thanks" id="mqes-thanks" style="display:none"><div class="tick">\u2713</div><h2>Thank you</h2><p class="sub" id="mqes-thanks-sub" style="margin:0">That really helps us make MidasQuote better.</p></div>' +
      '</div></div>';
    document.body.appendChild(host);

    var $ = function (id) { return root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); };
    var veil = root.querySelector('.veil'), card = root.querySelector('.card');
    var go = $('mqes-go'), more = $('mqes-more'), comment = $('mqes-c'), qBox = $('mqes-q'), emailEl = $('mqes-e');
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var chosen = '';
    var prevFocus = document.activeElement;
    requestAnimationFrame(function () { requestAnimationFrame(function () { veil.classList.add('in'); card.focus(); }); });

    function close(state) {
      if (state) remember(state);
      veil.classList.remove('in');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) {} }, 260);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close('dismissed'); }
    }
    document.addEventListener('keydown', onKey, true);

    // Email is ONLY ever asked for under "I have a question" (so we can answer it).
    // Every other choice is anonymous: no email box, no mention of email.
    function refresh() {
      var ok;
      if (chosen === 'have_question') ok = comment.value.trim().length > 0 && EMAIL_RE.test(emailEl.value.trim());
      else ok = !!chosen || (comment.value.trim().length > 0);
      go.disabled = !ok;
    }
    Array.prototype.forEach.call(root.querySelectorAll('.opt'), function (lab) {
      lab.addEventListener('click', function () {
        var inp = lab.querySelector('input');
        chosen = inp.value;
        Array.prototype.forEach.call(root.querySelectorAll('.opt'), function (l) { l.classList.toggle('sel', l === lab); });
        more.classList.add('on');
        var isQ = chosen === 'have_question';
        qBox.classList.toggle('on', isQ);
        if (!isQ) emailEl.value = ''; // never carry an email over to a non-question answer
        comment.placeholder = isQ ? "What's your question?" : (chosen === 'other' ? "Tell us what's on your mind" : "Anything you'd like to add? (optional)");
        refresh();
        if (isQ || chosen === 'other') setTimeout(function () { comment.focus(); }, 30);
      });
    });
    comment.addEventListener('input', refresh);
    emailEl.addEventListener('input', refresh);
    veil.addEventListener('mousedown', function (e) { if (e.target === veil) close('dismissed'); });
    root.querySelector('.x').addEventListener('click', function () { close('dismissed'); });
    $('mqes-no').addEventListener('click', function () { close('dismissed'); });

    go.addEventListener('click', function () {
      if (go.disabled) return;
      go.disabled = true; go.textContent = 'Sending\u2026';
      var isQuestion = chosen === 'have_question';
      var email = isQuestion ? emailEl.value.trim() : '';
      var payload = {
        reason: chosen || 'other',
        comment: comment.value.trim().slice(0, 1000),
        email: EMAIL_RE.test(email) ? email : '',
        hp: $('mqes-hp').value,
        trigger: kind,
        page: location.pathname.slice(0, 160),
        landing: SOURCE.landing,
        referrer: SOURCE.referrer,
        utm_source: SOURCE.utm_source, utm_medium: SOURCE.utm_medium, utm_campaign: SOURCE.utm_campaign,
        fbclid: SOURCE.fbclid, inApp: SOURCE.inApp,
        device: finePointer ? 'desktop' : 'mobile',
        viewport: (window.innerWidth || 0) + 'x' + (window.innerHeight || 0),
        seconds: Math.round((Date.now() - startedAt) / 1000),
        lang: (navigator.language || '').slice(0, 20),
        tz: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })(),
      };
      remember('answered');
      // text/plain keeps this a "simple" request (no CORS preflight); keepalive lets it finish even if they leave
      try {
        fetch(CFG.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload), keepalive: true }).catch(function () {});
      } catch (e) {}
      if (isQuestion) $('mqes-thanks-sub').textContent = "Got it \u2014 we'll reply to your email soon.";
      $('mqes-form').style.display = 'none';
      $('mqes-thanks').style.display = 'block';
      setTimeout(function () { close(); }, 2400);
    });
  }
})();