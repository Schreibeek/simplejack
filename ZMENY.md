# Změny na e-shopu simplejack.cz

Co se na webu změnilo a kdy. Nové záznamy patří nahoru. Drobné úpravy vzhledu (mezery, odsazení) se sem nepíšou.

## 23. 10. 2026

- Filtr v parametrických kategoriích (31 kategorií, např. /gumove-podlahy-do-garaze/) je ve výchozím stavu zavřený. Shoptet bral přednastavený filtr jako aktivní a sám ho otevíral. První produkty jsou teď na desktopu na 720 px (dřív 2 557 px) a na mobilu na 1 029 px (dřív 4 988 px). Běžné kategorie a stránky, kde si zákazník už něco vyfiltroval, se nemění. Skript je v js/simplejack.js (Freelo 33266225).
- Vlastní CSS a JS se načítají z tohoto repozitáře přes GitHub Pages: css/simplejack.css na posledním řádku záhlaví, js/simplejack.js na druhém řádku zápatí (pod sj.js). Staré kopie v repozitářích shoptet-css a shoptet-js SimpleJack už nenačítá.
- Testovací verze nového kalkulátoru plochy a množstevní slevy. Zapíná se jen parametrem ?sjtest=1 v adrese a platí jen v prohlížeči, kde se zapnula. Vypíná se přes ?sjtest=0 nebo odkazem ve štítku Testovací verze. Pro ostatní je web beze změny. Přepínač je v js/simplejack.js, testovací kód ve složce test/. V zápatí Shoptetu se simplejack.js zvedl z ?v=1 na ?v=2.
  - Kalkulátor plochy místo staré kalkulačky ze sj.js. Před výběrem barvy ukazuje výzvu, po výběru pole m² s - a +, rychlou volbu 10 až 100 m², 10% prořez a nápovědy v (i). Kusy zapíše do množství v košíku. Kusy na m² a krok množství bere ze sj.js, takže výsledek vyjde stejně jako se starou kalkulačkou. U nájezdů a rohů se neukáže, protože k nim sj.js nemá data o m².
  - Množstevní sleva místo tabulky Shoptetu, jen u produktů s nastavenou slevou. Zavřená lišta ukazuje zprávu podle množství. Po rozkliknutí jsou vidět cenové hladiny, tip na další hladinu a tlačítko Nastavit X ks.
  - Blok Do košíku ukazuje cenu celkem podle hladiny slevy a pod ní cenu za kus a za m². U akčních cen ukazuje přeškrtnutou cenu celkem.
  - Řádek Kód v parametrech se ukáže až po výběru varianty.
  - Úpravy po Davidově testu (večer): rámeček kolem variant po kliknutí na výzvu končí 10 px pod vzorky, aby nezasahoval do parametrů. Výzva kalkulátoru je na mobilu bez šipky. Poznámka pod cenovými hladinami slevy je odsazená 10 px od dlaždic a mezera pod ní se zmenšila.
