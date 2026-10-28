# Změny na e-shopu simplejack.cz

Co se na webu změnilo a kdy. Nové záznamy patří nahoru. Drobné úpravy vzhledu (mezery, odsazení) se sem nepíšou.

## 28. 10. 2026

- Záložka Časté dotazy na kartě vinylových produktů, hned za Popisem, je pro všechny zákazníky, předtím jen v testovací verzi. Kód je v js/simplejack.js, styly v css/simplejack.css.
  - Otázky a odpovědi bere ze stránky Nejčastější dotazy (/caste-dotazy-podlaha-simplejack-faq/), upravují se jen tam. Stránka musí zůstat na stejné adrese a dotazy na ní jako rozbalovací bloky. Nová návštěva vidí úpravu hned, rozjetá nejpozději do 6 hodin.
  - Stránku s dotazy stáhne jednou za návštěvu, až je produkt načtený (kvůli počtu dotazů v názvu záložky), při najetí na záložku dřív. Načítání produktu nezdržuje.
  - Rozvržení jako Popis: od 1200 px dotazy vlevo (2/3), vpravo panel Nenašli jste odpověď? s telefonem, e-mailem a tlačítkem chatu. Na mobilu položka v akordeonu.
  - Odkaz na stránku s dotazy v popisu produktu otevře záložku, adresa produktu s #faq ji otevře rovnou.
  - Do dataLayer posílá sj_faq_open, sj_faq_question (s textem otázky), sj_faq_phone, sj_faq_email a sj_faq_chat. Značky v GTM na ně zatím nejsou.
  - Jen u vinylu (podle názvu a kategorie produktu), dotazy jsou psané pro vinyl.
- Kratší názvy záložek na kartě produktu: Soubory místo Související soubory, SimpleJack místo Značka SimpleJack. V administraci Shoptetu je změnit nejde. Pod 1440 px mají záložky menší odsazení, od 1280 px se tak vejdou do jednoho řádku všechny.
- PoptIn (popup Kalkulace ZDARMA) se už neukazuje v košíku a v objednávce, vyloučené /kosik/ a /objednavka/ (bod 1 auditu, Freelo 32388178).
- Testovací verze (?sjtest=1) je zase prázdná, jen se štítkem.

## 24. 10. 2026

- Kalkulátor plochy, množstevní sleva, cena v bloku Do košíku a řádek Kód po výběru varianty jsou pro všechny zákazníky, předtím jen v testovací verzi. Kód je v js/simplejack.js, styly v css/simplejack.css.
  - Kalkulátor plochy místo staré kalkulačky ze sj.js: před výběrem barvy výzva, po výběru pole m² s - a + po 0,5 m² (vždy s desetinou), rychlá volba 10 až 100 m², 10% prořez a nápovědy. Kusy zapíše do množství v košíku. Kusy na m² a krok bere ze sj.js, stará kalkulačka tam dál běží schovaná a nesmí se vypnout.
  - Množstevní sleva místo tabulky Shoptetu, jen u produktů se slevou: lišta se zprávou podle množství, po rozkliknutí cenové hladiny, tip na další hladinu a tlačítko Nastavit X ks.
  - Cena v bloku Do košíku vypadá jako dřív, jen se počítá přesně se slevou. Po zadání plochy ukáže cenu celkem (Solum Skin 30 m² = 120 ks za 35 532 Kč, stará kalkulačka ukazovala 39 480 Kč bez slevy), pod ní cenu za m².
  - Řádek Kód v parametrech se ukáže až po výběru varianty.
  - Kalkulátor a lišta slevy se ukážou hned se stránkou a nečekají na sj.js. Kusy na m² se nejdřív vezmou z parametru Počet dlaždic na 1 m², přesná data ze sj.js je pak doplní a zadané kusy se případně samy přepočítají. Produkty bez toho parametru čekají na sj.js jako dřív.
- Testovací verze (?sjtest=1) je teď prázdná, jen se štítkem, a je připravená na další test.

## 23. 10. 2026

- Filtr v parametrických kategoriích (31 kategorií, např. /gumove-podlahy-do-garaze/) je ve výchozím stavu zavřený. Shoptet bral přednastavený filtr jako aktivní a sám ho otevíral. První produkty jsou teď na desktopu na 720 px (dřív 2 557 px) a na mobilu na 1 029 px (dřív 4 988 px). Běžné kategorie a stránky, kde si zákazník už něco vyfiltroval, se nemění. Skript je v js/simplejack.js (Freelo 33266225).
- Vlastní CSS a JS se načítají z tohoto repozitáře přes GitHub Pages: css/simplejack.css na posledním řádku záhlaví, js/simplejack.js na druhém řádku zápatí (pod sj.js). Staré kopie v repozitářích shoptet-css a shoptet-js SimpleJack už nenačítá.
- Testovací verze nového kalkulátoru plochy a množstevní slevy. Zapíná se jen parametrem ?sjtest=1 v adrese a platí jen v prohlížeči, kde se zapnula. Vypíná se přes ?sjtest=0 nebo odkazem ve štítku Testovací verze. Pro ostatní je web beze změny. Přepínač je v js/simplejack.js, testovací kód ve složce test/. V zápatí Shoptetu se simplejack.js zvedl z ?v=1 na ?v=2.
  - Kalkulátor plochy místo staré kalkulačky ze sj.js. Před výběrem barvy ukazuje výzvu, po výběru pole m² s - a +, rychlou volbu 10 až 100 m², 10% prořez a nápovědy v (i). Kusy zapíše do množství v košíku. Kusy na m² a krok množství bere ze sj.js, takže výsledek vyjde stejně jako se starou kalkulačkou. U nájezdů a rohů se neukáže, protože k nim sj.js nemá data o m².
  - Množstevní sleva místo tabulky Shoptetu, jen u produktů s nastavenou slevou. Zavřená lišta ukazuje zprávu podle množství. Po rozkliknutí jsou vidět cenové hladiny, tip na další hladinu a tlačítko Nastavit X ks.
  - Blok Do košíku ukazuje cenu celkem podle hladiny slevy a pod ní cenu za kus a za m². U akčních cen ukazuje přeškrtnutou cenu celkem.
  - Řádek Kód v parametrech se ukáže až po výběru varianty.
  - Úpravy po Davidově testu (večer): rámeček kolem variant po kliknutí na výzvu končí 10 px pod vzorky, aby nezasahoval do parametrů. Výzva kalkulátoru je na mobilu bez šipky. Poznámka pod cenovými hladinami slevy je odsazená 10 px od dlaždic a mezera pod ní se zmenšila.
