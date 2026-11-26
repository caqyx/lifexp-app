# Łatki gier kopiowanych (Wartime, Gridlock)

Wartime i Gridlock to kopie gier właściciela z jego repozytoriów (PLAN.md 9.1, g-2). Wszystko, co LifeXP
w nich zmienia, robi `scripts/vendor-game.mjs` przy każdym kopiowaniu, więc zmiany przetrwają nową
wersję gry: `git -C <klon> pull && node scripts/vendor-game.mjs <gra> <klon>`. Zatwierdzona kopia
w `v2/public/games/<gra>/` = gra z commita zapisanego w `VENDORED.json` + łatki z tej listy.

## Jak działają łatki

- **Pliki LifeXP** (`add`) leżą w `scripts/vendor-patches/<gra>/` i są kopiowane do gry
  (np. `lifexp-polish.css`, `lifexp-polish.js`). Skrypt odmawia, gdy gra ma już plik o tej nazwie.
  To preferowany sposób: nowe zachowanie w osobnym pliku, gra nietknięta.
- **Wpięcie** (`find`/`replace` w `index.html`) dodaje `<link>`/`<script>` przy stałym miejscu strony
  (`</head>`, pierwszy skrypt gry).
- **Zamiana tekstu** (`find`/`replace`) tylko tam, gdzie inaczej się nie da (kod wewnątrz zamkniętej
  funkcji gry). Każda łatka musi trafić **dokładnie raz** — gdy gra się zmieni i kotwica zniknie albo
  pojawi się dwa razy, kopiowanie się zatrzymuje z nazwą łatki i pliku. Poprawia się wtedy kotwicę
  na liście `GAMES` w skrypcie.
- **Sprawdzenie** (`expect`) tylko potwierdza, że tekst w grze jest (np. wyłączone reklamy).
- `tests/vendor-game.spec.js` sprawdza, że zatwierdzona kopia ma każdą łatkę z listy, a `VENDORED.json`
  wymienia je wszystkie; że pliki LifeXP są w kopii bajt w bajt; że nazwy z gry, na których opiera się
  `lifexp-polish.js` (`tryDash`, `die`, `skinColor`, `_dashPressX`, `alive`, `cube`, `N`), nadal istnieją.
  `tests/v2/games.spec.js` gra w obie gry w ramce LifeXP (m.in. skok Gridlocka samym dotknięciem).

Pomiar przed i po (Pixel 7 w Playwright, procesor zwolniony 4× i 6× przez CDP, czasy klatek z
`requestAnimationFrame`): w piaskownicy Chromium rysuje canvas programowo, na głównym wątku, czego
prawdziwy telefon z GPU nie robi — liczby są więc pesymistyczne, ale różnice „przed/po” w kosztach
JS i stylu są prawdziwe także na telefonie.

## Gridlock

| # | Plik | Co | Dlaczego | Jak przenieść do gry (upstream) |
|---|---|---|---|---|
| 1 | `index.html` | Usunięty skrypt CrazyGames SDK | Zewnętrzny skrypt platformy z reklamami; bez niego `js/sdk.js` działa „standalone” | Wersja gry bez SDK (np. flaga przy budowaniu) |
| 2 | `js/main.js` | „Reset” kasuje tylko klucze `cm_*` zamiast `localStorage.clear()` | Gra działa na originie LifeXP; `clear()` skasowałoby motyw, szkice offline i sesje grania | Ta sama linijka w grze: `Object.keys(localStorage).filter(k => k.startsWith('cm_'))…` |
| 3 | `js/constants.js` | Sprawdzenie `ADS_ENABLED = false` | Reklamy i nagrody za reklamy wyłączone | — (już w grze) |
| 3a | `index.html` | Wpięcie: `<link rel="stylesheet" href="lifexp-polish.css">` przed `</head>`, `<script src="lifexp-polish.js">` przed `js/constants.js` | Pliki LifeXP ładują się po stylu gry i przed jej skryptami (płótno ostre od pierwszej klatki) | Niepotrzebne, gdy łatki 4–12 trafią do gry |
| 4 | `lifexp-polish.css` (nowy) | Ukryte ekrany bez animacji | Logo menu (pulsujący `text-shadow`), migający napis „Game over” i twarz Cubka animowały się pod planszą: w każdej klatce gry przeliczenie stylu i malowanie niewidocznych rzeczy. Wejścia ekranów grają od początku przy pokazaniu | W `showScreen()` dodawać ukrytym ekranom klasę i w CSS `animation: none` dla niej (albo `display: none` zamiast `visibility: hidden`) |
| 5 | `lifexp-polish.css` | Pulsowanie pól ostrzegawczych (`.block-charge`, `.laser-charge`) przez `opacity` zamiast `filter: brightness` | `filter` animuje się na głównym wątku; przy deszczu bloków bossa to dziesiątki pól co klatkę. `opacity` robi kompozytor; kolor i rytm bez zmian | Zmienić `@keyframes laser-pulse` na `opacity` |
| 6 | `lifexp-polish.css` | `#anim-canvas { width/height: 100% }` | Płótno ma bitmapę w gęstości ekranu (łatka 8), więc rozmiar CSS = plansza | Razem z łatką 8 |
| 7 | `lifexp-polish.css` | Dotyk: `touch-action: manipulation`, bez zaznaczania tekstu i menu długiego dotyku (pola tekstowe dalej zaznaczają) | Szybkie stukanie w planszę nie zaznacza napisów, nie przybliża strony i nie pokazuje dymka | Te reguły do `cube_master.css` (`html, body`) |
| 8 | `lifexp-polish.js` (nowy) + `js/board-render.js` | Ostra plansza: płótno animacji i pamięć wyglądu kostki rysowane w gęstości ekranu (`devicePixelRatio`, maks. 2×); gra dalej liczy w pikselach CSS (`lifexpHiDpiCanvas`). W `board-render.js` jedna zamiana: `skinCache = lifexpHiDpiCanvas(document.createElement('canvas'))` | Na telefonie (2,6×) płótno w 1× było rozmyte: kostka, linie siatki, lasery | W `buildBoard()`: `canvas.width = size * dpr; ctx.setTransform(dpr,0,0,dpr,0,0)` + CSS rozmiar; to samo dla `skinCache` |
| 9 | `lifexp-polish.js` | Skok przy **dotknięciu** pola, nie przy puszczeniu palca | Cel był już blokowany przy dotknięciu (`_dashPressX`), puszczenie dokładało tylko czas stuknięcia (~80–120 ms) do reakcji — w grze o unikach to dużo | W `pointerdown` komórki od razu `tryDash(x, y)` zamiast zapamiętywania do `pointerup` |
| 10 | `lifexp-polish.js` + `.css` | Pierścień w miejscu lądowania skoku (300 ms, kolor skórki) | Czytelne potwierdzenie ruchu (efekt tylko `transform`/`opacity`) | Ten sam element w grze albo pierścień na canvasie w `animLoop` |
| 11 | `lifexp-polish.js` + `.css` | Przy śmierci czerwony błysk krawędzi planszy i krótki wstrząs (340 ms) | Trafienie czuć od razu, zanim wjedzie ekran końca | Klasa na `#board-wrap` w `die()` |
| 12 | `lifexp-polish.css` | `prefers-reduced-motion`: bez wstrząsu (zostaje błysk), bez pływającego logo, wstrząsu pioruna, pętli dekoracyjnych i cząstek tła; ostrzeżenia na planszy zostają | Dostępność; gra nie miała żadnej reguły dla ograniczonego ruchu | Te reguły w `cube_master.css` |

Reguły gry, balans i zapisy (`cm_*`) bez zmian.

## Wartime

| # | Plik | Co | Dlaczego | Jak przenieść do gry (upstream) |
|---|---|---|---|---|
| 1 | `css/mobile.css` | Menu (arkusz u dołu) mieści się w ekranie i przewija się | Na telefonie w poziomie (360 px) górne pozycje wychodziły poza ekran | `max-height` + `overflow-y: auto` w regule `.dropdown` |
| 2 | `js/ui/render.js` | Nazwy państw: szerokość każdej nazwy mierzona raz (na 100 px, potem skalowana), czcionka ustawiana tylko dla nazw, które się rysują | Każda klatka przesuwania mapy ustawiała czcionkę i `letterSpacing` i mierzyła wszystkie ~200 nazw, także poza ekranem i zasłonięte — największy koszt JS klatki (ok. 11 % próbek profilu przy przesuwaniu, po łatce ok. 3 %) | Ta sama zmiana w `drawCountryLabels()`: `L.lxW` liczone raz, `tw = L.lxW * px` |
| 3 | `js/core/goals.js` + `lifexp-patches.js` (nowy) | **Błąd: misja nie zaliczała się od razu.** Objaw: po zdobyciu kilku prowincji naraz (traktat pokojowy, umowa terytorialna) karta „Posiadaj 6 prowincji” pokazywała „7 / 6” z pełnym paskiem, a misja zaliczała się dopiero na końcu następnej tury. Przyczyna: misje (i osiągnięcia) sprawdzał tylko krok końca tury `WT.goals.processTurn` — porównanie `have >= need` było dobre, ale nie było wywoływane po zmianie stanu w środku tury. Poprawka: `goals.js` udostępnia `checkMissions` i `checkAchievements`; `lifexp-patches.js` wywołuje je po każdej zmianie właściciela prowincji (`WT.state.setOwner`), po zdarzeniach `peace`, `annex`, `vassal`, `released`, `goal`, po każdym stuknięciu/kliknięciu/klawiszu gracza (np. uniwersytety w God Mode, badania, odpowiedź na wydarzenie) i po wczytaniu zapisu (`goals.attach`), więc zapis już „przekroczony” zalicza się przy wczytaniu. Sprawdzenie na końcu tury zostaje. W trakcie `newGame` nic się nie sprawdza, a misje nie są tworzone w połowie akcji | Wywołać `checkMissions(); checkAchievements();` po zmianie właściciela prowincji i po akcjach gracza (albo jedno `onStateChanged`) |
| 4 | `js/ui/ui.js` | **Błąd: decyzja zapisana w grze nie pokazywała się po wczytaniu.** Objaw: wydarzenie czekające na wybór gracza (np. „Boom gospodarczy”) zapisane w slocie po wczytaniu nie otwierało okna aż do końca następnej tury, a do tego czasu blokowało nowe wydarzenia. Przyczyna: `enterGame()` wołał tylko `checkProposals`, a `checkEvents` tylko koniec tury. Poprawka: `enterGame()` woła `checkEvents` (który na końcu woła `checkProposals`) | Ta sama zamiana w `enterGame()` |
| 5 | `js/core/world.js`, `js/ui/ui.js`, `lifexp-patches.js`, `lifexp-patches.css` (nowy), `index.html` | **Ustawienia wydarzeń losowych** (prośba właściciela) w oknie „Ustawienia gry”: każde wydarzenie losowe (kryzys, boom, strajk, klęska, epidemia, złoża, przełom naukowy, ochotnicy, dezercje, afera, rewolucja), bunty, wojny koalicji, wybory i wydarzenia historyczne — włącz/wyłącz; losowe, bunty i koalicje także „Jak często”: Rzadko ×0,5 / Normalnie ×1 / Często ×2 szansy gry; bunty także „Siła”: Łagodny ×0,6 / Normalny / Ostry ×1,5 armii powstańców. Domyślnie wszystko jak w grze (przy domyślnych ustawieniach działa kod gry bez zmian, to samo ziarno daje tę samą grę). Ustawienia w tej przeglądarce (`wartime_lifexp_events`, `{ v: 1, events }`; zły lub stary wpis = domyślne), dla każdej gry, nowej i wczytanej; trwająca gra bierze zmianę od razu (czytane przy losowaniu); dotyczą wszystkich państw, nie tylko gracza. Wpięcia w `world.js` to krótkie wywołania `WT.lifexpEvents` przy losowaniu wydarzeń, buncie (szansa i armia), koalicji, wyborach i wydarzeniach historycznych | Ustawienia w `G.settings` albo w osobnym kluczu i te same mnożniki w `world.js` |
| 5a | `index.html` | Wpięcie: `lifexp-patches.css` po `css/mobile.css`, `lifexp-patches.js` przed `js/main.js` | Pliki LifeXP po stylach i skryptach gry, przed startem | Niepotrzebne, gdy 3–5 trafią do gry |

Testy: `v2/tests/wartime.test.ts` (logika gry w node na prawdziwej mapie: misja przy dwóch prowincjach
naraz, zapis przekroczony przy wczytaniu, Imperium od razu, uniwersytety w God Mode po stuknięciu,
mapowanie częstości i siły, wyłączony bunt przez 60 tur pełnych niepokojów, wyłączone wydarzenia przez
400 tur, „Często” > „Rzadko”, domyślne = gra bez zmian); `tests/v2/games.spec.js` (telefon poziomo:
ustawienia zapisane i po przeładowaniu, decyzja z zapisu po wczytaniu). Testy gry z jej repozytorium
(`tests/run_tests.js`, 50) przechodzą na kopii z łatkami.

Wartime miał już dobre sterowanie dotykiem (zdarzenia `pointer`, `touch-action: none`, szczypanie,
bezwładność, długie przytrzymanie, bezpieczne obszary) i regułę `prefers-reduced-motion`; tu nic nie
zmieniono.

**Przegląd błędów (2026-11-25), bez poprawki:** symulacje 150–200 tur na prawdziwej mapie (2026, 1939,
1914, 1385; gracze POL, UKR, RUS, DEU) ze sprawdzaniem po każdej turze (NaN, zakresy stabilności i
niepokojów, martwi właściciele i okupanci, indeksy, armie, wojny, zapis → odczyt) i przejście UI na
Pixel 7 pionowo i poziomo oraz na komputerze (menu, cele, ustawienia, nauka, ranking, statystyki,
zapis, wynik; wychodzenie poza ekran) — bez dalszych błędów. Do decyzji właściciela:
- gra jest tylko po polsku (`?lang=en` z LifeXP nic nie zmienia);
- komentarz w `goals.js` mówi, że misje są „uzupełniane po wykonaniu”, ale kod tworzy je raz na partię;
- odpowiedź na wydarzenie działa na stan z chwili odpowiedzi (np. „Odkrycie złóż” w prowincji, która
  zdążyła zmienić właściciela); w zwykłej grze okno wydarzenia otwiera się od razu, więc tego nie widać.

## Do przeniesienia do gry, ale nie łatane tutaj

- Wartime: po końcu tury przebudowa granic (`drawCountryBorders`: `getImageData` + `edgeDetect`) to jedno
  zadanie ~0,6 s przy CPU 4× — do rozbicia na kafle w kolejnych klatkach.
- Wartime: pierwsze otwarcie to parsowanie `data/map.js` (3,7 MB) — dane w JSON albo w mniejszej precyzji
  skróciłyby start.
- Gridlock: `render()` przy każdym wywołaniu zeruje klasy i style wszystkich 256 pól, a potem ustawia je
  znowu — lepiej porównać ze stanem poprzednim i zmieniać tylko różnice.
