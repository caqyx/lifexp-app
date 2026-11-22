# LifeXP v2 — wydajność (q-perf, 2026-11-22)

Przegląd wydajności v2 poza grami (`v2/public/games` bez zmian). Liczby to pomiary, nie szacunki; skąd się
biorą i jak je powtórzyć — sekcja „Jak mierzone”. Wpis w planie: `PLAN.md` 9.1, wiersz q-perf.

## Jak mierzone

- Build produkcyjny (`npm run build --prefix v2`), serwer testów (`tests/support/static-server.js`, **bez
  gzip** — GitHub Pages kompresuje, więc w terenie bajty są ok. 3× mniejsze niż w kolumnie „surowe”).
- Playwright, profil **Pixel 7** (412×915, DPR 2,625, dotyk), **CPU 4×** przez CDP, emulatory Auth + Firestore
  (Functions się tu nie uruchamia), Service Worker zablokowany. „Wolne 4G”: 150 ms RTT, 1,6 Mb/s w dół.
- Konto: 150 zadań, 150 transakcji, 150 notatek, 150 wydarzeń, 60 aktywności i 60 dni `dailyLog`, Kalendarz
  włączony; przed pomiarem każdy ekran list odwiedzony raz (pamięć podręczna Firestore jak u stałego użytkownika).
- Zimny start: nowy kontekst przeglądarki z zapisaną sesją i IndexedDB, pusta pamięć HTTP. „Pierwszy ekran” = górny
  pasek z profilem; „treść” = Dziś bez żadnego szkieletu; „interaktywny” = koniec ostatniego długiego zadania
  (> 50 ms) przed 2 s ciszy.
- Maszyna jest dzielona z innymi agentami (obciążenie 2–16 na 4 rdzeniach), więc czasy ścienne szumią ±30 %.
  Dlatego: przed i po **naprzemiennie** w jednym przebiegu, mediana z 7 (zimny start) albo z 2 przebiegów,
  a obok liczby niezależne od szumu (bajty, żądania, nasłuchy, odczyty układu, profil CPU z mapami źródeł).
- Narzędzia pomiaru nie są w repo (jednorazowe); stałe strażniki są w „Budżety i testy”.

## Wyniki

Mediana; „przed” = `main` z 2026-11-21 (b14d5fa), „po” = q-perf. Czasy w ms od początku nawigacji, CPU 4×.

**Start (zimny, zalogowany, ekran Dziś)**

| Miara | Przed | Po |
|---|---|---|
| JS startu (wejście + statyczne importy), surowe / gzip | 288 / 98 kB | 224 / 78 kB |
| CSS startu | 49 kB | 49 kB |
| JS pobrany do pełnej treści Dziś (surowe) | 758 kB | 693 kB |
| Wolne 4G: pierwszy obraz (FCP) | 2404 | 2108 (−12 %) |
| Wolne 4G: pierwszy ekran z profilem | 4922 | 4664 (−5 %) |
| Wolne 4G: pełna treść Dziś = interaktywny | 6995 | 6173 (−12 %; wszystkie 7 prób „po” szybsze od wszystkich 7 „przed”) |
| Wolne 4G: żądanie chunku Dziś | 4943 | 4404 (w trakcie ładowania profilu) |
| Szybka sieć: FCP / pierwszy ekran / treść | 484 / 727 / 2063 | 496 / 763 / 2175 (w granicach szumu) |
| Szybka sieć: suma blokowania (TBT), najdłuższe zadanie | 202 / 127 | 160 / 105 |
| Nasłuchy Firestore na Dziś (z Kalendarzem) | 12 dodanych, 1 zdjęty (jednorazowe `getDocs`) | bez zmian |

Na szybkiej sieci czas do pełnej treści wyznacza odpowiedź emulatora na zapytania o puste kolekcje, nie aplikacja.

**Przełączanie ekranów, menu, arkusze, listy, pisanie**

| Miara | Przed | Po |
|---|---|---|
| Obieg 9 ekranów ×2: zapytania zarejestrowane / zdjęte | 52 / 41 | 21 / 3 |
| Druga wizyta (Zadania, Kalendarz, Pieniądze, Notatki, Obowiązki): długie zadania razem | 14–18 | 5–7 |
| Druga wizyta w Pieniądzach / Notatkach: najdłuższe zadanie | 108–118 / 152–185 | 0–108 / 0–86 |
| Przejście do ekranu (do zniknięcia szkieletu), mediana | 81–110 | 66–107 |
| Otwarcie menu ×3, profil CPU: odczyty układu wierszy (`placeOf`) | 128 ms | 0 |
| Otwarcie menu: najdłuższa klatka | 83–100 | 67 |
| Otwarcie arkusza „+”: p95 klatek | 16,8 | 16,7–16,8 (koszt to natywne `showModal`) |
| Wejście w Pieniądze (150 transakcji), profil CPU: tworzenie formaterów | 96 ms | ~0 |
| Wejście w Notatki (150 notatek), profil CPU: tworzenie formaterów | 71 ms | ~0 |
| Wejście w Notatki: najdłuższa klatka / przeliczanie stylów | ~300 / ~200 ms | ~180 / ~140 ms |
| Lista Zadań (150): najdłuższe zadanie przy renderze | 141–269 | 62–109 |
| Przewijanie list (Zadania, Pieniądze, Notatki, tydzień kalendarza): p95 klatek | 16,8 | 16,7–16,8 (0 klatek > 33 ms) |
| Pisanie 44 znaków (pole Ex-us na Dziś, notatka w arkuszu transakcji): najdłuższe zdarzenie | 24–32 | 24–32 (bez długich zadań) |
| Bezczynne Dziś przez 10 s: zmiany DOM / długie zadania | 0 / 0 | 0 / 0 |

**Bajty ekranów** (JS doładowywany przy pierwszej wizycie poza startem i Firebase, surowe / gzip; bez zmian):
Dziś 67 / 28 kB, Zadania 19 / 8, Kalendarz 41 / 16, Pieniądze 39 / 15, Notatki 24 / 10, Obowiązki 34 / 14,
Cele 20 / 8, Statystyki 24 / 11, Ustawienia 60 / 24, Ex-us 138 / 52, Zgłoszenia 60 / 24, Gry 21 / 9,
Czytnik 72 / 25 (+28 kB CSS). Firebase 395 / 117 kB. Precache Service Workera 1806 → 1776 KiB.

## Co zmieniono

| Zmiana | Dlaczego (pomiar przed) |
|---|---|
| Angielski słownik we własnym chunku (`i18n/index.ts` `loadLanguage`); pierwszy render czeka na język | Oba słowniki (~170 kB JSON) w chunku wejścia; polski użytkownik pobierał i parsował angielski |
| Ekran startowy i repozytoria Dziś (`FeatureDef.preload`) ściągane, gdy Auth zna osobę — w trakcie ładowania profilu | Chunk Dziś był żądany dopiero po profilu, repozytoria po zamontowaniu ekranu (dwa kolejne RTT) |
| Ekrany paska dolnego i rejestracja Service Workera w bezczynności 2,5 s po pierwszym ekranie (`app/idle.ts`) | Precache (~1,8 MB) startował razem z aplikacją i przy pierwszej wizycie dzielił łącze z jej żądaniami |
| Formatery `Intl` budowane raz na język i opcje (`lib/intl.ts`) | `formatMoney`/`formatDayKey`/`formatShortDate` tworzyły formater przy każdym wywołaniu: 40–60 ms CPU (4×) na liście 150 pozycji |
| `useListMotion(rowKeys(children))`: bez odczytu układu wierszy, gdy klucze się nie zmieniły | Każdy render listy czytał `offsetTop` wszystkich wierszy = wymuszony layout w trakcie renderu; otwarcie menu 3× = 128 ms w `placeOf` |
| Wjazd po kolei (`.ui-stagger`) tylko dla pierwszych 20 dzieci | 150 animacji (i warstw) startowało w jednej klatce; najdłuższa klatka wejścia w Notatki ~300 ms |
| `stores/shared.ts`: jeden nasłuch na konto dla ekranów i Ex-us, 30 s zapasu, stop po wylogowaniu, restart po błędzie | Każda wizyta w Pieniądzach/Notatkach/Obowiązkach/Dziś/Statystykach rejestrowała zapytania od nowa: ~300 ms CPU (4×) w IndexedDB Firestore na 150 dokumentów i szkielet w tym czasie |
| Manrope cyrylica/greka/wietnamski poza precache | Pobierane tylko dla tych pism (`unicode-range`); polski i angielski ich nie używają |

## Budżety i testy

- `v2/tools/bundle-budget.ts` — wtyczka Vite: `npm run build` pada, gdy JS startu (chunk wejścia + jego statyczne
  importy) > **240 KiB** albo CSS startu > **56 KiB**, albo gdy Firebase, `en.json`, marked/DOMPurify lub
  pdf.js/JSZip trafią do startu. Teraz: JS 220 KiB, CSS 49 KiB (stan sprzed q-perf by go przekroczył). Podnoszenie budżetu = świadoma decyzja z wpisem tutaj.
- `v2/tools/bundle-budget.test.ts`, `v2/src/stores/shared.test.ts` — testy jednostkowe.
- `tests/v2/perf.spec.js` (e2e, Pixel 7): nasłuchy Firestore na Dziś (9 — od q-ui-2 z zadaniami; 11 z Kalendarzem), druga wizyta na
  ekranach bez nowych zapytań i po 30 s tylko nasłuchy Dziś; polski start bez chunku `en`, angielski od pierwszego
  renderu; otwarcie menu bez odczytów układu wierszy listy; bezczynne Dziś bez zmian DOM przez 5 s. Liczy rzeczy
  niezależne od szybkości maszyny — testu z progami czasu w CI nie ma (byłby niestabilny).

## Co zostaje (świadomie nie ruszone)

- Firebase (Auth + Firestore) to 395 kB surowo / 117 kB gzip — największy plik startu; przypięty do 10.12.x i
  już ładowany leniwie. Na wolnym 4G to on wyznacza czas do pierwszego ekranu.
- i18next (~43 kB) i polski słownik (~68 kB) w wejściu: wymiana biblioteki albo dzielenie słownika na moduły to
  osobna, większa zmiana.
- Otwarcie arkusza: koszt to głównie natywne `showModal()`/`close()` (styl całego dokumentu, `inert`), ~25 ms przy 4×.
- Ex-us (138 kB surowo, ładowany przy pierwszym użyciu) i czytnik (opt-in) bez zmian; przewijanie list ze 150
  pozycjami jest płynne (p95 16,8 ms, 0 klatek > 33 ms) — wirtualizacja niepotrzebna.
- Pomiar wpływu precache na pierwszą wizytę: emulacja sieci w Playwright nie dławi żądań Service Workera, więc
  korzyść z późniejszej rejestracji jest z rozumowania, nie z liczby. Do sprawdzenia na telefonie.
