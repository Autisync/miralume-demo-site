/*!
 * motion.js: the animation layer for the Miralume Homes demo site.
 * Vanilla JS, no libraries. Loaded in <head> (not deferred) so it can mark
 * <html class="mo"> before first paint; it never touches booking, enquiry,
 * language or tracking code, and switches itself off with
 * prefers-reduced-motion or on any error. Styles: motion.css.
 */
(function () {
  /* ── Motion core: the same small engine on every demo site ──────────────
     Progressive enhancement: this file runs in <head>. Only when the browser
     can animate (and the visitor has not asked for reduced motion) does it add
     .mo to <html>, and only then is anything hidden-until-revealed. Without JS,
     with reduced motion, or if anything here throws, the page is the page. */
  'use strict';
  var doc = document, root = doc.documentElement, W = window;
  var mm = function (q) { try { return W.matchMedia(q).matches; } catch (e) { return false; } };
  var REDUCE = mm('(prefers-reduced-motion: reduce)');
  var CAN = 'IntersectionObserver' in W && 'requestAnimationFrame' in W && typeof Element !== 'undefined' &&
    'animate' in Element.prototype && W.CSS && CSS.supports && CSS.supports('translate', '1px') && CSS.supports('clip-path', 'inset(0)');
  var ON = !!(CAN && !REDUCE);
  var FINE = mm('(hover: hover) and (pointer: fine)');
  var EASE = 'cubic-bezier(.16, 1, .3, 1)';      // expo out: fast, then a long settle
  var EASE_IO = 'cubic-bezier(.65, 0, .35, 1)';  // in-out for travelling things
  var SPRING = 'cubic-bezier(.34, 1.56, .64, 1)'; // a little overshoot
  var inited = false;
  var SVGNS = 'http://www.w3.org/2000/svg';

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function outExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function inOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function svg(markup) {
    var t = doc.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstElementChild;
  }

  /* Reveal variants: keyframes for the Web Animations API. They use the
     individual translate / scale / rotate properties and clip-path, so they
     never fight a site's own `transform` hovers or `transition` lists. */
  var V = {
    rise: [{ opacity: 0, translate: '0 42px' }, { opacity: 1, translate: '0 0' }],
    riseSm: [{ opacity: 0, translate: '0 18px' }, { opacity: 1, translate: '0 0' }],
    fade: [{ opacity: 0 }, { opacity: 1 }],
    left: [{ opacity: 0, translate: '-56px 0' }, { opacity: 1, translate: '0 0' }],
    right: [{ opacity: 0, translate: '56px 0' }, { opacity: 1, translate: '0 0' }],
    zoom: [{ opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 }],
    pop: [{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }],
    blur: [{ opacity: 0, filter: 'blur(14px)', translate: '0 14px' }, { opacity: 1, filter: 'blur(0px)', translate: '0 0' }],
    tilt: [{ opacity: 0, translate: '0 64px', rotate: '-2.5deg' }, { opacity: 1, translate: '0 0', rotate: '0deg' }],
    tiltR: [{ opacity: 0, translate: '0 64px', rotate: '2.5deg' }, { opacity: 1, translate: '0 0', rotate: '0deg' }],
    wipe: [{ opacity: 1, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0)' }],
    wipeL: [{ opacity: 1, clipPath: 'inset(0 0 0 100%)' }, { opacity: 1, clipPath: 'inset(0 0 0 0%)' }],
    wipeUp: [{ opacity: 1, clipPath: 'inset(100% 0 0 0)', translate: '0 24px' }, { opacity: 1, clipPath: 'inset(0% 0 0 0)', translate: '0 0' }],
    wipeDown: [{ opacity: 1, clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, clipPath: 'inset(0 0 0% 0)' }],
    curtain: [{ opacity: 1, clipPath: 'inset(10% 10% 10% 10% round 28px)', scale: 1.06 }, { opacity: 1, clipPath: 'inset(0% 0% 0% 0% round 0px)', scale: 1 }],
    iris: [{ opacity: 1, clipPath: 'circle(0% at 50% 50%)' }, { opacity: 1, clipPath: 'circle(75% at 50% 50%)' }],
  };

  /* ── Reveal on scroll ── */
  var io = null;
  function reveal(el, v, delay, dur) {
    if (!el || el.__moDone) return null;
    el.__moDone = true;
    el.classList.add('mo-in');
    var kf = typeof v === 'function' ? v(el) : (V[v] || V.rise);
    var a = null;
    try { a = el.animate(kf, { duration: dur || 1000, delay: delay || 0, easing: EASE, fill: 'backwards' }); } catch (e) { /* shown anyway */ }
    if (el.__moThen) { try { el.__moThen(el, delay || 0); } catch (e) { /* decoration only */ } }
    return a;
  }
  function watch(el, v, opts) {
    opts = opts || {};
    if (!el || el.__moWatched) return;
    el.__moWatched = true;
    el.__moV = v; el.__moDelay = opts.delay || 0; el.__moDur = opts.dur; el.__moStagger = opts.stagger == null ? 90 : opts.stagger;
    if (opts.then) el.__moThen = opts.then;
    if (io) io.observe(el); else reveal(el, v);
  }
  function startIO() {
    io = new IntersectionObserver(function (entries) {
      var hits = entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { return e.target; });
      hits.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
      var n = 0;
      hits.forEach(function (el) {
        io.unobserve(el);
        reveal(el, el.__moV, el.__moDelay + n * el.__moStagger, el.__moDur);
        n++;
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  }

  /* ── Words: a headline rises word by word, each from behind its own mask.
     The spans stay (no reflow at the end); a language switch that rewrites
     the element simply drops them. ── */
  function splitWords(el) {
    var words = [];
    var walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (!/\S/.test(node.nodeValue)) return;
      var frag = doc.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); return; }
        var w = doc.createElement('span'); w.className = 'mo-w';
        var i = doc.createElement('span'); i.className = 'mo-wi'; i.textContent = part;
        w.appendChild(i); frag.appendChild(w); words.push(i);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return words;
  }
  function words(el, delay, step) {
    if (!el) return 0;
    var ws = splitWords(el);
    el.classList.add('mo-in');
    el.__moDone = true;
    ws.forEach(function (w, i) {
      w.animate([{ translate: '0 115%', rotate: '4deg' }, { translate: '0 0', rotate: '0deg' }],
        { duration: 1100, delay: delay + i * (step || 70), easing: EASE, fill: 'backwards' });
    });
    var end = delay + ws.length * (step || 70) + 1100;
    setTimeout(function () { el.classList.add('mo-wdone'); }, end);
    return end;
  }

  /* ── Counters: the first number in an element counts up to itself. Only
     that text node changes, and it always ends on the exact original text.
     If anything else rewrites it meanwhile (a language switch), we stop. ── */
  function count(el, dur, delay) {
    if (!el || el.__moCounted) return;
    el.__moCounted = true;
    var walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), node = null;
    while (walker.nextNode()) { if (/\d/.test(walker.currentNode.nodeValue)) { node = walker.currentNode; break; } }
    if (!node) return;
    var orig = node.nodeValue;
    var m = orig.match(/\d[\d.,]*/);
    if (!m) return;
    var tok = m[0].replace(/[.,]$/, '');
    var thou = /^\d{1,3}([.,]\d{3})+$/.test(tok) ? tok.charAt(tok.search(/[.,]/)) : '';
    var dec = !thou && /[.,]/.test(tok) ? tok.charAt(tok.search(/[.,]/)) : '';
    var digits = dec ? tok.split(dec)[1].length : 0;
    var target = parseFloat(thou ? tok.split(thou).join('') : dec ? tok.replace(dec, '.') : tok);
    if (!isFinite(target) || target === 0) return;
    var pre = orig.slice(0, m.index), post = orig.slice(m.index + tok.length);
    function fmt(v) {
      var s = v.toFixed(digits);
      if (dec) s = s.replace('.', dec);
      if (thou) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, thou);
      return pre + s + post;
    }
    var last = fmt(0), t0 = null;
    node.nodeValue = last;
    dur = dur || 1400;
    function step(t) {
      if (!node.isConnected || node.nodeValue !== last) return; // someone else wrote here
      if (t0 === null) t0 = t + (delay || 0);
      var p = clamp((t - t0) / dur, 0, 1);
      last = p >= 1 ? orig : fmt(target * outExpo(p));
      node.nodeValue = last;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ── Scroll-linked work, batched into one rAF per frame ── */
  var scrollFns = [], ticking = false;
  function onScroll(fn) { scrollFns.push(fn); }
  function tick() {
    ticking = false;
    var vh = W.innerHeight || root.clientHeight, vw = root.clientWidth;
    for (var i = 0; i < scrollFns.length; i++) { try { scrollFns[i](vh, vw); } catch (e) { /* keep the others going */ } }
  }
  function kick() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }
  /** 0 when the element's top is at a·vh, 1 when it is at b·vh. */
  function enter(el, a, b, vh) { var r = el.getBoundingClientRect(); return clamp((vh * a - r.top) / (vh * (a - b)), 0, 1); }
  /** 0 when the element enters at the bottom, 1 when it leaves at the top. */
  function through(el, vh) { var r = el.getBoundingClientRect(); return clamp((vh - r.top) / (vh + r.height), 0, 1); }
  function visible(el, vh) { var r = el.getBoundingClientRect(); return r.bottom > -80 && r.top < vh + 80; }

  /* A band (usually a dark section) that opens out to full width as it comes in. */
  function band(el) {
    if (!el) return;
    onScroll(function (vh, vw) {
      var p = enter(el, 1.02, 0.55, vh);
      if (p >= 1) { if (el.style.clipPath) el.style.clipPath = ''; return; }
      var m = (1 - outExpo(p)) * Math.min(56, vw * 0.03), r = (1 - p) * 36;
      el.style.clipPath = 'inset(0 ' + m.toFixed(1) + 'px round ' + r.toFixed(1) + 'px)';
    });
  }

  /* Parallax: moves an element by `k` px per px its parent scrolls. */
  function parallax(el, k, ref) {
    if (!el) return;
    ref = ref || el.parentElement || el;
    onScroll(function (vh) {
      if (!visible(ref, vh)) return;
      var r = ref.getBoundingClientRect();
      var c = r.top + r.height / 2 - vh / 2;
      el.style.translate = '0 ' + (-c * k).toFixed(1) + 'px';
    });
  }

  /* ── Smooth, eased anchor scrolling that respects the sticky header ── */
  function headerOffset() {
    var sp = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    var h = 0;
    $$('header, .nav, .top').forEach(function (el) {
      var cs = getComputedStyle(el);
      if (cs.position === 'sticky' || cs.position === 'fixed') h = Math.max(h, el.offsetHeight);
    });
    return Math.max(sp, h + 12);
  }
  var scrollAnim = null;
  function scrollToY(y, cb) {
    var start = W.scrollY, dist = y - start, t0 = null;
    var dur = clamp(Math.abs(dist) * 0.45, 450, 1150);
    var prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    var stop = function () { scrollAnim = null; root.style.scrollBehavior = prev; W.removeEventListener('wheel', stop); W.removeEventListener('touchstart', stop); };
    W.addEventListener('wheel', stop, { passive: true });
    W.addEventListener('touchstart', stop, { passive: true });
    var id = {};
    scrollAnim = id;
    function step(t) {
      if (scrollAnim !== id) return;
      if (t0 === null) t0 = t;
      var p = clamp((t - t0) / dur, 0, 1);
      W.scrollTo(0, start + dist * inOut(p));
      if (p < 1) requestAnimationFrame(step); else { stop(); if (cb) cb(); }
    }
    requestAnimationFrame(step);
  }
  function smoothAnchors() {
    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (!a || a.target === '_blank') return;
      var url;
      try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
      var id = decodeURIComponent(url.hash.slice(1));
      if (!id) return;
      var target = doc.getElementById(id);
      if (!target) return;
      e.preventDefault();
      var y = target.getBoundingClientRect().top + W.scrollY - headerOffset();
      scrollToY(Math.max(0, y), function () {
        try { history.pushState(null, '', '#' + id); } catch (err) { /* file:// */ }
        if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
        try { target.focus({ preventScroll: true }); } catch (err) { /* old browser */ }
      });
    });
  }

  /* ── Hover and press micro-interactions (desktop pointers only for hover) ── */
  function magnetic(sel, strength) {
    if (!FINE) return;
    $$(sel).forEach(function (el) {
      var x = 0, y = 0, tx = 0, ty = 0, raf = 0;
      function loop() {
        x = lerp(x, tx, 0.18); y = lerp(y, ty, 0.18);
        el.style.translate = x.toFixed(2) + 'px ' + y.toFixed(2) + 'px';
        if (Math.abs(x - tx) > 0.05 || Math.abs(y - ty) > 0.05) raf = requestAnimationFrame(loop);
        else { raf = 0; if (!tx && !ty) el.style.translate = ''; }
      }
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - r.left - r.width / 2) * (strength || 0.22);
        ty = (e.clientY - r.top - r.height / 2) * (strength || 0.22) * 1.3;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
    });
  }
  function press(sel) {
    doc.addEventListener('pointerdown', function (e) {
      var el = e.target.closest && e.target.closest(sel);
      if (!el) return;
      try { el.animate([{ scale: 1 }, { scale: 0.95 }, { scale: 1 }], { duration: 380, easing: EASE }); } catch (err) { /* fine */ }
    });
  }
  /* A soft light that follows the pointer across a card (CSS reads --mx/--my). */
  function spotlight(sel) {
    if (!FINE) return;
    doc.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest(sel);
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  }

  /* Draw an SVG stroke: from nothing to whole. */
  function draw(path, dur, delay, ease) {
    if (!path) return null;
    path.setAttribute('pathLength', '1');
    path.style.strokeDasharray = '1 3';
    var a = path.animate([{ strokeDashoffset: 1.02 }, { strokeDashoffset: 0 }], { duration: dur || 1400, delay: delay || 0, easing: ease || EASE_IO, fill: 'both' });
    return a;
  }

  /* ── Boot ── */
  var hideCss = [];
  function hide(sel) { hideCss.push('html.mo ' + sel + ':not(.mo-in)'); }
  function boot(cfg) {
    // Before first paint: what will be revealed starts hidden.
    if (ON) {
      root.classList.add('mo');
      (cfg.reveal || []).forEach(function (r) { hide(r[0]); });
      (cfg.hero || []).forEach(function (r) { hide(r[0]); });
      var st = doc.createElement('style');
      st.setAttribute('data-motion', '');
      st.textContent = hideCss.join(',\n') + ' { opacity: 0; }\n@media print { html.mo * { opacity: 1 !important; } }';
      (doc.head || root).appendChild(st);
      // If the page never gets as far as init, give the content back.
      setTimeout(function () { if (!inited) root.classList.remove('mo'); }, 5000);
    } else {
      root.classList.add(REDUCE ? 'mo-reduce' : 'mo-off');
    }
    function init() {
      if (inited) return;
      inited = true;
      try {
        if (ON) {
          startIO();
          (cfg.reveal || []).forEach(function (r) {
            $$(r[0]).forEach(function (el) { watch(el, r[1], r[2]); });
          });
          (cfg.counters || []).forEach(function (c) {
            $$(c[0]).forEach(function (el) {
              var prev = el.__moThen;
              if (el.__moWatched) {
                el.__moThen = function (x, d) { if (prev) prev(x, d); count(x, c[1], d + (c[2] || 150)); };
              } else {
                var cio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { cio.disconnect(); count(el, c[1], c[2] || 0); } }); }, { rootMargin: '0px 0px -10% 0px' });
                cio.observe(el);
              }
            });
          });
          (cfg.bands || []).forEach(function (s) { $$(s).forEach(band); });
          smoothAnchors();
          if (cfg.magnetic) magnetic(cfg.magnetic, cfg.magneticStrength);
          if (cfg.press) press(cfg.press);
          if (cfg.spotlight) spotlight(cfg.spotlight);
          W.addEventListener('scroll', kick, { passive: true });
          W.addEventListener('resize', kick, { passive: true });
        }
        if (cfg.site) cfg.site({ ON: ON, REDUCE: REDUCE });
        if (ON) {
          var go = function () {
            if (go.done) return; go.done = true;
            (cfg.hero || []).forEach(function (h) {
              var el = $(h[0]);
              if (!el) return;
              if (h[1] === 'words') words(el, h[2] || 0, h[3]);
              else reveal(el, h[1], h[2] || 0, h[3]);
            });
            if (cfg.afterHero) cfg.afterHero();
            kick();
          };
          // Wait (briefly) for the web fonts so the headline does not reflow mid-animation.
          if (doc.fonts && doc.fonts.ready) { doc.fonts.ready.then(go, go); setTimeout(go, 450); } else go();
        }
      } catch (err) {
        root.classList.remove('mo');
        if (W.console && console.warn) console.warn('motion: switched off', err);
      }
    }
    // After every other DOMContentLoaded handler (language, booking, listings).
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
    else setTimeout(init, 0);
  }

  /* ── Miralume: a Lisbon townhouse draws itself, a key turns, the door
     opens onto warm light; listings lift in the first time they appear ── */
  function houseScene(on) {
    var wrap = $('.hero .wrap'), form = $('#search');
    if (!wrap || !form || $('.mo-house')) return null;
    var box = doc.createElement('div');
    box.className = 'mo-house mo-deco';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<svg xmlns="' + SVGNS + '" viewBox="0 0 360 280" focusable="false">' +
      '<defs>' +
      '<linearGradient id="mo-warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE3A6"/><stop offset="1" stop-color="#F2B85B"/></linearGradient>' +
      '<linearGradient id="mo-spill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2B85B" stop-opacity=".55"/><stop offset="1" stop-color="#F2B85B" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="mo-sun"><stop offset="0" stop-color="#FFD58A"/><stop offset=".6" stop-color="#F2B85B" stop-opacity=".9"/><stop offset="1" stop-color="#F2B85B" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<g class="mo-sun-g"><circle class="mo-sun" cx="300" cy="62" r="34" fill="url(#mo-sun)"/></g>' +
      // Light that will glow in the windows and behind the door.
      '<g class="mo-lights" fill="url(#mo-warm)">' +
      '<path class="mo-win-l" d="M108 186 v-22 a16 16 0 0 1 32 0 v22 z"/>' +
      '<path class="mo-win-l" d="M220 186 v-22 a16 16 0 0 1 32 0 v22 z"/>' +
      '<path class="mo-win-l" d="M108 246 v-26 a16 16 0 0 1 32 0 v26 z"/>' +
      '<path class="mo-door-light" d="M210 262 v-46 a26 26 0 0 1 52 0 v46 z"/>' +
      '</g>' +
      '<path class="mo-spill-p" d="M210 262 h52 l40 16 h-132 z" fill="url(#mo-spill)"/>' +
      // The door panel (it swings open on its left hinge).
      '<path class="mo-door" d="M210 262 v-46 a26 26 0 0 1 52 0 v46 z" fill="#0b3b3e" stroke="#fff" stroke-width="2"/>' +
      '<g class="mo-lines" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M14 262 H346"/>' +
      '<path d="M84 262 V124 M276 124 V262"/>' +
      '<path d="M66 132 L180 50 L294 132"/>' +
      '<path d="M236 92 V60 H258 V108"/>' +
      '<path d="M84 200 H276" stroke-opacity=".45"/>' +
      '<path d="M108 186 v-22 a16 16 0 0 1 32 0 v22 z M104 190 h40"/>' +
      '<path d="M220 186 v-22 a16 16 0 0 1 32 0 v22 z M216 190 h40"/>' +
      '<path d="M108 246 v-26 a16 16 0 0 1 32 0 v26 z M104 250 h40"/>' +
      '<path d="M210 262 v-46 a26 26 0 0 1 52 0 v46"/>' +
      '<path d="M162 112 a18 18 0 0 1 36 0 v6 h-36 z"/>' +
      '<path d="M44 262 C 46 236, 40 214, 48 194 M48 194 C 34 186, 24 190, 18 198 M48 194 C 56 180, 68 178, 76 184 M48 194 C 46 178, 36 170, 26 170 M48 194 C 60 190, 70 196, 74 206"/>' +
      '</g>' +
      '<g class="mo-smoke" fill="#fff"><circle cx="247" cy="52" r="5"/><circle cx="250" cy="52" r="4"/><circle cx="245" cy="52" r="3.5"/></g>' +
      // The key: bow, shaft and bit; it slides in and turns at the lock.
      '<g class="mo-key-pos" transform="translate(252 238)"><g class="mo-key">' +
      '<circle cx="34" cy="0" r="9" fill="none" stroke="#F2B85B" stroke-width="3.2"/>' +
      '<path d="M25 0 H0 M6 0 v6 M11 0 v4" fill="none" stroke="#F2B85B" stroke-width="3.2" stroke-linecap="round"/>' +
      '</g></g>' +
      '<circle class="mo-lock" cx="252" cy="238" r="2.4" fill="#F2B85B"/>' +
      '</svg>';
    wrap.insertBefore(box, form);
    var s = box.firstChild;
    var P = { box: box, s: s, lines: $$('.mo-lines path', s), wins: $$('.mo-win-l', s), doorLight: $('.mo-door-light', s), door: $('.mo-door', s),
      spill: $('.mo-spill-p', s), key: $('.mo-key', s), sun: $('.mo-sun-g', s), smoke: $$('.mo-smoke circle', s) };
    if (!on) {
      // Reduced motion: the finished picture, lights on, door ajar.
      P.door.style.transform = 'scaleX(.4)';
      P.key.style.opacity = '0';
      P.smoke.forEach(function (c) { c.style.opacity = '0'; });
    }
    return P;
  }

  function playHouse(P, t0) {
    var at = function (ms) { return t0 + ms; };
    P.lines.forEach(function (p, i) { draw(p, 900, at(i * 150), EASE); });
    P.sun.animate([{ transform: 'translateY(50px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 1800, delay: at(200), easing: EASE, fill: 'backwards' });
    P.door.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: at(1300), fill: 'backwards' });
    P.wins.forEach(function (w, i) { w.animate([{ opacity: 0 }, { opacity: 0.9 }], { duration: 700, delay: at(2900 + i * 220), easing: 'ease-out', fill: 'both' }); });
    // The key slides in from the right, turns a quarter, and the door opens.
    P.key.animate([
      { transform: 'translateX(60px) rotate(0deg)', opacity: 0 },
      { transform: 'translateX(0) rotate(0deg)', opacity: 1, offset: 0.4, easing: 'cubic-bezier(.3,1.4,.5,1)' },
      { transform: 'translateX(0) rotate(0deg)', opacity: 1, offset: 0.55 },
      { transform: 'translateX(0) rotate(-90deg)', opacity: 1, offset: 0.85 },
      { transform: 'translateX(0) rotate(-90deg)', opacity: 1 },
    ], { duration: 1500, delay: at(1700), easing: EASE, fill: 'both' });
    P.door.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(.38)' }], { duration: 1100, delay: at(3200), easing: SPRING, fill: 'forwards' });
    P.key.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: at(3200), fill: 'forwards', composite: 'replace' });
    P.doorLight.animate([{ opacity: 0 }, { opacity: 0.22 }], { duration: 600, delay: at(1300), fill: 'both' });
    P.doorLight.animate([{ opacity: 0.22 }, { opacity: 1 }], { duration: 900, delay: at(3200), fill: 'forwards' });
    P.spill.animate([{ opacity: 0, transform: 'scaleY(.2)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: 1200, delay: at(3350), easing: EASE, fill: 'both' });
    P.smoke.forEach(function (c, i) {
      c.animate([{ transform: 'translate(0, 0) scale(.6)', opacity: 0 }, { opacity: 0.55, offset: 0.25 }, { transform: 'translate(' + (8 + i * 5) + 'px, -38px) scale(1.8)', opacity: 0 }],
        { duration: 3200, delay: at(2400 + i * 1050), iterations: Infinity, easing: 'ease-out', fill: 'backwards' });
    });
  }

  /* Listing cards: lift in once, the first time each home appears. The list is
     rewritten every few seconds by the live refresh, so we remember by link. */
  function cards(results) {
    var done = {}, pending = [], cio = null;
    function key(c) { return c.getAttribute('href') || ''; }
    function show(list) {
      list.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
      list.forEach(function (c, i) {
        done[key(c)] = true;
        c.style.opacity = '';
        var d = i * 90;
        c.animate([{ opacity: 0, translate: '0 48px', scale: 0.96 }, { opacity: 1, translate: '0 0', scale: 1 }], { duration: 1000, delay: d, easing: EASE, fill: 'backwards' });
        var img = c.querySelector('.ph img');
        if (img) img.animate([{ scale: 1.18 }, { scale: 1 }], { duration: 1600, delay: d, easing: EASE, fill: 'backwards' });
        var price = c.querySelector('.price');
        if (price) price.animate([{ opacity: 0, translate: '-12px 0' }, { opacity: 1, translate: '0 0' }], { duration: 800, delay: d + 250, easing: EASE, fill: 'backwards' });
      });
    }
    function scan() {
      if (cio) cio.disconnect();
      pending = $$('a.card', results).filter(function (c) { return !done[key(c)]; });
      if (!pending.length) return;
      pending.forEach(function (c) { c.style.opacity = '0'; });
      cio = new IntersectionObserver(function (es) {
        var hits = es.filter(function (e) { return e.isIntersecting; }).map(function (e) { cio.unobserve(e.target); return e.target; });
        if (hits.length) show(hits);
      }, { rootMargin: '0px 0px -6% 0px' });
      pending.forEach(function (c) { cio.observe(c); });
    }
    new MutationObserver(scan).observe(results, { childList: true });
    scan();
  }

  /* Property page: the first render arrives with a little ceremony; a new
     main photo cross-fades in; nothing replays on the live refresh. */
  function propertyPage(page) {
    var first = true, lastSrc = null;
    function onRender() {
      var gal = $('.gallery', page);
      if (!gal) return;
      var main = $('.gallery .main img', page), src = main ? main.getAttribute('src') : null;
      if (first) {
        first = false;
        gal.animate(V.curtain, { duration: 1400, easing: EASE, fill: 'backwards' });
        $$('.gallery .side img', page).forEach(function (im, i) { im.animate(V.wipeUp, { duration: 1100, delay: 250 + i * 120, easing: EASE, fill: 'backwards' }); });
        $$('.layout article > *', page).forEach(function (el, i) { el.animate(V.riseSm, { duration: 900, delay: 200 + i * 70, easing: EASE, fill: 'backwards' }); });
        $$('.keyfacts > span, .features li', page).forEach(function (el, i) { el.animate(V.pop, { duration: 700, delay: 500 + i * 45, easing: SPRING, fill: 'backwards' }); });
        var panel = $('.panel', page);
        if (panel) panel.animate(V.right, { duration: 1100, delay: 350, easing: EASE, fill: 'backwards' });
        $$('.thumbs button', page).forEach(function (b, i) { b.animate(V.riseSm, { duration: 700, delay: 400 + i * 50, easing: EASE, fill: 'backwards' }); });
      } else if (main && src !== lastSrc) {
        main.animate([{ opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1 }], { duration: 700, easing: EASE });
      }
      lastSrc = src;
    }
    new MutationObserver(onRender).observe(page, { childList: true });
    onRender();
  }

  boot({
    hero: [
      ['.hero h1', 'words', 120, 60],
      ['.hero .wrap > p', 'blur', 560, 1000],
      ['#search', 'rise', 760, 1100],
      ['.hero .live', 'fade', 1100],
    ],
    reveal: [
      ['#listings .section-head', 'rise'],
      ['footer .wrap > div', 'riseSm', { stagger: 100 }],
      ['footer .demo', 'fade'],
    ],
    magnetic: '#search .go',
    magneticStrength: 0.15,
    press: '#search button, .primary, .tabs button, .slots button, .media-bar button',
    spotlight: '',
    site: function (m) {
      var P = houseScene(m.ON);
      var results = $('#results'), page = $('#page');
      if (!m.ON) return;
      if (P) {
        playHouse(P, 300);
        P.box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 200, fill: 'backwards' });
      }
      var bg = $('#hero-bg');
      if (bg) bg.animate([{ scale: 1.14 }, { scale: 1 }], { duration: 2600, easing: EASE });
      if (results) cards(results);
      if (page) propertyPage(page);
      // Scroll: the photo drifts slower than the page, the house a little faster, the sun sets behind the roof.
      var hero = $('.hero');
      if (hero) onScroll(function (vh) {
        if (!visible(hero, vh)) return;
        var y = Math.max(0, W.scrollY);
        if (bg) bg.style.translate = '0 ' + (y * 0.35).toFixed(1) + 'px';
        if (P) {
          P.box.style.translate = '0 ' + (-y * 0.08).toFixed(1) + 'px';
          P.sun.style.translate = '0 ' + (y * 0.12).toFixed(1) + 'px';
        }
      });
    },
  });
})();
