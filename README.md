# SimpleJack.cz

Vlastní CSS, JS a zálohy pro e-shop simplejack.cz (Shoptet).

- css/simplejack.css - vlastní styly, načítá se v záhlaví Shoptetu
- js/simplejack.js - vlastní skripty, načítá se v zápatí Shoptetu: přepínač testovací verze, filtr v parametrických kategoriích, detail produktu (kalkulátor plochy, množstevní sleva, cena v bloku Do košíku, řádek Kód)
- zalohy/ - zálohy stránek a HTML kódů
- ZMENY.md - co se na webu změnilo a kdy (nové záznamy nahoru)

Soubory běží přes GitHub Pages:

- https://schreibeek.github.io/simplejack/css/simplejack.css
- https://schreibeek.github.io/simplejack/js/simplejack.js

Po změně souboru zvýšit v Shoptetu číslo verze v odkazu (?v=), jinak se může načítat stará verze z mezipaměti.

HTML kódy v Shoptetu: Vzhled a obsah > Editor > HTML kód

Detail produktu: kalkulátor plochy bere kusy na m² a krok množství ze sj.js (sj.miskovec.eu, dělal externista). Starou kalkulačku ve sj.js nevypínat, dokud nová nebude mít vlastní zdroj dat, jinak se nová neukáže.

Testovací verze (pro úpravy, které má nejdřív vidět jen David):

- ?sjtest=1 v adrese ji zapne, ?sjtest=0 vypne. Platí jen v prohlížeči, kde se zapnula (localStorage), a v rohu je štítek s odkazem na vypnutí.
- Přepínač je na začátku js/simplejack.js. Bez zapnutí se nic dalšího nenačte.
- Soubory test/sj-test.css a test/sj-test.js se v testu načítají vždy čerstvé, po změně stačí nahrát na GitHub, ?v= v Shoptetu se nemění.
- Od 24. 10. 2026 je prázdná, jen se štítkem. Kalkulátor a sleva z prvního testu jsou pro všechny.

Repozitář je veřejný. Nedávat sem nic s údaji zákazníků ani přístupy.
