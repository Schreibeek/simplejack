// Testovací verze pro úpravy, které má vidět jen David
// ?sjtest=1 v adrese ji zapne, ?sjtest=0 vypne. Platí jen v prohlížeči, kde se zapnula.
// Bez zapnutí se nic dalšího nenačte a web je pro zákazníky beze změny. Soubory jsou ve složce test/.

(function () {
  var on = false;
  try {
    var m = /[?&]sjtest=([01])(?:&|$)/.exec(location.search);
    if (m) {
      if (m[1] === '1') localStorage.setItem('sjtest', '1');
      else localStorage.removeItem('sjtest');
    }
    on = localStorage.getItem('sjtest') === '1';
  } catch (e) {}
  if (!on) return;

  var base = 'https://schreibeek.github.io/simplejack/test/';
  var t = Date.now();
  document.documentElement.classList.add('sj-test');
  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = base + 'sj-test.css?t=' + t;
  document.head.appendChild(css);
  var js = document.createElement('script');
  js.src = base + 'sj-test.js?t=' + t;
  document.body.appendChild(js);
})();

// Filtr v parametrických kategoriích defaultně zavřený
// Shoptet bere přednastavený filtr parametrické kategorie jako aktivní, a proto filtr sám otevře.
// Běžné kategorie a stránky, kde si zákazník už něco vyfiltroval, se nemění.

document.addEventListener('DOMContentLoaded', function () {
  if (!document.body.classList.contains('subtype-category-parametric')) return;

  var filters = document.getElementById('filters');
  var btn = document.querySelector('.filters-unveil-button-wrapper .unveil-button');

  if (!filters || !btn || !filters.classList.contains('visible')) return;

  var openText = btn.getAttribute('data-text');

  if (!openText) return;

  filters.classList.remove('visible');
  btn.setAttribute('data-text', btn.textContent);
  btn.textContent = openText;
});

// Detail produktu: kalkulátor plochy, množstevní sleva, cena v bloku Do košíku a řádek Kód
// Pro všechny od 24. 10. 2026 (předtím testovací verze). Styly jsou v css/simplejack.css pod html.sj-detail.
// Podle design systému SimpleJack: AreaCalculator, QuantityDiscount, CartBlock, DetailParameters.
// - kalkulátor plochy místo #measure-banner ze sj.js (jen u produktů, kde sj.js kalkulačku ukazuje),
//   přepočítá m² na kusy a zapíše je do pole množství v bloku Do košíku. Kusy na m² a krok bere ze sj.js,
//   takže stará kalkulačka ve sj.js se nesmí vypnout, dokud nová nebude mít vlastní zdroj,
// - množstevní sleva místo tabulky Shoptetu (jen kde je .quantity-discounts),
// - v bloku Do košíku cena jako dřív (za kus, po zadání plochy celkem, pod ní za m²), jen spočítaná přesně se slevou,
// - řádek Kód v parametrech až po výběru varianty.

(function () {
  'use strict';

  var VERSION = '2026-10-24';
  var CHIPS = [10, 20, 30, 50, 100];
  var M2_STEP = 0.5; // krok tlačítek - a + u plochy (i šipek na klávesnici)
  var CUT = 1.1;
  var d = document;
  var root = d.documentElement;

  /* ---------- pomocné funkce ---------- */
  function qs(sel, ctx) { return (ctx || d).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || d).querySelectorAll(sel)); }
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function txt(e) { return e ? String(e.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function parseNum(s) {
    var m = String(s || '').replace(/[\u00a0\u202f]/g, ' ').match(/\d[\d ]*(?:,\d+)?/);
    return m ? parseFloat(m[0].replace(/ /g, '').replace(',', '.')) : NaN;
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function fmt(n) { return n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 }); }
  // plocha v poli kalkulátoru vždy aspoň s jednou desetinou (10,0 / 10,5), ať číslo neskáče
  function fmtM2(n) { return n.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 2 }); }
  function kc(n) {
    var dec = Math.round(n * 100) % 100 !== 0;
    return n.toLocaleString('cs-CZ', { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }) + '\u00a0Kč';
  }
  function ks(n) { return fmt(n) + '\u00a0ks'; }
  // zapisovat jen změny, ať opakované překreslení nehýbe stránkou
  function setText(e, v) { if (e.textContent !== v) e.textContent = v; }
  function setHtml(e, v) { if (e.__sjHtml !== v) { e.__sjHtml = v; e.innerHTML = v; } }
  function shown(e) { return !!e && !e.classList.contains('noDisplay') && !e.classList.contains('no-display'); }
  function fire(e, type) {
    var ev;
    try { ev = new Event(type, { bubbles: true }); } catch (x) { ev = d.createEvent('Event'); ev.initEvent(type, true, true); }
    e.dispatchEvent(ev);
  }
  function onReady(fn) { if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fn); else fn(); }
  function log() { try { console.info.apply(console, ['[sj-detail]'].concat([].slice.call(arguments))); } catch (x) {} }

  /* ---------- karta produktu ---------- */
  function product() {
    var form = qs('#product-detail-form');
    if (!form || !d.body.classList.contains('type-detail')) return;
    var cart = qs('.p-to-cart-block', form);
    var amount = cart && qs('[data-testid="cartAmount"], input[name="amount"]', cart);
    if (!cart || !amount) return;
    var priceWrap = qs('.p-final-price-wrapper', cart);
    var params = qs('table.detail-parameters', form);
    var variants = qs('.p-variants-block', form);
    var nativeQd = qs('.quantity-discounts', form);

    var S = { m2: null, cut: false, qdOpen: false, lastSet: null, calcSet: null, seenQty: null, userAt: 0, reapply: 0, chosenAt: 0, warned: false };

    /* data produktu */
    function dl() { try { return window.getShoptetDataLayer ? window.getShoptetDataLayer('product') : null; } catch (x) { return null; } }
    // nativní cena Shoptetu: .price-final, který nepřidalo sj.js (u akčních cen má i nativní cena třídu price-action)
    function priceFinal() {
      return qsa('.price-final', priceWrap || cart).filter(function (e) { return !qs('#price-final-measure', e) && !e.classList.contains('sj-old-price'); })[0] || null;
    }
    function markOldPrice() { var m = d.getElementById('price-final-measure'); if (m && m.parentElement && m.parentElement !== priceWrap) m.parentElement.classList.add('sj-old-price'); }
    // varianta je vybraná, když je u ceny vidět span konkrétní varianty (ne výchozí "od ... Kč")
    function variantState() {
      var pf = priceFinal();
      var perVariant = pf ? qsa('.choose-variant', pf).filter(function (h) { return !h.classList.contains('default-variant'); }) : [];
      var visible = perVariant.filter(shown);
      var chosen = perVariant.length ? visible.length > 0 : true;
      var holders = visible.length ? visible : (pf ? qsa('.price-final-holder', pf).filter(function (h) { return shown(h) && !h.classList.contains('default-variant'); }) : []);
      var base = chosen ? (holders.length ? parseNum(txt(holders[0])) : parseNum(txt(pf))) : NaN;
      return { chosen: chosen, base: base };
    }
    function minPrice() {
      var p = dl(), v = p && parseFloat(p.priceWithVatMin);
      if (v > 0) return v;
      var pf = priceFinal(), def = pf && qs('.default-variant', pf);
      return parseNum(txt(def || pf));
    }
    function samePrices() { var p = dl(); return !!p && parseFloat(p.priceWithVatMin) === parseFloat(p.priceWithVatMax); }

    // kusů na m²: sj.js (globální quantityInMeter, plní se po výběru varianty), jinak parametr Počet dlaždic na 1 m²
    function sjQim() { try { return (typeof quantityInMeter === 'number' && quantityInMeter > 0) ? quantityInMeter : NaN; } catch (x) { return NaN; } }
    function paramQim() {
      var rows = qsa('table.detail-parameters tr');
      for (var i = 0; i < rows.length; i++) {
        var th = qs('th', rows[i]);
        if (th && /dlaždic\s+na\s+1\s*m/i.test(txt(th))) { var v = parseNum(txt(qs('td', rows[i]))); if (v > 0) return v; }
      }
      return NaN;
    }
    function qim() {
      var a = sjQim(), b = paramQim();
      if (a > 0 && b > 0 && a !== b && !S.warned) { S.warned = true; log('kusů na m² se liší: sj.js', a, 'parametr', b, '- beru sj.js'); }
      return a > 0 ? a : b;
    }
    // přepočet ceny za kus na cenu za m² stejně jako sj.js (cena za m² / cena za kus), jinak kusy na m²
    function m2Factor() {
      try { if (typeof measureUnit === 'number' && typeof measurePriceSolid === 'number' && measureUnit > 0 && measurePriceSolid > 0) return measureUnit / measurePriceSolid; } catch (x) {}
      return qim();
    }
    function step() { var s = parseFloat(amount.getAttribute('step')); return s > 0 ? s : 1; }
    function minQty() { var m = parseFloat(amount.getAttribute('min')); return m > 0 ? m : 1; }
    function qty() { var v = parseFloat(String(amount.value).replace(',', '.')); return v > 0 ? v : minQty(); }
    function pieces(m2) {
      var q = qim();
      if (!(m2 > 0) || !(q > 0)) return null;
      var raw = Math.ceil(m2 * q * (S.cut ? CUT : 1) - 1e-9);
      var st = step();
      return Math.max(Math.ceil(raw / st - 1e-9) * st, minQty());
    }

    /* cenové hladiny z tabulky Shoptetu */
    var tiers = nativeQd ? qsa('.quantity-discounts__item', nativeQd).map(function (it) {
      return { min: parseInt(it.getAttribute('data-amount'), 10), ratio: parseFloat(it.getAttribute('data-price-ratio')) };
    }).filter(function (t) { return t.min > 0 && t.ratio > 0 && t.ratio <= 1; }).sort(function (a, b) { return a.min - b.min; }) : [];
    if (tiers.length && tiers[0].min > 1) tiers.unshift({ min: 1, ratio: 1 });
    if (tiers.length < 2) tiers = [];
    function tierIdx(q) { var i = 0; for (var k = 0; k < tiers.length; k++) if (q >= tiers[k].min) i = k; return i; }
    function ratio(q) { return tiers.length ? tiers[tierIdx(q)].ratio : 1; }
    function offOf(r) { return Math.round((1 - r) * 100); }
    function unit(base, q) { return round2(base * ratio(q)); }

    /* zápis množství do bloku Do košíku */
    function setQty(n, fromGuard) {
      if (!(n > 0)) return;
      if (!fromGuard) S.reapply = 0;
      S.lastSet = n;
      amount.value = String(n);
      fire(amount, 'input');
      fire(amount, 'change');
      S.seenQty = n;
      render();
    }

    /* ---------- cena v bloku Do košíku ---------- */
    var price = el('div', 'sj-price');
    var priceFinalEl = el('strong', 'sj-price__final');
    var priceMeasureEl = el('span', 'sj-price__measure');
    price.appendChild(priceFinalEl);
    price.appendChild(priceMeasureEl);
    markOldPrice();
    var nativePf = priceFinal();
    if (nativePf && nativePf.parentNode) nativePf.parentNode.insertBefore(price, nativePf);
    else (priceWrap || cart).insertBefore(price, (priceWrap || cart).firstChild);

    /* ---------- řádek Kód ---------- */
    var codeRow = null;
    if (params) qsa('tr', params).forEach(function (tr) { var th = qs('th', tr); if (!codeRow && th && /^kód\b/i.test(txt(th))) codeRow = tr; });
    if (codeRow) codeRow.classList.add('sj-code-row');

    /* ---------- kalkulátor plochy ---------- */
    var calcOn = false, teaser, open, m2Input, ksOut, cutBox, tipM2, chipBtns = [];
    function buildCalc() {
      var host = el('div', 'sj-calc-host');
      teaser = el('button', 'sj-calc sj-calc--teaser',
        '<span class="sj-calc__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17"></rect><path d="M3.5 9.5h17M9.5 9.5v11"></path></svg></span>' +
        '<span class="sj-calc__copy"><span class="sj-calc__title">Spočítejte si cenu a množství</span><span class="sj-calc__text">Vyberte <b>barvu výše</b> a doplníme cenu i počet kusů.</span></span>' +
        '<span class="sj-calc__arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20V5M6 11l6-6 6 6"></path></svg></span>');
      teaser.type = 'button';
      open = el('section', 'sj-calc sj-calc--open',
        '<div class="sj-calc__body"><div class="sj-calc__ask">' +
          '<label class="sj-calc__q" for="sj-calc-m2">Kolik m² potřebujete?</label>' +
          '<span class="sj-calc__infowrap"><button type="button" class="sj-calc__info" aria-label="Nápověda k ploše" aria-describedby="sj-tip-m2">i</button><span class="sj-calc__tip sj-calc__tip--left" role="tooltip" id="sj-tip-m2"></span></span>' +
          '<span class="sj-calc__in"><span class="sj-calc__stepper">' +
            '<button type="button" class="sj-calc__step" data-d="-1" aria-label="Ubrat 0,5 m²"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10"></path></svg></button>' +
            '<input id="sj-calc-m2" class="sj-calc__m2" type="text" inputmode="decimal" autocomplete="off" placeholder="0,0">' +
            '<span class="sj-calc__unit">m²</span>' +
            '<button type="button" class="sj-calc__step" data-d="1" aria-label="Přidat 0,5 m²"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10M6 1v10"></path></svg></button>' +
          '</span><span class="sj-calc__ks" aria-live="polite"></span></span>' +
        '</div></div>' +
        '<div class="sj-calc__row2"><div class="sj-calc__chips" role="group" aria-label="Rychlá volba plochy"></div>' +
          '<span class="sj-calc__opt"><label class="sj-calc__check"><input type="checkbox"> Přidat 10% prořez</label>' +
          '<span class="sj-calc__infowrap"><button type="button" class="sj-calc__info" aria-label="Nápověda k prořezu" aria-describedby="sj-tip-cut">i</button><span class="sj-calc__tip" role="tooltip" id="sj-tip-cut">Prořez je rezerva na dořezání u stěn, sloupů a v rozích. Bez něj vám může pár kusů chybět.</span></span></span>' +
        '</div>');
      open.setAttribute('aria-label', 'Kalkulátor plochy');
      host.appendChild(teaser);
      host.appendChild(open);

      m2Input = qs('.sj-calc__m2', open);
      ksOut = qs('.sj-calc__ks', open);
      cutBox = qs('.sj-calc__check input', open);
      tipM2 = qs('#sj-tip-m2', open);
      var chips = qs('.sj-calc__chips', open);
      CHIPS.forEach(function (v) {
        var b = el('button', 'sj-calc__chip');
        b.type = 'button';
        b.textContent = fmt(v) + ' m²';
        b.addEventListener('click', function () { S.m2 = v; m2Input.value = fmtM2(v); applyCalc(); });
        chips.appendChild(b);
        chipBtns.push({ v: v, b: b });
      });

      // zavřená výzva: posunout na varianty a krátce je zvýraznit
      teaser.addEventListener('click', function () {
        var target = variants || params || form;
        var top = target.getBoundingClientRect().top + (window.pageYOffset || d.documentElement.scrollTop) - 100;
        try { window.scrollTo({ top: top, behavior: 'smooth' }); } catch (x) { window.scrollTo(0, top); }
        // rámeček končí kousek pod vzorky, ne až na konci bloku (Shoptet má pod variantami volné místo a rámeček by zasahoval do parametrů)
        var r = target.getBoundingClientRect();
        var bottoms = qsa('.advanced-parameter, select, .variant-label', target).map(function (e) { return e.getBoundingClientRect().bottom; }).filter(function (v) { return v > 0; });
        var gap = bottoms.length ? Math.max(0, Math.round(r.bottom - Math.max.apply(null, bottoms))) : 0;
        target.style.setProperty('--sj-hint-gap', gap + 'px');
        target.classList.add('sj-variants-hint');
        setTimeout(function () { target.classList.remove('sj-variants-hint'); }, 1600);
      });

      m2Input.addEventListener('input', function () {
        var x = parseFloat(String(m2Input.value).replace(/\s/g, '').replace(',', '.'));
        S.m2 = x > 0 ? round2(x) : null;
        applyCalc();
      });
      m2Input.addEventListener('keydown', function (e) {
        // Enter nesmí odeslat formulář (přidat do košíku)
        if (e.key === 'Enter') { e.preventDefault(); m2Input.blur(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); stepM2(e.key === 'ArrowUp' ? 1 : -1); }
      });
      m2Input.addEventListener('blur', function () { m2Input.value = S.m2 ? fmtM2(S.m2) : ''; });
      qsa('.sj-calc__step', open).forEach(function (b) {
        b.addEventListener('click', function () { stepM2(parseFloat(b.getAttribute('data-d'))); });
      });
      cutBox.addEventListener('change', function () { S.cut = cutBox.checked; applyCalc(); });

      // tooltipy: najetí myší a klávesnice řeší CSS, klepnutí na mobilu přepíná
      qsa('.sj-calc__info', open).forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.preventDefault();
          var tip = b.nextElementSibling, vis = !tip.classList.contains('is-visible');
          closeTips();
          tip.classList.toggle('is-visible', vis);
        });
      });
      d.addEventListener('click', function (e) { if (!(e.target.closest && e.target.closest('.sj-calc__infowrap'))) closeTips(); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTips(); });

      var anchor = params || variants;
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, anchor.nextSibling);
      else cart.parentNode.insertBefore(host, cart);
      calcOn = true;
      root.classList.add('sj-calc-on');
    }
    function closeTips() { qsa('.sj-calc__tip.is-visible').forEach(function (t) { t.classList.remove('is-visible'); }); }
    function stepM2(dir) {
      // po půl metru; z hodnoty mimo krok (např. 10,3) jde + na 10,5 a - na 10
      var cur = S.m2 || 0, k = cur / M2_STEP;
      var nx = round2((dir > 0 ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1) * M2_STEP);
      if (nx < M2_STEP) nx = dir > 0 ? M2_STEP : cur;
      if (nx === cur) return;
      S.m2 = nx;
      m2Input.value = fmtM2(nx);
      applyCalc();
    }
    function applyCalc() { var n = pieces(S.m2); S.calcSet = n || null; if (n) setQty(n); else render(); }

    function renderCalc(v) {
      if (!calcOn) return;
      var q = qim();
      teaser.hidden = v.chosen;
      open.hidden = !v.chosen;
      if (!v.chosen) return;
      var m2Val = S.m2 ? fmtM2(S.m2) : '';
      if (d.activeElement !== m2Input && m2Input.value !== m2Val) m2Input.value = m2Val;
      var n = pieces(S.m2);
      setText(ksOut, n ? '= ' + ks(n) : '');
      cutBox.checked = S.cut;
      chipBtns.forEach(function (c) { c.b.classList.toggle('is-active', S.m2 === c.v); });
      setText(tipM2, 'Plocha je délka × šířka v metrech, třeba 4 × 6 m = 24 m².' + (q > 0 ? ' Na 1 m² vychází ' + ks(q) + '.' : ''));
    }

    /* ---------- množstevní sleva ---------- */
    var qdOn = false, qdEl, qdBar, qdBadge, qdMsg, qdToggleText, qdPanel, qdTiers, qdNudge, qdNudgeText, qdSet, qdNote, nudgeTarget = null;
    function buildQd() {
      qdEl = el('div', 'sj-qd',
        '<button type="button" class="sj-qd__bar" aria-expanded="false" aria-controls="sj-qd-panel">' +
          '<span class="sj-qd__badge" aria-hidden="true">%</span><span class="sj-qd__msg"></span>' +
          '<span class="sj-qd__toggle"><span class="sj-qd__toggle-text">Zobrazit ceny</span> <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4"></path></svg></span>' +
        '</button>' +
        '<div class="sj-qd__panel" id="sj-qd-panel" hidden><ol class="sj-qd__tiers"></ol>' +
          '<div class="sj-qd__nudge" hidden><span class="sj-qd__nudge-text"></span><button type="button" class="sj-qd__set"></button></div>' +
          '<p class="sj-qd__note"></p></div>');
      qdBar = qs('.sj-qd__bar', qdEl);
      qdBadge = qs('.sj-qd__badge', qdEl);
      qdMsg = qs('.sj-qd__msg', qdEl);
      qdToggleText = qs('.sj-qd__toggle-text', qdEl);
      qdPanel = qs('.sj-qd__panel', qdEl);
      qdTiers = qs('.sj-qd__tiers', qdEl);
      qdNudge = qs('.sj-qd__nudge', qdEl);
      qdNudgeText = qs('.sj-qd__nudge-text', qdEl);
      qdSet = qs('.sj-qd__set', qdEl);
      qdNote = qs('.sj-qd__note', qdEl);
      qdBar.addEventListener('click', function () { S.qdOpen = !S.qdOpen; render(); });
      qdSet.addEventListener('click', function () { if (nudgeTarget) { S.calcSet = null; setQty(nudgeTarget); } });
      cart.parentNode.insertBefore(qdEl, cart);
      qdOn = true;
      root.classList.add('sj-qd-on');
    }
    function renderQd(v, q) {
      if (!qdOn) return;
      var chosen = v.chosen && v.base > 0;
      var i = tierIdx(q), cur = tiers[i], next = tiers[i + 1], off = offOf(cur.ratio);
      var maxOff = offOf(tiers[tiers.length - 1].ratio);
      var near = chosen && !!next && (next.min - q) <= Math.ceil(next.min * 0.2);
      var ok = chosen && off > 0;

      qdBadge.classList.toggle('sj-qd__badge--ok', ok);
      setHtml(qdBadge, ok ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>' : '%');
      if (ok) {
        var saving = round2(q * v.base - q * unit(v.base, q));
        setHtml(qdMsg, 'Máte slevu <strong>' + off + '\u00a0%</strong> - ušetříte <span class="is-save">' + kc(saving) + '</span>');
      } else if (near) {
        setHtml(qdMsg, 'Ještě <strong>' + ks(next.min - q) + '</strong> a máte slevu ' + offOf(next.ratio) + '\u00a0%');
      } else {
        setHtml(qdMsg, '<strong>Množstevní sleva až ' + maxOff + '\u00a0%</strong> - už od ' + ks(tiers[1].min));
      }

      qdEl.classList.toggle('is-open', S.qdOpen);
      qdBar.setAttribute('aria-expanded', S.qdOpen ? 'true' : 'false');
      setText(qdToggleText, S.qdOpen ? 'Skrýt' : 'Zobrazit ceny');
      qdPanel.hidden = !S.qdOpen;
      if (!S.qdOpen) return;

      var exact = chosen || samePrices();
      var base = chosen ? v.base : minPrice();
      setHtml(qdTiers, tiers.map(function (t, k) {
        var to = tiers[k + 1] ? tiers[k + 1].min - 1 : null;
        var label = to ? fmt(t.min) + ' - ' + fmt(to) + '\u00a0ks' : fmt(t.min) + '+\u00a0ks';
        var o = offOf(t.ratio), current = chosen && k === i;
        var p = base > 0 ? (exact ? '' : 'od ') + kc(round2(base * t.ratio)) + ' <small>/ ks</small>' : '';
        return '<li class="sj-qd__tier' + (current ? ' is-current' : '') + '">' +
          (current ? '<span class="sj-qd__you">Váš počet</span>' : '') +
          '<span class="sj-qd__qty">' + label + '</span>' +
          '<span class="sj-qd__off' + (o ? '' : ' sj-qd__off--base') + '">' + (o ? 'sleva ' + o + '\u00a0%' : 'základní cena') + '</span>' +
          '<span class="sj-qd__price">' + p + '</span></li>';
      }).join(''));

      if (near) {
        var total = round2(q * unit(v.base, q)), nextTotal = round2(next.min * unit(v.base, next.min));
        nudgeTarget = next.min;
        setHtml(qdNudgeText, '<b>' + ks(next.min) + '</b> vyjde na <b>' + kc(nextTotal) + '</b>' +
          (nextTotal < total ? ' - <span class="is-save">o ' + kc(round2(total - nextTotal)) + ' méně</span> než ' + ks(q) : ' se slevou ' + offOf(next.ratio) + '\u00a0%') + '.');
        setText(qdSet, 'Nastavit ' + ks(next.min));
        qdNudge.hidden = false;
      } else {
        nudgeTarget = null;
        qdNudge.hidden = true;
      }
      setText(qdNote, exact ? 'Sleva se v košíku započítá sama.' : 'Ceny za kus se liší podle barvy, přesné uvidíte po jejím výběru.');
    }

    /* ---------- cena ---------- */
    // jako na webu bez testu: cena za kus, po zadání plochy cena celkem, pod ní cena za m².
    // Jen se počítá přesně: se slevou podle množství a cena celkem vždy podle množství v košíku.
    function renderPrice(v, q) {
      var active = v.chosen && v.base > 0 && (calcOn || qdOn);
      cart.classList.toggle('sj-price-on', !!active);
      if (!active) return;
      var u = unit(v.base, q), qm = m2Factor();
      setText(priceFinalEl, S.m2 && q > 1 ? kc(round2(u * q)) : kc(u) + ' / ks');
      setText(priceMeasureEl, qm > 0 ? kc(round2(u * qm)) + ' / m2' : '');
      cart.classList.toggle('sj-measure-on', qm > 0);
    }

    function renderCode() {
      if (!codeRow) return;
      var def = qs('.default-variant', codeRow);
      codeRow.classList.toggle('is-empty', !!(def && shown(def)));
    }

    function render() {
      markOldPrice();
      ensureCalc();
      // přesná data ze sj.js (kusy na m², krok) můžou dorazit až po zadání plochy: přepočítat kusy, pokud je mezitím nikdo neměnil
      if (S.m2 && S.calcSet && qty() === S.calcSet) {
        var nq = pieces(S.m2);
        if (nq && nq !== S.calcSet) { S.calcSet = nq; setQty(nq); return; }
      }
      var v = variantState(), q = qty();
      if (v.chosen && !S.chosenAt) S.chosenAt = Date.now();
      if (!v.chosen) S.chosenAt = 0;
      renderCalc(v);
      renderQd(v, q);
      renderPrice(v, q);
      renderCode();
    }

    /* ---------- události ---------- */
    function onVariant() {
      S.chosenAt = 0;
      render();
      // sj.js donačítá data varianty se zpožděním, chvíli překreslovat
      var n = 0, t = setInterval(function () { render(); if (++n > 30) clearInterval(t); }, 300);
    }
    ['ShoptetVariantAvailable', 'ShoptetVariantUnavailable', 'ShoptetSurchargesPriceUpdated'].forEach(function (name) { d.addEventListener(name, onVariant); });
    form.addEventListener('change', function (e) { if (e.target && e.target.name === 'priceId') setTimeout(onVariant, 30); });

    // ruční změna množství v bloku Do košíku: přepočítat jen cenu, m² v kalkulátoru zůstanou
    function userQty() { S.userAt = Date.now(); S.lastSet = null; S.calcSet = null; }
    amount.addEventListener('input', function (e) { if (e.isTrusted) userQty(); render(); });
    amount.addEventListener('keydown', userQty);
    cart.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.increase, .decrease')) { userQty(); setTimeout(render, 0); setTimeout(render, 150); }
    }, true);
    // množství mohl změnit i skript Shoptetu nebo sj.js (třeba po změně varianty) - hlídat a vrátit hodnotu z kalkulátoru
    setInterval(function () {
      var q = qty();
      if (S.seenQty === null) { S.seenQty = q; return; }
      if (q === S.seenQty) return;
      if (S.lastSet && q !== S.lastSet && Date.now() - S.userAt > 1500 && S.reapply < 2) {
        S.reapply++;
        log('množství změnil jiný skript na', q, '- vracím', S.lastSet);
        setQty(S.lastSet, true);
        return;
      }
      S.seenQty = q;
      render();
    }, 400);

    /* ---------- spuštění ---------- */
    if (tiers.length) buildQd();
    // kalkulátor hned, když má produkt parametr Počet dlaždic na 1 m² (je přímo ve stránce, nečeká se na sj.js),
    // jinak až sj.js přidá svůj banner a pošle kusy na m². U nájezdů a rohů se neukáže.
    function ensureCalc() { if (!calcOn && (paramQim() > 0 || (d.getElementById('measure-banner') && sjQim() > 0))) buildCalc(); }
    render();
    if (!calcOn) {
      // sj.js přidává banner a data až po odpovědi svého API
      var mo = new MutationObserver(function () { if (!calcOn) render(); if (calcOn) mo.disconnect(); });
      mo.observe(form, { childList: true });
      var bootN = 0, boot = setInterval(function () { render(); if (calcOn || ++bootN > 24) { clearInterval(boot); mo.disconnect(); } }, 500);
    }
    // data ze sj.js (kusy na m², cena za m², krok) dorazí až po jeho API: když se změní, překreslit
    var lastSig = '', sigN = 0, sigT = setInterval(function () {
      var sig = [sjQim(), step(), minQty(), m2Factor()].join('|');
      if (sig !== lastSig) { lastSig = sig; render(); }
      if (++sigN > 40) clearInterval(sigT);
    }, 300);

    window.sjDetail = { version: VERSION, state: S, render: render, qim: qim, tiers: tiers };
    log('verze', VERSION, '- kalkulátor', calcOn ? 'ano' : 'čeká na sj.js', '- sleva', qdOn ? 'ano' : 'ne');
  }

  if (!d.body || !d.body.classList.contains('type-detail')) return;
  root.classList.add('sj-detail');
  // styly jsou v css/simplejack.css; když prohlížeč má z mezipaměti starší verzi bez nich, nechat detail beze změny
  if (!getComputedStyle(root).getPropertyValue('--sj-detail-css').trim()) {
    root.classList.remove('sj-detail');
    log('chybí styly v simplejack.css, nic neměním');
    return;
  }
  function start() { try { product(); } catch (e) { root.classList.add('sj-calc-fallback'); log('chyba', e); } }
  // skript je v zápatí, formulář produktu už je ve stránce: spustit hned, ať se kalkulátor a sleva ukážou spolu se stránkou
  if (d.getElementById('product-detail-form')) start(); else onReady(start);
})();

// Detail produktu: záložka Časté dotazy a kratší názvy záložek
// Pro všechny od 28. 10. 2026 (předtím testovací verze). Styly jsou v css/simplejack.css pod html.sj-tabs.
// - záložka Časté dotazy (25) hned za Popisem, jen u vinylu: otázky a odpovědi ze stránky Nejčastější dotazy
//   (/caste-dotazy-podlaha-simplejack-faq/, rozbalovací <details>), spravují se jen tam,
// - rozvržení jako Popis (2/3 dotazy, 1/3 panel s kontaktem), na mobilu položka v akordeonu,
// - kratší názvy záložek Soubory a SimpleJack (Shoptet je v administraci měnit nedovolí) a přepočet řádku záložek.
(function () {
  'use strict';
  var d = document;
  var root = d.documentElement;
  function qs(sel, ctx) { return (ctx || d).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || d).querySelectorAll(sel)); }
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function onReady(fn) { if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fn); else fn(); }
  function log() { try { console.info.apply(console, ['[sj-tabs]'].concat([].slice.call(arguments))); } catch (x) {} }
  function track(data) { try { (window.dataLayer = window.dataLayer || []).push(data); } catch (x) {} }

  /* ---------- Časté dotazy jako záložka na detailu produktu ----------
     Otázky se berou ze stránky Nejčastější dotazy (rozbalovací <details>), takže se spravují jen tam.
     Stránka s dotazy se stáhne jednou za návštěvu, až je produkt načtený a prohlížeč nic nedělá (kvůli počtu
     v názvu záložky), nebo dřív při najetí na záložku či kliknutí. Pak zůstane uložená v sessionStorage.
     Zatím jen u vinylových podlah, dotazy jsou psané pro vinyl. */
  var FAQ_URL = '/caste-dotazy-podlaha-simplejack-faq/';
  var FAQ_ID = 'sjFaq';
  var FAQ_LABEL = 'Časté dotazy';
  var CACHE_KEY = 'sjFaq:v2'; // při změně zpracování dotazů zvýšit, ať se nepoužijí stará uložená data
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
  // text přímo v prvku (mimo vnořené prvky)
  function ownText(e) {
    return Array.prototype.some.call(e.childNodes, function (n) { return n.nodeType === 3 && n.textContent.replace(/\u00a0/g, ' ').trim(); });
  }
  function parse(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    return qsa('details', doc).map(function (det) {
      var sum = qs('summary', det);
      if (!sum) return null;
      var q = sum.textContent.replace(/\s+/g, ' ').trim();
      var body = det.cloneNode(true);
      body.removeChild(qs('summary', body));
      qsa('script, style', body).forEach(function (s) { s.parentNode.removeChild(s); });
      // odpověď je na FAQ stránce zabalená v jednom <div> (s vlastním odsazením), obal vynecháme
      while (body.children.length === 1 && body.firstElementChild.tagName === 'DIV' && !ownText(body)) {
        body = body.firstElementChild;
      }
      // prázdné odstavce na konci (jen mezery nebo &nbsp;) by dělaly zbytečnou mezeru
      var last = body.lastElementChild;
      while (last && /^(P|DIV|BR)$/.test(last.tagName) && !last.textContent.replace(/\u00a0/g, ' ').trim() && !last.querySelector('img, iframe, video')) {
        body.removeChild(last);
        last = body.lastElementChild;
      }
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
    var pane = el('div', 'tab-pane fade wide-tab'); // wide-tab jako Popis: přes celou šířku
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
    var pane = el('div', 'tab-pane fade active in wide-tab');
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

  if (!d.body || !d.body.classList.contains('type-detail')) return;
  // styly jsou v css/simplejack.css; když prohlížeč má z mezipaměti starší verzi bez nich, nic neměnit
  if (!getComputedStyle(root).getPropertyValue('--sj-faq-css').trim()) { log('chybí styly v simplejack.css, nic neměním'); return; }
  root.classList.add('sj-tabs');
  onReady(function () {
    try { faq(); } catch (e) { log('časté dotazy: chyba', e); }
    try { shortTabNames(); } catch (e) { log('názvy záložek: chyba', e); }
  });
})();
