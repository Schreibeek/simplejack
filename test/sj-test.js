/* SimpleJack - testovací verze kalkulátoru plochy a množstevní slevy.
   Načítá se jen v prohlížeči, kde je zapnutý test (?sjtest=1, viz js/simplejack.js).
   Podle design systému SimpleJack: AreaCalculator, QuantityDiscount, CartBlock, DetailParameters.

   Co dělá na kartě produktu:
   - kalkulátor plochy místo #measure-banner ze sj.js (jen u produktů, kde sj.js kalkulačku ukazuje),
     přepočítá m² na kusy a zapíše je do pole množství v bloku Do košíku,
   - množstevní sleva místo tabulky Shoptetu (jen kde je .quantity-discounts),
   - v bloku Do košíku cena celkem podle hladiny slevy,
   - řádek Kód v parametrech až po výběru varianty.
   Na každé stránce ukáže štítek Testovací verze s odkazem na vypnutí. */
(function () {
  'use strict';

  var VERSION = '2026-10-24.2';
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
  // počkat na sj-test.css, ať se prvky neukážou bez stylů
  function whenCss(fn) {
    var n = 0;
    (function check() {
      if (getComputedStyle(root).getPropertyValue('--sjt-loaded').trim() || n++ > 60) fn();
      else setTimeout(check, 50);
    })();
  }
  function log() { try { console.info.apply(console, ['[sj-test]'].concat([].slice.call(arguments))); } catch (x) {} }

  /* ---------- štítek testovací verze ---------- */
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

    var S = { m2: null, cut: false, qdOpen: false, lastSet: null, seenQty: null, userAt: 0, reapply: 0, chosenAt: 0, warned: false };

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
    var priceStdEl = el('span', 'sj-price__std');
    var priceFinalEl = el('strong', 'sj-price__final');
    var priceMeasureEl = el('span', 'sj-price__measure');
    priceStdEl.hidden = true;
    price.appendChild(priceStdEl);
    price.appendChild(priceFinalEl);
    price.appendChild(priceMeasureEl);
    // přeškrtnutá běžná cena u akčních produktů: v bloku ji ukazujeme sami, aby seděla k ceně celkem
    var stdEl = qs('.price-standard', priceWrap || cart);
    function stdUnit() {
      if (!stdEl) return NaN;
      var spans = qsa('.choose-variant', stdEl).filter(function (h) { return !h.classList.contains('default-variant'); });
      var vis = spans.filter(shown);
      return spans.length ? (vis.length ? parseNum(txt(vis[0])) : NaN) : parseNum(txt(stdEl));
    }
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
            '<input id="sj-calc-m2" class="sj-calc__m2" type="text" inputmode="decimal" autocomplete="off" placeholder="0">' +
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
        b.addEventListener('click', function () { S.m2 = v; m2Input.value = fmt(v); applyCalc(); });
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
      m2Input.addEventListener('blur', function () { m2Input.value = S.m2 ? fmt(S.m2) : ''; });
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
      m2Input.value = fmt(nx);
      applyCalc();
    }
    function applyCalc() { var n = pieces(S.m2); if (n) setQty(n); else render(); }

    function renderCalc(v) {
      if (!calcOn) return;
      var q = qim();
      teaser.hidden = v.chosen;
      open.hidden = !v.chosen;
      if (!v.chosen) return;
      var m2Val = S.m2 ? fmt(S.m2) : '';
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
      qdSet.addEventListener('click', function () { if (nudgeTarget) setQty(nudgeTarget); });
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
    function renderPrice(v, q) {
      var active = v.chosen && v.base > 0 && (calcOn || qdOn);
      cart.classList.toggle('sj-price-on', !!active);
      if (!active) return;
      var u = unit(v.base, q), off = offOf(ratio(q));
      var su = stdUnit();
      if (su > u) { setHtml(priceStdEl, '<del>' + kc(round2(su * q)) + '</del>-' + Math.round((1 - u / su) * 100) + '\u00a0%'); priceStdEl.hidden = false; }
      else priceStdEl.hidden = true;
      if (q > 1) {
        setText(priceFinalEl, kc(round2(u * q)));
        // pod cenou celkem cena za kus a sleva, cena za m² v bloku není
        setText(priceMeasureEl, kc(u) + ' / ks' + (off ? ' (sleva ' + off + '\u00a0%)' : ''));
      } else {
        setText(priceFinalEl, kc(u) + ' / ks');
        setText(priceMeasureEl, '');
      }
    }

    function renderCode() {
      if (!codeRow) return;
      var def = qs('.default-variant', codeRow);
      codeRow.classList.toggle('is-empty', !!(def && shown(def)));
    }

    function render() {
      markOldPrice();
      ensureCalc();
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
    function userQty() { S.userAt = Date.now(); S.lastSet = null; }
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
    // kalkulátor jen u produktů, kde sj.js ukazuje svůj banner a kde známe kusy na m² (ze sj.js nebo z parametru),
    // takže třeba u nájezdů a rohů se neukáže
    function ensureCalc() { if (!calcOn && d.getElementById('measure-banner') && qim() > 0) buildCalc(); }
    render();
    if (!calcOn) {
      // sj.js přidává banner a data až po odpovědi svého API
      var mo = new MutationObserver(function () { if (!calcOn) render(); if (calcOn) mo.disconnect(); });
      mo.observe(form, { childList: true });
      var bootN = 0, boot = setInterval(function () { render(); if (calcOn || ++bootN > 24) { clearInterval(boot); mo.disconnect(); } }, 500);
    }

    window.sjTest = { version: VERSION, state: S, render: render, qim: qim, tiers: tiers };
    log('verze', VERSION, '- kalkulátor', calcOn ? 'ano' : 'čeká na sj.js', '- sleva', qdOn ? 'ano' : 'ne');
  }

  onReady(function () {
    whenCss(function () {
      try { badge(); } catch (e) { log('štítek', e); }
      try { product(); } catch (e) { root.classList.add('sj-calc-fallback'); log('chyba', e); }
    });
  });
})();
