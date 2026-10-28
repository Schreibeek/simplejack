/* SimpleJack - testovací verze. Načítá se jen v prohlížeči, kde je zapnutý test (?sjtest=1, viz js/simplejack.js).
   Teď v ní nic není, jen štítek Testovací verze s odkazem na vypnutí.
   Kalkulátor plochy a sleva jsou od 24. 10. 2026 pro všechny, záložka Časté dotazy a kratší názvy záložek
   od 28. 10. 2026. Obojí je v js/simplejack.js. */
(function () {
  'use strict';
  var d = document;
  function qs(sel, ctx) { return (ctx || d).querySelector(sel); }
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

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

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', badge); else badge();
})();
