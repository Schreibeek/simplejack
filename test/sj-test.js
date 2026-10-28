/* SimpleJack - testovací verze. Načítá se jen v prohlížeči, kde je zapnutý test (?sjtest=1, viz js/simplejack.js).
   Teď v ní je záložka Časté dotazy na detailu produktu, kratší názvy záložek Soubory a SimpleJack (od 28. 10. 2026)
   a štítek Testovací verze s odkazem na vypnutí.
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
     Stránka s dotazy se stáhne jednou za návštěvu, až je produkt načtený a prohlížeč nic nedělá (kvůli počtu
     v názvu záložky), nebo dřív při najetí na záložku či kliknutí. Pak zůstane uložená v sessionStorage.
     Zatím jen u vinylových podlah, dotazy jsou psané pro vinyl. */
  var FAQ_URL = '/caste-dotazy-podlaha-simplejack-faq/';
  var FAQ_ID = 'sjFaq';
  var FAQ_LABEL = 'Časté dotazy';
  var CACHE_KEY = 'sjFaq:v1';
  var CACHE_MS = 6 * 60 * 60 * 1000;
  var CHEVRON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M4 2l4 4-4 4"/></svg>';
  var MAIL_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6 9-6"/></svg>';
  var PHONE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';

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
  // telefon a e-mail bereme z odkazů na stránce (patička), ať platí to, co má e-shop nastavené
  function contact(prefix, fallbackText, fallbackHref) {
    var t = qs('a[href^="' + prefix + '"]');
    if (!t && !fallbackHref) return null;
    return {
      text: t ? (t.textContent.replace(/\s+/g, ' ').trim() || t.getAttribute('href').replace(prefix, '')) : fallbackText,
      href: t ? t.getAttribute('href') : fallbackHref
    };
  }
  function contactLink(cls, icon, c, eventName) {
    var a = el('a', cls, icon + '<span></span>');
    a.href = c.href;
    a.lastChild.textContent = c.text;
    a.addEventListener('click', function () { track({ event: eventName }); });
    return a;
  }
  function help() {
    var aside = el('aside', 'sj-faq__aside');
    var box = el('div', 'sj-faq__help');
    var head = el('div', 'sj-faq__help-head');
    head.appendChild(el('div', 'sj-faq__help-title', 'Nenašli jste odpověď?'));
    head.appendChild(el('p', 'sj-faq__help-text', 'Zavolejte nám nebo napište, poradíme s výběrem i pokládkou.'));
    box.appendChild(head);
    var actions = el('div', 'sj-faq__help-actions');
    var tel = contact('tel:', '737 593 577', 'tel:+420737593577');
    actions.appendChild(contactLink('sj-faq__contact sj-faq__contact--phone', PHONE_ICON, tel, 'sj_faq_phone'));
    var mail = contact('mailto:');
    if (mail) actions.appendChild(contactLink('sj-faq__contact', MAIL_ICON, mail, 'sj_faq_email'));
    if (typeof window.smartsupp === 'function') {
      var chat = el('button', 'sj-faq__chat');
      chat.type = 'button';
      chat.textContent = 'Napsat do chatu';
      chat.addEventListener('click', function () {
        track({ event: 'sj_faq_chat' });
        try { window.smartsupp('chat:open'); } catch (x) {}
      });
      actions.appendChild(chat);
    }
    box.appendChild(actions);
    aside.appendChild(box);
    return aside;
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

  /* ---------- záložky na detailu produktu: šířky a kratší názvy ---------- */
  // řádek záložek: div.responsive-nav s ul#p-detail-tabs, tlačítkem menu a ul.hidden-links pro to, co se nevejde
  function tabsNav() {
    var ul = d.getElementById('p-detail-tabs');
    return ul ? (ul.closest('.responsive-nav') || ul.parentElement) : null;
  }
  // původní pořadí záložek (Shoptet je při schovávání do menu a vracení přeskládá)
  var tabOrder = null;
  function rememberTabOrder() {
    var nav = tabsNav();
    if (tabOrder || !nav) return;
    tabOrder = qsa('li > a', nav).map(function (a) { return a.getAttribute('href'); });
  }
  function sortTabs() {
    var nav = tabsNav();
    if (!tabOrder || !nav) return;
    function idx(li) { var a = qs('a', li); var i = a ? tabOrder.indexOf(a.getAttribute('href')) : -1; return i < 0 ? 999 : i; }
    qsa('ul', nav).forEach(function (list) {
      qsa(':scope > li', list).sort(function (x, y) { return idx(x) - idx(y); }).forEach(function (li) { list.appendChild(li); });
    });
  }
  // Shoptet podle data-width u každé záložky počítá, které se vejdou do řádku a které schová do menu
  // (shpResponsiveNavigation při každém resize okna). Po přidání záložky nebo změně názvu proto šířky
  // změříme znovu a přepočet spustíme několikrát po sobě, dokud se řádek neustálí.
  var relayoutTimer = null;
  function fixTabWidths() {
    var ul = d.getElementById('p-detail-tabs');
    var nav = tabsNav();
    if (!ul || !nav) return;
    rememberTabOrder();
    qsa('li', nav).forEach(function (li) {
      if (!qs('a', li)) return;
      var probe = el('li', 'shp-tab');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
      var pa = el('a', 'shp-tab-link');
      pa.textContent = li.textContent.replace(/\s+/g, ' ').trim();
      probe.appendChild(pa);
      ul.appendChild(probe);
      var w = Math.ceil(probe.getBoundingClientRect().width);
      ul.removeChild(probe);
      if (!w) return;
      li.setAttribute('data-width', String(w));
      // Shoptet čte šířku přes jQuery .data('width'), která si hodnotu po prvním čtení pamatuje
      if (window.jQuery) window.jQuery(li).data('width', w);
    });
    var n = 0;
    clearInterval(relayoutTimer);
    relayoutTimer = setInterval(function () {
      try { window.dispatchEvent(new Event('resize')); } catch (x) {}
      n++;
      if (n >= 6 || (n >= 2 && !qsa('.hidden-links li', nav).length)) {
        clearInterval(relayoutTimer);
        setTimeout(sortTabs, 100);
      }
    }, 250);
  }
  // Názvy záložek Shoptet v administraci měnit nedovolí (v Zobrazení produktů jde jen vypnout Popis značky),
  // proto je zkracujeme tady. Na desktopu i v akordeonu na mobilu, počet v závorce zůstane.
  var TAB_NAMES = [
    { href: '#relatedFiles', re: /^Související soubory/, to: 'Soubory' },
    { href: '#manufacturerDescription', re: /^Značka\s+/, to: '' }
  ];
  function shortTabNames() {
    rememberTabOrder();
    var changed = false;
    [tabsNav(), d.getElementById('accordion-content')].forEach(function (scope) {
      if (!scope) return;
      TAB_NAMES.forEach(function (r) {
        qsa('a[href="' + r.href + '"]', scope).forEach(function (a) {
          var t = a.textContent.replace(/\s+/g, ' ').trim();
          var n = t.replace(r.re, r.to).trim();
          if (n && n !== t) { a.textContent = n; changed = true; }
        });
      });
    });
    if (changed) fixTabWidths();
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
    var pane = el('div', 'tab-pane fade');
    pane.id = FAQ_ID;
    pane.setAttribute('role', 'tabpanel');
    content.appendChild(pane);
    fixTabWidths();
    ['mouseenter', 'focus', 'touchstart'].forEach(function (ev) { a.addEventListener(ev, prefetch, { passive: true }); });
    a.addEventListener('click', function () { fill(pane); });
    if (window.jQuery) window.jQuery(a).on('shown.bs.tab', function () { fill(pane); });
    return {
      pane: pane,
      anchor: ul,
      link: a,
      // po doplnění počtu je záložka širší, Shoptet musí znovu spočítat, co se vejde
      relayout: fixTabWidths,
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
    return { pane: pane, anchor: item, link: a, open: function () { set(true); } };
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
    // počet dotazů v názvu záložky: z uložených dat hned, jinak až je stránka načtená a prohlížeč nic nedělá
    function setCount(n) {
      if (!n) return;
      ctl.link.textContent = FAQ_LABEL + ' (' + n + ')';
      if (ctl.relayout) ctl.relayout();
    }
    var cached = fromCache();
    if (cached) setCount(cached.length);
    else whenIdle(function () { load().then(function (items) { setCount(items.length); }, function () {}); });
    log('časté dotazy: záložka přidaná');
  }
  function whenIdle(fn) {
    function go() {
      if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 3000 });
      else setTimeout(fn, 1500);
    }
    if (d.readyState === 'complete') go(); else window.addEventListener('load', go);
  }

  onReady(function () {
    badge();
    try { faq(); } catch (e) { log('časté dotazy: chyba', e); }
    try { if (d.body.classList.contains('type-detail')) shortTabNames(); } catch (e) { log('názvy záložek: chyba', e); }
  });
})();
