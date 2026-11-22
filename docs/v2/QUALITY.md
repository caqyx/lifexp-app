# LifeXP v2 — przegląd jakości UI/UX i dostępności

Prośba właściciela (2026-11-21): „Ulepsz ogólną jakość aplikacji”. Zakres: wszystkie moduły v2 poza grami
(Dziś, Zadania, Kalendarz, Cele, Obowiązki, Pieniądze, Notatki, Czytnik — biblioteka, Statystyki, Zgłoszenia,
Ustawienia, Ex-us, Rodzic, powłoka i nawigacja, arkusze, logowanie). Ekrany wolno przebudować, nie tylko
poprawiać. Wydajność i błędy w domenie/serwisach prowadzą równolegle inne zadania; ten dokument dotyczy tego,
co widać: wyglądu, układu, tekstów i dostępności.

## Metoda

- v2 zbudowane (`v2/dist`) na emulatorach Auth + Firestore, konto testowe z danymi wymyślonymi na potrzeby
  przeglądu (zadania z terminami, obowiązki, transakcje, pożyczka, notatki, wydarzenia, cele, dziecko dla
  widoku Rodzica) i konto puste.
- Zrzuty: Pixel 7 (412 px) i desktop 1280 px, motywy LifeXP ciemny/jasny, iOS jasny/ciemny, Gold, każdy
  route i otwarte Menu oraz arkusz „+”.
- Automatycznie na każdym route i w każdym motywie: axe-core (pełny zestaw w LifeXP ciemnym, kontrast we
  wszystkich motywach), wielkość celów dotyku (≥ 44 px), poziomy scroll, nagłówki.
- Ręcznie: hierarchia, rytm odstępów, skala typografii, spójność komponentów, stany puste/ładowania/błędu,
  długie teksty, kolejność fokusu, liczba stuknięć do częstych celów.

Ogólnie: fundament jest dobry — tokeny, jedna skala odstępów (4 px), komponenty `ui`, ruch z tokenów,
`prefers-reduced-motion`, poziomego scrolla nie ma nigdzie, landmarki (`header`/`main`/`nav`) i jeden `h1`
(tytuł w górnym pasku) są na każdym ekranie. Problemy są w hierarchii kilku ekranów, w motywie Gold
(kontrast) i w drobnych, powtarzających się wzorcach.

## Ustalenia (od najważniejszych)

Oznaczenia: **P1** — błąd dostępności (WCAG AA) albo mylący układ; **P2** — wyraźnie słabsza hierarchia
lub niespójność; **P3** — szlif. Kolumna „Etap” mówi, w którym commicie q-ui-* poprawka wchodzi.

### Motywy i kontrast

| # | Pr. | Ustalenie | Etap |
|---|---|---|---|
| K1 | P1 | Gold: tekst drugorzędny `#7a7872` ma 4,3:1 na karcie i 3,9:1 na polach i przełącznikach widoków (ViewSwitch, SegmentedControl, sufiks pola) — poniżej AA na prawie każdym ekranie (axe: 30+ węzłów na route) | q-ui-1 |
| K2 | P1 | LifeXP jasny: akcent jako tekst `#1668e3` na miękkim tle akcentu (`accent-soft`: „Beta”, punkty w kalendarzu obowiązków, „Dziś” w tygodniu) 4,4:1 | q-ui-1 |
| K3 | P2 | LifeXP jasny: czerwień `#d92d20` 4,3:1 na podniesionej powierzchni (pola, hover) | q-ui-1 |
| K4 | P1 | Kalendarz, miesiąc: numery dni spoza miesiąca w `text-tertiary` — 1,7–2,9:1 we wszystkich motywach, a to klikalne przyciski | q-ui-3 |
| K5 | P1 | Kalendarz, dzień: opis bloku wydarzenia (`cal-block__meta`) 3,5–4,4:1 na zabarwionym tle kategorii | q-ui-3 |
| K6 | P2 | Gold, Statystyki: opis zdobytej odznaki (tekst drugorzędny na złotym zabarwieniu) 4,0:1 — widoczne dopiero po K1 | q-ui-6 |

### Powłoka, nawigacja, arkusze

| # | Pr. | Ustalenie | Etap |
|---|---|---|---|
| N1 | P1 | Otwarty drawer: `role="dialog"` na elemencie `<nav>` (niedozwolona rola) — czytnik ekranu traci landmark nawigacji | q-ui-1 |
| N2 | P1 | Linki w nagłówkach sekcji („Kalendarz”, „Wszystkie”, „Edytuj listę”, „Historia”) mają 21 px wysokości — cel dotyku poniżej 44 px | q-ui-1 |
| N3 | P2 | Arkusz „+”: wstęp „Dodawanie przechodzi do nowej wersji…” jest nieaktualny (wszystko już dodaje się w v2), a główny, wypełniony przycisk arkusza prowadzi do v1 — konkuruje z właściwym wyborem | q-ui-1 |
| N4 | P3 | Sidebar 264 px: „Zgłoszenia i aktualizacje” ucięte wielokropkiem | q-ui-6 |
| N5 | P3 | Dwa identyczne prymitywy strony (`.page` w powłoce i `.ui-page` w `ui`) | q-ui-7 |

### Wspólne komponenty i wzorce

| # | Pr. | Ustalenie | Etap |
|---|---|---|---|
| C1 | P2 | „Usuń” w wierszach i kartach (zadania, cele, transakcje, pożyczki, obowiązki, kategorie, rodzaje aktywności, historia, ogłoszenia) wygląda jak „Edytuj” obok — ten sam niebieski tekst. Akcja nieodwracalna nie odróżnia się od bezpiecznej | q-ui-1 |
| C2 | P2 | `EmptyState`: tytuł 20 px w karcie z dużym wcięciem — jednozdaniowe „brak” wygląda jak nagłówek, a całe zdania lądują w tytule (Zadania). Za dużo pustego miejsca w pustych kartach | q-ui-1 (komponent), q-ui-3 (teksty) |
| C3 | P2 | Wykres z samymi zerami (Statystyki, Rodzic) to pusta ramka — wygląda jak niezaładowany | q-ui-1 |
| C4 | P3 | Widoczna etykieta nad przełącznikiem, który sam się tłumaczy („Widok notatek”, „Miesiąc”, „Zgłoszenia według stanu”) — dodatkowa linia bez treści | q-ui-1 |
| C5 | P3 | Rozmiary spoza skali: 20/26/10 px w CSS modułów, promienie 12/16 px wpisane na sztywno; opóźnienie słupków wykresu 30 ms zamiast `--stagger-step` (przy ograniczonym ruchu się nie zerowało) | q-ui-1 |
| C6 | P2 | Nagłówki: `h3` bez `h2` w kartach celów i w Historii aktualizacji (axe `heading-order`) | q-ui-3, q-ui-6 |

### Ekrany

| # | Pr. | Ustalenie | Etap |
|---|---|---|---|
| D1 | P1 | **Dziś**: zadania na dziś i zaległe są na ekranie tylko z włączonym (domyślnie wyłączonym) Kalendarzem. Bez niego odhaczenie zadania to Menu → Zadania → odhacz (3 stuknięcia), a PLAN 7.6 stawia zadania na początku Dziś | q-ui-2 |
| D2 | P2 | **Dziś**: 11 bloków o równej wadze. Grywalizacja rozbita na trzy karty (punkty, poziom, seria + punkty dziś); karta Ex-us wysoka (pole, podpowiedź i osobny przycisk pod spodem); „Na skróty” powtarza dolny pasek, kartę Saldo i pole Ex-us (Pieniądze i Ex-us dwa razy) | q-ui-2 |
| D3 | P2 | **Dziś na desktopie**: jedna kolumna kart rozciągniętych do 1100 px — PLAN 7.3 przewiduje 2–3 kolumny od 840 px | q-ui-2 |
| D4 | P2 | **Pieniądze**: transakcja bez kategorii ma tytuł „—”, a opis ląduje w drugiej linii; pole „Okres” jako pełny formularz między nagłówkiem a listą | q-ui-4 |
| D5 | P2 | **Obowiązki**: dwa przełączniki jeden pod drugim (widok, miesiąc); kurs punktów („1 pkt = … zł”) osierocony pod przyciskiem | q-ui-4 |
| D6 | P2 | **Cele**: trzy akcje w rzędzie o podobnej wadze; brak wyraźnego „ile brakuje” jako bohatera karty | q-ui-3 |
| D7 | P2 | **Statystyki**: trzy liczby w jednym rzędzie na telefonie — etykiety i czas grania („… h … min”) łamią się na dwie linie | q-ui-6 |
| D8 | P3 | **Kalendarz**: tytuł dnia („Dziś, dzień tygodnia, data”) ucięty wielokropkiem na telefonie; w tygodniu każdy pusty dzień zajmuje wiersz „Wolne.” | q-ui-3 |
| D9 | P3 | **Zadania / Cele / Notatki**: licznik („N z 30 zadań”) jako pierwsza rzecz na ekranie, przed treścią | q-ui-3, q-ui-5 |
| D10 | P3 | **Logowanie**: brak „Nie pamiętam hasła” (odzyskiwanie jest w v1) | q-ui-6 |

### Liczba stuknięć do częstych celów (telefon)

| Cel | Teraz | Uwagi |
|---|---|---|
| Zapisać aktywność | 1 (Dziś → „Zapisz aktywność”) + formularz | dobrze |
| Odhaczyć obowiązek | 1 (karta na Dziś) | dobrze |
| Dodać wydatek | 2 („+” → Wydatek albo Pieniądze → Dodaj) | dobrze |
| Odhaczyć zadanie na dziś | 3 bez Kalendarza (Menu → Zadania → odhacz), 1 z Kalendarzem | D1 |
| Zapytać Ex-us | 1 (pole na Dziś) | dobrze |
| Sprawdzić saldo | 0 (karta na Dziś) | dobrze |

## Plan poprawek

| Etap | Zakres |
|---|---|
| q-ui-1 | Tokeny (K1–K3, skala 2xs, promienie), komponenty: `Button` `quiet-danger` (C1), `EmptyState` (C2), `BarChart` `emptyText` (C3), `SegmentedControl` `hideLabel` (C4), akcje nagłówka sekcji 44 px (N2); powłoka: drawer jako dialog wokół `nav` (N1), arkusz „+” (N3) |
| q-ui-2 | Dziś przebudowane: zadania na dziś zawsze, grywalizacja w jednej karcie, lżejsze pole Ex-us, bez powtórzeń, 2 kolumny na desktopie |
| q-ui-3 | Zadania, Cele, Kalendarz: hierarchia kart, kontrast kalendarza, nagłówki, puste stany |
| q-ui-4 | Pieniądze, Obowiązki: lista transakcji, przełączniki, kurs |
| q-ui-5 | Notatki, biblioteka Czytnika |
| q-ui-6 | Statystyki, Zgłoszenia, Ustawienia, Rodzic, logowanie |
| q-ui-7 | Przegląd dostępności całości + testy e2e (axe-podobne asercje kontrastu i celów dotyku, widoczny fokus) |

Stan każdego etapu: `PLAN.md` 9.1, sekcja „Jakość UI (2026-11-21)”.
