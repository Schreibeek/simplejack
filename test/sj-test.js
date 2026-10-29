/* SimpleJack - testovací verze. Načítá se jen v prohlížeči, kde je zapnutý test (?sjtest=1, viz js/simplejack.js).
   Teď v ní jsou doplňky k podlaze pod blokem Do košíku (od 29. 10. 2026) a štítek Testovací verze s odkazem na vypnutí.
   Kalkulátor plochy a sleva jsou od 24. 10. 2026 pro všechny, záložka Časté dotazy a kratší názvy záložek
   od 28. 10. 2026. Obojí je v js/simplejack.js. */
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

  /* ---------- Doplňky k podlaze pod Do košíku (komponenta Accessories v design systému, varianta B) ----------
     Zavřená lišta, po rozkliknutí nájezd, roh a soklová lišta ve stejné barvě jako zvolená podlaha a tlačítko Přidat.
     Díly se berou z bloku Související produkty (co ke které podlaze patří, se nastavuje v adminu Shoptetu).
     Barvy, ceny, fotky a termíny se čtou z karet dílů. Stáhnou se, až je lišta skoro na obrazovce nebo na ni zákazník
     najede, a do konce návštěvy zůstanou v sessionStorage. Do košíku se přidává bez vyskakovacího okna. */
  var ACC_CACHE = 'sjAcc:v1:';
  var ACC_TTL = 60 * 60 * 1000;
  var ACC_MAX = 4;
  var ACC_ORDER = ['ramp', 'corner', 'skirting'];
  var ACC_WORDS = { ramp: 'nájezdy', corner: 'rohy', skirting: 'lišty' };
  var COLOR_STEMS = ['tmavě šed', 'světle šed', 'čern', 'šed', 'bíl', 'červen', 'modr', 'žlut', 'zelen', 'hněd', 'grafit', 'limetk', 'béž', 'oranž', 'fialov', 'burgund', 'terakot'];
  var ICON_RAMP = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 18h18"/><path d="M3 18l6-6h12"/></svg>';
  var ICON_CHEV = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 4l4 4 4-4"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function low(s) { return norm(s).toLowerCase(); }
  function num(s) {
    var m = /(\d[\d\s ]*(?:[,.]\d+)?)/.exec(String(s || ''));
    return m ? parseFloat(m[1].replace(/[\s ]/g, '').replace(',', '.')) : NaN;
  }
  function kc(n) {
    var opt = n % 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {};
    return n.toLocaleString('cs-CZ', opt).replace(/\s/g, ' ') + ' Kč';
  }
  function shortDate(s) { var m = /(\d{1,2})\.\s*(\d{1,2})\./.exec(s || ''); return m ? m[1] + '. ' + m[2] + '.' : ''; }
  function colorStem(s) {
    var t = low(s);
    for (var i = 0; i < COLOR_STEMS.length; i++) if (t.indexOf(COLOR_STEMS[i]) !== -1) return COLOR_STEMS[i];
    return null;
  }
  function accType(name) {
    var n = low(name);
    if (/značkovac|spojovac|podkladn|čistič|nátěr|lepidl|páska/.test(n)) return null;
    if (/rohov\S* nájezd|(^|\s)roh(\s|$)/.test(n)) return 'corner';
    if (/nájezd/.test(n)) return 'ramp';
    if (/soklov/.test(n) && /lišt/.test(n)) return 'skirting';
    return null;
  }
  // slova z názvu podlahy, podle kterých se pozná řada (Triton, Positron, Flexor, Checker, Dagoba, PG15)
  function lineWords(name) {
    return low(name).replace(/[^a-z0-9áčďéěíňóřšťúůýž+ ]/g, ' ').split(' ').map(function (w) { return w.replace(/\+/g, ''); }).filter(function (w) {
      return w.length > 2 && !/^\d/.test(w) && !colorStem(w) && !/^(vinyl|plast|gum|pvc|zátěž|průmysl|protiskluz|podlah|dlaž|desk|simplejack|pro|na|do|cm|mm)/.test(w);
    });
  }
  function shortName(name, tileName) {
    var tile = lineWords(tileName);
    var s = norm(name)
      .replace(/simplejack\s*/gi, '')
      .replace(/\s*-?\s*\d[\d,]*\s*x\s*[\d,]+(\s*x\s*[\d,]+)?\s*(cm|mm)\b/gi, '')
      .replace(/\((pvc)\)\s*/gi, '')
      .replace(/\b(vinylov|plastov|gumov)\S*\s+/gi, '')
      .replace(/\b(k dlaždicím|pro dlaždice|ke gumové podlaze|k podlaze)\b/gi, '')
      .replace(/["„“]/g, '');
    s = s.split(' ').filter(function (w) {
      var k = low(w).replace(/[^a-z0-9áčďéěíňóřšťúůýž]/g, '');
      return !(k && tile.indexOf(k) !== -1) && !(tile.length && colorStem(w) && colorStem(w) === colorStem(tileName));
    }).join(' ');
    s = norm(s.replace(/\s+-(\s+|$)/g, ' ').replace(/^-\s*/, ''));
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : norm(name);
  }

  function accessories(form) {
    var cartBlock = qs('.p-to-cart-block', form);
    var related = qsa('.products-related .product');
    if (!cartBlock || !related.length) return;
    var tileName = norm((qs('h1') || qs('.p-detail-inner-header-mobile .h1') || {}).textContent);
    var radios = function () { return qsa('input[type="radio"][name="priceId"]', form).filter(function (i) { return i.value; }); };
    // podlaha s barvami (varianty Barva: Grafit, ...); u Caladanu jsou varianty jiné, tam se barva dílu nepárují
    var hasVariants = radios().some(function (i) { var l = i.closest('label'); return l && /Barva:/i.test(l.textContent); });

    // díly ze Souvisejících produktů
    var seen = {}, items = [];
    related.forEach(function (p) {
      var idEl = qs('[data-micro-product-id]', p);
      var id = idEl ? idEl.getAttribute('data-micro-product-id') : '';
      var nameEl = qs('.name', p);
      var link = qs('a.name', p) || qs('a[href]', p);
      if (!id || seen[id] || !nameEl || !link) return;
      seen[id] = 1;
      var name = norm(nameEl.textContent), type = accType(name);
      if (!type) return;
      var img = qs('img', p);
      // cena z karty (u dílů s barvami od nejlevnější), v kartě je i skrytý strong.price-final s jinou částkou
      var pr = qs('.prices div.price', p) || qs('.prices .price:not(strong)', p);
      var pt = pr ? pr.textContent : '';
      items.push({ id: id, name: name, type: type, url: link.getAttribute('href').split('#')[0], img: img ? (img.getAttribute('data-src') || img.getAttribute('src') || '') : '', cardPrice: num(pt), cardFrom: /\bod\b/i.test(pt) });
    });
    if (!items.length) return;
    // víc dílů stejného druhu: nechat ty z řady podlahy (Flexor Checker má nájezdy i pro Planet a Crystal)
    var words = lineWords(tileName);
    function score(it) { var n = low(it.name); return words.filter(function (w) { return n.indexOf(w) !== -1; }).length; }
    ACC_ORDER.forEach(function (type) {
      var same = items.filter(function (it) { return it.type === type; });
      if (same.length < 2) return;
      var best = Math.max.apply(null, same.map(score));
      items = items.filter(function (it) { return it.type !== type || score(it) === best; });
    });
    // podlaha bez variant v jedné barvě (Dagoba - černá): díly ve stejné barvě
    var tileStem = hasVariants ? null : colorStem(tileName);
    if (tileStem) {
      var sameColor = items.filter(function (it) { return colorStem(it.name) === tileStem; });
      if (sameColor.length) items = sameColor;
    }
    items.forEach(function (it) { it.label = shortName(it.name, tileName); });
    // druh podle pořadí, stejné druhy podle názvu (Černý nájezd samec, Černý nájezd samice, Žlutý ...)
    items.sort(function (a, b) { return (ACC_ORDER.indexOf(a.type) - ACC_ORDER.indexOf(b.type)) || a.label.localeCompare(b.label, 'cs'); });
    items = items.slice(0, ACC_MAX);

    /* data z karet dílů */
    var loading = null;
    function cached(url) {
      try { var c = JSON.parse(sessionStorage.getItem(ACC_CACHE + url) || 'null'); if (c && Date.now() - c.t < ACC_TTL) return c.data; } catch (x) {}
      return null;
    }
    function parsePart(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var f = doc.getElementById('product-detail-form');
      if (!f) return null;
      var rows = qsa('table.detail-parameters tr', doc);
      function row(re) { return rows.filter(function (tr) { var th = qs('th', tr); return th && re.test(th.textContent); })[0] || null; }
      function cell(tr, idx) {
        if (!tr) return '';
        var td = qs('td', tr);
        if (!td) return '';
        if (idx != null) { var s = qsa('.choose-variant', td).filter(function (e) { return e.classList.contains(String(idx)); })[0]; if (s) return norm(s.textContent); }
        return qsa('.choose-variant', td).length ? '' : norm(td.textContent);
      }
      var avRow = row(/dostupnost/i), dateRow = row(/doru[čc]it/i);
      var vars = qsa('input[type="radio"][name="priceId"]', f).filter(function (i) { return i.value; }).map(function (i) {
        var lab = i.closest('label'), t = lab ? norm(lab.textContent) : '', m = /Barva:\s*([^,]+)/i.exec(t);
        var idx = i.getAttribute('data-index');
        return { id: +i.value, color: m ? norm(m[1]) : '', price: parseFloat(i.getAttribute('data-customerprice')), img: i.getAttribute('data-detail_small') || '', avail: cell(avRow, idx), date: cell(dateRow, idx) };
      });
      var single = null;
      if (!vars.length) {
        var pid = qs('input[name="priceId"]', f), pf = qs('.price-final', f);
        if (pid && pid.value && pf) single = { id: +pid.value, price: num(pf.textContent), avail: cell(avRow), date: cell(dateRow) };
      }
      // délka dílu: parametr Délka, jinak nejdelší z vnějších rozměrů
      var len = NaN;
      qsa('table tr', doc).some(function (tr) {
        var th = qs('th', tr), td = qs('td', tr);
        if (!th || !td) return false;
        var k = low(th.textContent), v = norm(td.textContent);
        if (/^délka/.test(k)) { len = num(v) * (/mm/.test(v) ? 0.1 : /\bm\b/.test(v) && !/cm/.test(v) ? 100 : 1); return len > 0; }
        if (/vnější rozměry/.test(k) && !(len > 0)) {
          var nums = (v.match(/\d+(?:,\d+)?/g) || []).map(function (x) { return parseFloat(x.replace(',', '.')); });
          if (nums.length) len = Math.max.apply(null, nums) * (/mm/.test(v) ? 0.1 : 1);
        }
        return false;
      });
      return { vars: vars, single: single, len: len > 0 ? Math.round(len * 10) / 10 : null };
    }
    function load() {
      if (loading) return loading;
      loading = Promise.all(items.map(function (it) {
        var c = cached(it.url);
        if (c) { it.data = c; return null; }
        return fetch(it.url, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (html) {
          it.data = parsePart(html);
          try { sessionStorage.setItem(ACC_CACHE + it.url, JSON.stringify({ t: Date.now(), data: it.data })); } catch (x) {}
        }).catch(function (e) { it.data = null; log('doplňky: díl se nenačetl', it.url, e); });
      })).then(function () { render(); });
      return loading;
    }

    /* barva podlahy */
    function tileColor() {
      var r = radios().filter(function (i) { return i.checked; })[0];
      if (!r) return null;
      var lab = r.closest('label'), m = /Barva:\s*([^,]+)/i.exec(lab ? lab.textContent : '');
      return m ? norm(m[1]).replace(/\s*\+\s*PU\s*lak.*$/i, '') : null;
    }
    function inCart(priceId) {
      try { var c = window.getShoptetDataLayer ? window.getShoptetDataLayer('cart') : null; return (c || []).filter(function (i) { return i.priceId === priceId; }).reduce(function (s, i) { return s + (i.quantity || 0); }, 0); } catch (x) { return 0; }
    }
    // co se u dílu ukáže teď: { ok, priceId, price, from, img, date, avail, missing }
    function state(it) {
      var dt = it.data, color = tileColor();
      if (!dt) return null;
      if (dt.single) return { ok: true, priceId: dt.single.id, price: dt.single.price, img: it.img, date: dt.single.date, avail: dt.single.avail };
      if (!dt.vars.length) return null;
      var min = Math.min.apply(null, dt.vars.map(function (v) { return v.price; }).filter(function (p) { return p > 0; }));
      // podlaha bez barev nebo díl s jinými variantami než barvou: vybírá se na kartě dílu
      if (!hasVariants || !dt.vars.some(function (v) { return v.color; })) return { ok: false, link: true, price: min, from: true, img: it.img };
      if (!color) return { ok: false, needColor: true, price: min, from: true, img: it.img };
      var v = dt.vars.filter(function (x) { return low(x.color) === low(color); })[0];
      if (!v) return { ok: false, missing: color, price: min, from: true, img: it.img };
      return { ok: true, priceId: v.id, price: v.price, img: v.img || it.img, date: v.date, avail: v.avail, color: v.color };
    }

    /* vykreslení */
    var box = el('div', 'sj-acc sj-acc--bar');
    var bar = el('button', 'sj-acc__bar');
    bar.type = 'button';
    bar.setAttribute('aria-expanded', 'false');
    bar.setAttribute('aria-controls', 'sjAccPanel');
    bar.innerHTML = '<span class="sj-acc__badge" aria-hidden="true">' + ICON_RAMP + '</span><span class="sj-acc__msg"></span><span class="sj-acc__toggle"><span class="sj-acc__toggle-text">Vybrat</span> ' + ICON_CHEV + '</span>';
    var panel = el('div', 'sj-acc__panel');
    panel.id = 'sjAccPanel';
    panel.hidden = true;
    var warn = el('p', 'sj-acc__warn');
    warn.hidden = true;
    var list = el('ul', 'sj-acc__list');
    var note = el('p', 'sj-acc__note');
    note.hidden = true;
    panel.appendChild(warn);
    panel.appendChild(list);
    panel.appendChild(note);
    box.appendChild(bar);
    box.appendChild(panel);
    cartBlock.parentNode.insertBefore(box, cartBlock.nextSibling);

    function message() {
      var types = ACC_ORDER.filter(function (t) { return items.some(function (it) { return it.type === t; }); });
      var w = types.map(function (t) { return ACC_WORDS[t]; });
      var what = w.length > 1 ? w.slice(0, -1).join(', ') + ' a ' + w[w.length - 1] : w[0];
      what = what.charAt(0).toUpperCase() + what.slice(1);
      var color = hasVariants ? tileColor() : null;
      var states = items.map(state).filter(Boolean);
      var shown = states.filter(function (s) { return s.ok; });
      // dokud se karty dílů nenačetly, cena z karet v Souvisejících produktech
      var prices = (shown.length ? shown : states.length ? states : items.map(function (it) { return { price: it.cardPrice }; }))
        .map(function (s) { return s.price; }).filter(function (p) { return p > 0; });
      var tail;
      if (!hasVariants) tail = ' k podlaze';
      else if (!color || !states.length) tail = ' ve stejné barvě jako podlaha';
      else tail = shown.length ? ' v barvě ' + color : ' k podlaze';
      var from = prices.length ? ' od ' + kc(Math.min.apply(null, prices)) : '';
      var msg = qs('.sj-acc__msg', bar);
      msg.innerHTML = '<strong></strong><span></span>';
      msg.firstChild.textContent = what;
      msg.lastChild.textContent = tail + from;
    }
    function row(it) {
      var s = state(it);
      var li = el('li', 'sj-acc__item');
      var img = el('span', 'sj-acc__img');
      var src = s ? s.img : it.img;
      if (src) { var im = el('img'); im.src = src; im.alt = ''; im.loading = 'lazy'; img.appendChild(im); }
      li.appendChild(img);
      var text = el('span', 'sj-acc__text');
      var a = el('a', 'sj-acc__name');
      a.href = it.url;
      a.textContent = it.label;
      text.appendChild(a);
      var sub = el('span', 'sj-acc__sub');
      if (!s) sub.textContent = it.data === undefined ? 'Načítám…' : 'Podrobnosti na kartě dílu';
      else if (s.missing) sub.textContent = 'V barvě ' + s.missing + ' není';
      else {
        sub.innerHTML = (s.from ? 'od ' : '') + '<b></b> / ks';
        sub.querySelector('b').textContent = kc(s.price);
        var hint = it.type === 'corner' ? 'na roh nájezdu' : (it.data && it.data.len ? '1 ks = ' + String(it.data.len).replace('.', ',') + ' cm' : '');
        if (hint) { var h = el('span', 'sj-acc__hint'); h.textContent = hint; sub.appendChild(h); }
        var q = s.ok ? inCart(s.priceId) : 0;
        if (q) { var c = el('span', 'sj-acc__in'); c.textContent = 'V košíku ' + q + ' ks'; sub.appendChild(c); }
      }
      text.appendChild(sub);
      li.appendChild(text);
      var buy = el('span', 'sj-acc__buy');
      if (s && (s.missing || s.link)) {
        var o = el('a', 'sj-acc__other');
        o.href = it.url;
        o.textContent = s.missing ? 'Jiná barva' : 'Vybrat';
        buy.appendChild(o);
      } else if (s) {
        var qty = el('span', 'sj-acc__qty');
        qty.innerHTML = '<button type="button" aria-label="Snížit množství">−</button><input type="number" min="1" step="1" value="1" inputmode="numeric"><button type="button" aria-label="Zvýšit množství">+</button>';
        var input = qs('input', qty);
        input.setAttribute('aria-label', 'Množství: ' + it.label);
        qsa('button', qty).forEach(function (b, k) {
          b.addEventListener('click', function () { input.value = Math.max(1, (parseInt(input.value, 10) || 1) + (k ? 1 : -1)); });
        });
        var btn = el('button', 'sj-acc__add');
        btn.type = 'button';
        btn.textContent = 'Přidat';
        btn.addEventListener('click', function () { add(it, btn, input); });
        // Enter v poli by odeslal formulář produktu (přidal podlahu), proto přidá díl
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(it, btn, input); } });
        buy.appendChild(qty);
        buy.appendChild(btn);
      }
      li.appendChild(buy);
      return li;
    }
    function render() {
      message();
      if (panel.hidden) return;
      list.innerHTML = '';
      items.forEach(function (it) { list.appendChild(row(it)); });
      // termín doručení dílů, nejpozdější ze zobrazených
      var dates = items.map(state).filter(function (s) { return s && s.ok && s.date; }).map(function (s) { return s.date; });
      var last = dates.sort(function (a, b) {
        function key(x) { var m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(x); return m ? +m[3] * 10000 + +m[2] * 100 + +m[1] : 0; }
        return key(a) - key(b);
      }).pop();
      note.hidden = !last;
      if (last) note.textContent = (dates.length > 1 ? 'Díly doručíme do ' : 'Doručíme do ') + shortDate(last);
    }
    function setOpen(open) {
      panel.hidden = !open;
      box.classList.toggle('is-open', open);
      bar.setAttribute('aria-expanded', open ? 'true' : 'false');
      qs('.sj-acc__toggle-text', bar).textContent = open ? 'Skrýt' : 'Vybrat';
      if (open) { render(); load(); }
    }
    bar.addEventListener('click', function () {
      var open = panel.hidden;
      setOpen(open);
      if (open) track({ event: 'sj_acc_open' });
    });
    // karty dílů se stahují až při najetí na lištu nebo při kliknutí, ať stránka nestahuje nic navíc zbytečně
    ['mouseenter', 'focus', 'touchstart'].forEach(function (ev) { bar.addEventListener(ev, function () { load(); }, { passive: true }); });

    function promptColor() {
      warn.textContent = 'Nejdřív vyberte barvu podlahy.';
      warn.hidden = false;
      var v = qs('.p-variants-block', form) || form;
      var top = v.getBoundingClientRect().top + (window.pageYOffset || d.documentElement.scrollTop) - 100;
      try { window.scrollTo({ top: top, behavior: 'smooth' }); } catch (x) { window.scrollTo(0, top); }
    }
    function add(it, btn, input) {
      var s = state(it);
      if (!s || !s.ok) { if (s && s.needColor) promptColor(); return; }
      if (btn.disabled) return;
      var q = Math.max(1, parseInt(input.value, 10) || 1);
      input.value = q;
      btn.disabled = true;
      btn.textContent = 'Přidávám…';
      var done = false, timer;
      function finish(ok) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        d.removeEventListener('ShoptetCartUpdated', onUpdated);
        btn.disabled = false;
        if (!ok) { btn.textContent = 'Přidat'; warn.textContent = 'Díl se teď nepodařilo přidat. Zkuste to na jeho kartě.'; warn.hidden = false; return; }
        track({ event: 'sj_acc_add', sj_acc_name: it.name, sj_acc_qty: q });
        warn.hidden = true;
        // řádek znovu s počtem v košíku (dataLayer košíku Shoptet obnoví spolu s událostí, proto chvilku počkat)
        setTimeout(function () {
          var li = btn.closest('.sj-acc__item');
          var fresh = row(it);
          var fb = qs('.sj-acc__add', fresh);
          if (fb) { fb.classList.add('is-added'); fb.innerHTML = ICON_CHECK + 'Přidáno'; setTimeout(function () { if (fb.isConnected) { fb.classList.remove('is-added'); fb.textContent = 'Přidat'; } }, 3000); }
          var fi = qs('input', fresh);
          if (fi) fi.value = q;
          if (li && li.parentNode) li.parentNode.replaceChild(fresh, li);
        }, 150);
      }
      function onUpdated() { finish(true); }
      d.addEventListener('ShoptetCartUpdated', onUpdated);
      timer = setTimeout(function () { finish(false); }, 10000);
      try { window.shoptet.cartShared.addToCart({ priceId: s.priceId, amount: q }, true); } catch (e) { log('doplňky: přidání selhalo', e); finish(false); }
    }

    // změna barvy podlahy
    function onVariant() { warn.hidden = true; render(); }
    form.addEventListener('change', function (e) { if (e.target && e.target.name === 'priceId') setTimeout(onVariant, 30); });
    ['ShoptetVariantAvailable', 'ShoptetVariantUnavailable'].forEach(function (n) { d.addEventListener(n, function () { setTimeout(onVariant, 30); }); });
    message();
    log('doplňky: ' + items.map(function (it) { return it.label; }).join(', '));
  }

  onReady(function () {
    badge();
    try {
      var form = d.getElementById('product-detail-form');
      if (form && d.body.classList.contains('type-detail')) accessories(form);
    } catch (e) { log('doplňky: chyba', e); }
  });
})();
