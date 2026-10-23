// Testovací verze (nový kalkulátor plochy a množstevní sleva)
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
  // starou kalkulačku ze sj.js schovat hned, ať neproblikne (vrátí se, kdyby nová nešla spustit)
  var style = document.createElement('style');
  style.textContent = 'html.sj-test:not(.sj-calc-fallback) #measure-banner{display:none!important}';
  document.head.appendChild(style);
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
