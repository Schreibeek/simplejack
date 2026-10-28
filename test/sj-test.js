/* SimpleJack - testovací verze. Načítá se jen v prohlížeči, kde je zapnutý test (?sjtest=1, viz js/simplejack.js).
   Teď v ní je záložka Časté dotazy na detailu produktu (od 28. 10. 2026) a štítek Testovací verze s odkazem na vypnutí.
   Kalkulátor plochy a sleva z prvního testu jsou od 24. 10. 2026 pro všechny v js/simplejack.js. */
(function () {
  'use strict';
  var d = document;
  function qs(sel, ctx) { return (ctx || d).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || d).querySelectorAll(sel)); }
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function onReady(fn) { if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fn); else fn(); }
  function log() { try { console.info.apply(console, ['[sj-test]'].concat([].slice.call(arguments))); } catch (x) {} }
  function track(data) { try { (window.dataLayer = window.dataLayer || []).push(data); } catch (x) {} }

  function badge() {
    if (qs('.sj-test-badge')) return;
    var url;
    try { var u = new URL(location.href); u.searchParams.set('sjtest', '0'); url = u.toString(); }
    catch (x) { url = location.pathname + '?sjtest=0'; }
    var b = el('div', 'sj-test-badge');
    b.appendChild(el('span', '', 'Testovací verze'));
    var a = el('a');
    a.href = url;
    a.textContent = 'vypnout';
    b.appendChild(a);
    d.body.appendChild(b);
  }

  /* ---------- Časté dotazy jako záložka na detailu produktu ----------
     Otázky se berou ze stránky Nejčastější dotazy (rozbalovací <details>), takže se spravují jen tam.
     Při načtení produktu se nic nestahuje: stránka s dotazy se načte až při najetí na záložku nebo kliknutí
     a do konce návštěvy zůstane uložená v sessionStorage. Zatím jen u vinylových podlah, dotazy jsou psané pro vinyl. */
  var FAQ_URL = '/caste-dotazy-podlaha-simplejack-faq/';
  var FAQ_ID = 'sjFaq';
  var FAQ_LABEL = 'Časté dotazy';
  var CACHE_KEY = 'sjFaq:v1';
  var CACHE_MS = 6 * 60 * 60 * 1000;
  var CHEVRON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M4 2l4 4-4 4"/></svg>';
  var PHONE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';

  function isVinyl() {
    var txt = '';
    var h1 = qs('h1') || qs('.p-detail-inner-header-mobile .h1');
    if (h1) txt += h1.textContent;
    qsa('.breadcrumbs a, .breadcrumbs [itemprop="name"]').forEach(function (e) { txt += ' ' + e.textContent; });
    try {
      var p = window.getShoptetDataLayer ? window.getShoptetDataLayer('product') : null;
      if (p) txt += ' ' + (p.currentCategory || '') + ' ' + (p.name || '');
    } catch (x) {}
    return /vinyl|pvc/i.test(txt);
  }

  /* data */
  var loading = null;
  function fromCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.items && c.items.length && Date.now() - c.t < CACHE_MS) return c.items;
    } catch (x) {}
    return null;
  }
  function toCache(items) { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), items: items })); } catch (x) {} }
  function parse(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    return qsa('details', doc).map(function (det) {
      var sum = qs('summary', det);
      if (!sum) return null;
      var q = sum.textContent.replace(/\s+/g, ' ').trim();
      var body = det.cloneNode(true);
      body.removeChild(qs('summary', body));
      qsa('script, style', body).forEach(function (s) { s.parentNode.removeChild(s); });
      return { q: q, a: body.innerHTML.trim() };
    }).filter(function (it) { return it && it.q && it.a; });
  }
  function load() {
    if (loading) return loading;
    var cached = fromCache();
    if (cached) { loading = Promise.resolve(cached); return loading; }
    loading = fetch(FAQ_URL, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (html) {
        var items = parse(html);
        if (!items.length) throw new Error('na stránce nejsou žádné dotazy');
        toCache(items);
        return items;
      });
    loading.catch(function (e) { loading = null; log('dotazy se nenačetly', e); });
    return loading;
  }
  function prefetch() { load().catch(function () {}); }

  /* vykreslení obsahu záložky */
  function phone() {
    var t = qs('a[href^="tel:"]');
    var num = t ? t.textContent.replace(/\s+/g, ' ').trim() : '737 593 577';
    var href = t ? t.getAttribute('href') : 'tel:+420737593577';
    return { num: num, href: href };
  }
  function help() {
    var box = el('aside', 'sj-faq__help');
    var ph = phone();
    box.appendChild(el('div', 'sj-faq__help-title', 'Nenašli jste odpověď?'));
    box.appendChild(el('p', 'sj-faq__help-text', 'Zavolejte nám nebo napište do chatu, poradíme s výběrem i pokládkou.'));
    var tel = el('a', 'sj-faq__phone', PHONE_ICON + '<span></span>');
    tel.href = ph.href;
    tel.lastChild.textContent = ph.num;
    tel.addEventListener('click', function () { track({ event: 'sj_faq_phone' }); });
    box.appendChild(tel);
    if (typeof window.smartsupp === 'function') {
      var chat = el('button', 'sj-faq__chat');
      chat.type = 'button';
      chat.textContent = 'Napsat do chatu';
      chat.addEventListener('click', function () {
        track({ event: 'sj_faq_chat' });
        try { window.smartsupp('chat:open'); } catch (x) {}
      });
      box.appendChild(chat);
    }
    return box;
  }
  function render(pane, items) {
    var wrap = el('div', 'sj-faq');
    var list = el('div', 'sj-faq__list');
    items.forEach(function (it) {
      var det = el('details', 'sj-faq__item');
      var sum = el('summary', 'sj-faq__q', CHEVRON + '<span></span>');
      sum.lastChild.textContent = it.q;
      var ans = el('div', 'sj-faq__a', it.a);
      qsa('iframe', ans).forEach(function (f) { f.setAttribute('loading', 'lazy'); });
      qsa('a[href]', ans).forEach(function (a) {
        if (/^https?:/i.test(a.getAttribute('href')) && a.hostname !== location.hostname) { a.target = '_blank'; a.rel = 'noopener'; }
      });
      det.appendChild(sum);
      det.appendChild(ans);
      det.addEventListener('toggle', function () { if (det.open) track({ event: 'sj_faq_question', sj_faq_question: it.q }); });
      list.appendChild(det);
    });
    wrap.appendChild(list);
    wrap.appendChild(help());
    pane.innerHTML = '';
    pane.appendChild(wrap);
  }
  function fill(pane) {
    if (pane.getAttribute('data-sj-state') === 'done' || pane.getAttribute('data-sj-state') === 'loading') return;
    pane.setAttribute('data-sj-state', 'loading');
    pane.innerHTML = '<div class="sj-faq"><p class="sj-faq__state">Načítám časté dotazy…</p></div>';
    track({ event: 'sj_faq_open' });
    load().then(function (items) {
      render(pane, items);
      pane.setAttribute('data-sj-state', 'done');
    }, function () {
      pane.innerHTML = '<div class="sj-faq"><p class="sj-faq__state">Dotazy se teď nepodařilo načíst. Najdete je na stránce <a href="' + FAQ_URL + '">Nejčastější dotazy</a>.</p></div>';
      pane.removeAttribute('data-sj-state');
    });
  }

  /* záložka na desktopu (Shoptet vykreslí ul#p-detail-tabs a panely v #tab-content) */
  function addTab() {
    var ul = d.getElementById('p-detail-tabs');
    var content = d.getElementById('tab-content');
    if (!ul || !content) return null;
    var li = el('li', 'shp-tab');
    li.setAttribute('role', 'none');
    li.setAttribute('data-testid', 'tabSjFaq');
    var a = el('a', 'shp-tab-link');
    a.href = '#' + FAQ_ID;
    a.setAttribute('role', 'tab');
    a.setAttribute('data-toggle', 'tab');
    a.setAttribute('aria-controls', FAQ_ID);
    a.setAttribute('aria-expanded', 'false');
    a.textContent = FAQ_LABEL;
    li.appendChild(a);
    var first = qs(':scope > li', ul);
    ul.insertBefore(li, first ? first.nextSibling : null);
    li.setAttribute('data-width', String(Math.ceil(li.getBoundingClientRect().width) || 200));
    var pane = el('div', 'tab-pane fade');
    pane.id = FAQ_ID;
    pane.setAttribute('role', 'tabpanel');
    content.appendChild(pane);
    // Shoptet si přepočítá, které záložky se vejdou do řádku, a zbytek schová do menu
    try { window.dispatchEvent(new Event('resize')); } catch (x) {}
    ['mouseenter', 'focus', 'touchstart'].forEach(function (ev) { a.addEventListener(ev, prefetch, { passive: true }); });
    a.addEventListener('click', function () { fill(pane); });
    if (window.jQuery) window.jQuery(a).on('shown.bs.tab', function () { fill(pane); });
    return {
      pane: pane,
      anchor: ul,
      open: function () {
        if (window.jQuery && window.jQuery.fn && window.jQuery.fn.tab) window.jQuery(a).tab('show');
        else a.click();
        fill(pane);
      }
    };
  }

  /* akordeon na mobilu (Shoptet místo záložek vykreslí #accordion-content) */
  function addAccordion() {
    var ac = d.getElementById('accordion-content');
    if (!ac) return null;
    var item = el('div', 'shp-accordion');
    item.setAttribute('data-testid', 'tabSjFaq');
    var a = el('a', 'shp-accordion-link');
    a.href = '#' + FAQ_ID;
    a.setAttribute('aria-expanded', 'false');
    a.setAttribute('aria-controls', FAQ_ID);
    a.textContent = FAQ_LABEL;
    var box = el('div', 'shp-accordion-content');
    box.style.display = 'none';
    var pane = el('div', 'tab-pane fade active in');
    pane.id = FAQ_ID;
    pane.setAttribute('role', 'tabpanel');
    box.appendChild(pane);
    item.appendChild(a);
    item.appendChild(box);
    var first = qs(':scope > .shp-accordion', ac);
    ac.insertBefore(item, first ? first.nextSibling : null);
    function set(open) {
      item.classList.toggle('active', open);
      a.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (window.jQuery) window.jQuery(box).stop(true, true)[open ? 'slideDown' : 'slideUp']();
      else box.style.display = open ? 'block' : 'none';
      if (open) fill(pane);
    }
    ['focus', 'touchstart'].forEach(function (ev) { a.addEventListener(ev, prefetch, { passive: true }); });
    a.addEventListener('click', function (e) {
      e.preventDefault();
      // Shoptet váže rozbalování na odkazy akordeonu při document.ready. Když jsme položku přidali dřív,
      // rozbalí ji Shoptet sám a my jen počkáme na výsledek; když později, rozbalujeme sami.
      var shoptet = window.jQuery && window.jQuery._data && (window.jQuery._data(a, 'events') || {}).click;
      if (!shoptet) { set(!item.classList.contains('active')); return; }
      setTimeout(function () {
        var open = item.classList.contains('active');
        a.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) fill(pane);
      }, 0);
    });
    return { pane: pane, anchor: item, open: function () { set(true); } };
  }

  function faq() {
    if (!d.body.classList.contains('type-detail') || d.getElementById(FAQ_ID)) return;
    if (!isVinyl()) { log('časté dotazy: produkt není vinyl, záložku nepřidávám'); return; }
    var ctl = addTab() || addAccordion();
    if (!ctl) { log('časté dotazy: na stránce nejsou záložky ani akordeon'); return; }
    function openAndScroll() {
      ctl.open();
      var top = ctl.anchor.getBoundingClientRect().top + (window.pageYOffset || d.documentElement.scrollTop) - 100;
      try { window.scrollTo({ top: top, behavior: 'smooth' }); } catch (x) { window.scrollTo(0, top); }
    }
    // odkaz na stránku s dotazy v popisu produktu otevře záložku, místo aby vedl pryč z produktu
    d.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a[href*="caste-dotazy-podlaha-simplejack-faq"]') : null;
      if (!link || !link.closest('#description')) return;
      e.preventDefault();
      openAndScroll();
    });
    if (/^#(faq|caste-dotazy|sjfaq)$/i.test(location.hash)) openAndScroll();
    log('časté dotazy: záložka přidaná');
  }

  onReady(function () {
    badge();
    try { faq(); } catch (e) { log('časté dotazy: chyba', e); }
  });
})();
