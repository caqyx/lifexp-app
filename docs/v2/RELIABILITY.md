# LifeXP v2 — przegląd niezawodności (q-rel, 2026-11-21)

Zakres: cała v2 poza grami — `domain/`, `services/`, `data/` (konwertery i repozytoria), `stores/`, `offline/`
i logika ekranów (Dziś, Zadania, Kalendarz, Cele, Obowiązki, Pieniądze i pożyczki, Notatki, Czytnik, Statystyki,
Zgłoszenia, Ustawienia, komendy Ex-us, Rodzic, logowanie, szkice offline, powiadomienia). Zasada: błąd jest
zgłoszony tylko wtedy, gdy da się go pokazać testem, który przed poprawką nie przechodzi. Bez wartości danych.

## Naprawione błędy

| # | Moduł | Objaw | Przyczyna | Poprawka | Test |
|---|---|---|---|---|---|
| R1 | Pieniądze | Konto z saldem poniżej zera (v1 na to pozwala: usunięcie wydanego wpływu) nie mogło w v2 dodać wpływu, pożyczki „od kogoś”, przyjąć zwrotu pożyczki ani usunąć wydatku — zawsze „Za mało środków”. Saldo nie miało jak wrócić nad zero | `fitsBalance()` sprawdzało `saldo + zmiana ≥ 0` także dla zmian dodatnich | Sprawdzane są tylko zmiany, które zabierają pieniądze (jak v1, G5.5) | `domain/money.test.ts`, e2e `tests/v2/money.spec.js` („a balance v1 left below zero…”) |
| R2 | Zadania, Ex-us | `/zadanie`, `/edytuj-zadanie` (i propozycje AI, które idą tymi samymi handlerami) zapisywały zadanie dłuższe niż 500 znaków v1; limit trzymało tylko `maxlength` pola | `taskProblem()` nie sprawdzało długości | Nowy problem `textTooLong` w domenie (po `trim`, w jednostkach UTF-16 jak `maxlength`), komunikat z limitem i tym, co zrobić | `domain/tasks.test.ts` (500/501, emoji), e2e `tests/v2/exus.spec.js` |
| R3 | Seria | Zamrożenie serii przepadało na 7 dni na luce, za którą nie ma aktywnego dnia (np. pierwszy dzień po przerwie, pierwszy dzień nowego konta): seria bez zmian, a gdy zamrożenie byłoby potrzebne, już go nie było. Do tego ekran liczący z nieaktualnego cache (dzień zapisany na innym urządzeniu) mógł zużyć zamrożenie na luce, której na serwerze nie ma | Odwzorowane zachowanie v1 (`calculateStreakDays`); transakcja sprawdzała tylko dostępność zamrożenia | Luka jest przykrywana tylko, gdy dzień przed nią był aktywny; seria podaje przykrytą lukę, a transakcja zapisu czyta z serwera `dailyLog` tej luki i dnia przed nią. Świadoma zmiana w `GOLDEN.md` (G3.8, G3.9), osobny commit | `domain/streak.test.ts`, e2e `tests/v2/progress.spec.js` (G3.8) |
| R4 | Szkice offline | Kolejka szkiców należy do urządzenia (klucz v1 w `localStorage`), więc szkic zrobiony offline przez jedno konto był pokazywany, liczony na Dziś i zatwierdzany na koncie, które zalogowało się później na tym samym urządzeniu | Szkic nie mówił, czyj jest | v2 dopisuje `uid` do szkicu (addytywnie; v1 pole ignoruje) i pokazuje oraz zatwierdza tylko szkice zalogowanego konta i szkice v1 (bez właściciela, jak dotąd) | `domain/drafts.test.ts`, e2e `tests/v2/drafts.spec.js` |
| R5 | Zadania | Ekran zostawiony na noc (telefon wybudzony rano): odhaczenie zadania z terminem „wczoraj” liczyło się jako w terminie i dawało kawałki budowy PC | Dzień brany z ostatniego renderu ekranu | `completeTask()` dostaje chwilę stuknięcia i sam liczy dzień lokalny (Zadania, Kalendarz, „Ważne dzisiaj”, Ex-us) | e2e `tests/v2/tasks.spec.js` (zegar `page.clock`, Europe/Warsaw, 23:58 → 00:03) |
| R6 | Obowiązki (Dziś) | Jak R5: obowiązek odhaczony na karcie Dziś po północy trafiał na wczoraj, a 1. dnia miesiąca do poprzedniego miesiąca (`monthKey`) | Dzień z ostatniego renderu | Dzień liczony w chwili stuknięcia | e2e `tests/v2/chores.spec.js` (30.11 23:58 → 1.12) |

Dodatkowe testy ścieżek krytycznych (bez znalezionych różnic): przesunięcie salda w groszach daje to samo co
`round2(saldo + zmiana)` v1 dla sald od −50 do 2000 zł (`lib/money.test.ts`), kwota wypłaty obowiązków to
`round2(punkty × kurs)` v1 dla 1–10 000 pkt przy kilku kursach (`domain/chores.test.ts`). Kopie domeny w
`functions/src/v2` przegenerowane (`gen:shared-domain`).

Niestabilne testy e2e (bez zmian w aplikacji): `calendar.spec.js` „tasks show on their due day…” w niedzielę
szukał jutrzejszego zadania w bieżącym tygodniu (jutro to już następny tydzień) — teraz bierze inny dzień tego
samego tygodnia; `exus.spec.js` „a goal is found…” sprawdzał ostatnią odpowiedź, która przed nową odpowiedzią miała
już ten sam tekst — teraz czeka na odpowiedź tej komendy.

## Sprawdzone bez błędów

Konwertery (profil, cele, transakcje, pożyczki, obowiązki, zadania, kalendarz) dają wartości domyślne dla braków
i starych kształtów z `PLAN.md` 5.3; zaokrąglenia Money i kosztu w punktach jak v1; każda zmiana salda, punktów,
budowy PC i wypłata obowiązków w jednej transakcji czytającej stan z serwera; odrzucone `saved` zgłaszane toastem
na ekranach i w Ex-us; „Cofnij” przywraca te same dokumenty pod tymi samymi id; store'y czyszczą dane przy starcie
nasłuchu nowego konta, historia Ex-us kasowana przy wylogowaniu; dni UTC i lokalne zgodnie z G13; komunikaty błędów
logowania bez szczegółów technicznych.

## Uwagi bez poprawki (do decyzji)

- Biblioteka Czytnika (IndexedDB `lifexp-v2-reader`) jest wspólna dla wszystkich kont na urządzeniu — inne konto
  widzi te same książki i miejsca czytania. Jeśli to niepożądane, klucz per `uid` (zmiana tylko lokalna).
- Limity list (30 zadań, 30 notatek, 500 wydarzeń, 30 kategorii) sprawdzane są na liście z nasłuchu, nie w
  transakcji: dwie karty jednocześnie mogą je przekroczyć o jeden wpis (v1 tak samo).
- Ten sam szkic zatwierdzony w tej samej chwili w dwóch kartach może dodać wpis dwa razy (v1 tak samo); szkic znika
  z kolejki dopiero po zapisie.
- Przywrócenie („Cofnij”) rodzaju aktywności bez pola `order` zapisałoby wartość zastępczą; w produkcji wszystkie
  definicje mają `order` (INVENTORY), więc nieosiągalne.
- Raz przy równoległym obciążeniu emulatora test „Today draws repeating chores… Cofnij” nie doczekał skasowania
  wpisu; trzy powtórki osobno zielone.

## Do sprawdzenia przez właściciela

Na prawdziwym telefonie: Dziś i Zadania zostawione otwarte przez noc i odhaczone rano (R5, R6); dwa konta na
jednym telefonie i szkic zrobiony offline (R4). v1 do cutover dalej zużywa zamrożenie po swojemu (R3).
