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
