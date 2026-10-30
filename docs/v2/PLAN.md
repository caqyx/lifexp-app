# LifeXP v2 — audyt i plan architektury

Status: **etap 0 zrobiony (9.1); etapy 1+ czekają na akceptację**. Audyt robiony na `main` @ `3250146` (2026-09-01).
Rewizja 2: kod Cloud Functions nieodnaleziony → backend Ex-us odtwarzany od nowa (6.12).
Rewizja 3: decyzje z benchmarku podobnych aplikacji (`RESEARCH.md`, oznaczenia U1-U15) naniesione na sekcje 6 i 7.
Rewizja 4 (2026-09-27): wyniki inwentaryzacji produkcji (`INVENTORY.md`) naniesione na 1.5, 1.11 i 5.2-5.4.
Baseline testów (Playwright, lokalnie w sandboxie): **43/50 zielonych**. 7 failujących to wyłącznie FPS
(timeouty WebGL w headless Chromium). Testy logiki LifeXP (punkty, Money, obowiązki) nie istnieją.

Spis treści

0. [TL;DR](#0-tldr)
1. [Audyt obecnej aplikacji](#1-audyt-obecnej-aplikacji)
2. [Analiza architektury](#2-analiza-architektury)
3. [Plan migracji](#3-plan-migracji)
4. [Architektura LifeXP v2](#4-architektura-lifexp-v2)
5. [Model danych](#5-model-danych)
6. [Architektura Ex-us](#6-architektura-ex-us)
7. [Architektura UI](#7-architektura-ui)
8. [Strategia testowania](#8-strategia-testowania)
9. [Kolejność implementacji](#9-kolejność-implementacji)
10. [Ryzyka](#10-ryzyka)
11. [Rekomendacja i uzasadnienie](#11-rekomendacja-i-uzasadnienie)
12. [Otwarte decyzje](#12-otwarte-decyzje)

---

## 0. TL;DR

1. **Backend zostaje**: ten sam projekt Firebase (`faiobaj4`), Auth, Firestore, reguły, te same kolekcje i pola.
   Zmiany schematu tylko **addytywne** (nowe pola/kolekcje), żadnych rename/delete, dopóki v1 żyje.
2. **Frontend od zera**: Vite + TypeScript (strict) + Preact + signals, hash router, feature-folders.
   Warstwy: `domain` (czysta logika) → `services` (use-case'y w transakcjach) → `data` (repozytoria + konwertery) → `features` (UI).
3. **Strangler, nie big-bang**: v2 buduje się obok v1 pod `/v2/` na tym samym originie i na tych samych danych.
   Przełączenie (cutover) dopiero, gdy każdy moduł przejdzie testy parytetu. v1 zostaje jako fallback pod `/v1/`.
4. **Ex-us**: lokalny silnik komend (parser + registry + handlery) wykonuje wszystko lokalnie.
   AI dostaje **jedno** wywołanie na wiadomość (dziś są trzy: classify → chat → ping) i zwraca
   ustrukturyzowane `actions[]` w tym samym formacie, co sparsowana komenda `/...`. Obie ścieżki zbiegają się
   w jednym pipeline → zero duplikacji logiki. Siri-ous usunięty.
5. **UI bez ikon**: typografia, karty, spacing, design tokens. Desktop: stały sidebar. Telefon: wysuwany
   drawer z lewej (zachowanie jak ChatGPT: top bar + przycisk Menu, edge-swipe, scrim, back zamyka).
6. **Najważniejsze znalezione problemy** (szczegóły w 2.3): zapisy wielodokumentowe bez transakcji (dryf salda
   i punktów), mieszanie dat UTC i lokalnych, Service Worker cache-first dla modułów JS (stare JS po deployu,
   martwy start offline), zadania z Ex-us zapisywane do `plannerTasks`, którego nic nie wyświetla,
   **push i raport tygodniowy nie działają od 25.07** (nieważny klucz konta serwisowego), a od 19.08 nie ma też
   workflowów GitHub Actions ani CI,
   **brak kodu Cloud Functions w repo** (decyzja: odtwarzamy tylko nowy backend v2, stare funkcje działają dalej dla v1 — 6.12).

---

## 1. Audyt obecnej aplikacji

### 1.1 Struktura repozytorium

| Plik | Linie | Rola |
|---|---:|---|
| `app.html` | 2649 | Cała SPA: ~1350 linii inline CSS + markup wszystkich stron i modali |
| `core.js` | 697 | Bootstrap Firebase, auth gate, `MODULE_REGISTRY`, nawigacja `showPage`, i18n, helpery, mutowalne singletony `currentUser`/`userProfile` |
| `dashboard.js` | 517 | Dashboard, cele (goals), poziom, streak + freeze, osiągnięcia, lista ostatnich aktywności, `revertActivityPoints` |
| `activities.js` | 492 | Log aktywności, log grania, sklep (martwy), generator „Co teraz?” |
| `history-stats.js` | 277 | Wykres tygodnia, TOP aktywności, ciekawostki, historia z paginacją, statystyki, reset dnia |
| `chores.js` | 323 | Obowiązki: definicje (seed), wpisy, kalendarz, „dziś/wczoraj”, rozliczenie → Money |
| `money.js` | 655 | Money: saldo, transakcje, kategorie, pożyczki, limit miesięczny, licznik wpływów |
| `notes.js` | 723 | Notatnik: notatki (Markdown, archiwum) + zadania (todos) + mechanika „budowy PC” |
| `assistants.js` | 762 | Siri-ous (żart, localStorage) + Ex-us (Gemini przez Cloud Functions) |
| `settings.js` | 760 | Tryb konta, onboarding modułów, akordeon, profil, ekonomia, definicje, motywy, fonty, email rodzica, push, godziny powiadomień |
| `bug-reports.js` | 446 | Zgłoszenia błędów (1/dzień, bonus, filtr spamu), panel admina, wątki |
| `updates.js` | 387 | „Co nowego?”, historia aktualizacji (CHANGELOG), broadcasty (baner na żywo) |
| `offline.js` | 207 | Kolejka szkiców offline w localStorage + przegląd i zatwierdzanie |
| `i18n-resources.js` | 814 | Słownik EN/PL (i18next) |
| `games.js` | 2621 | Mini-gry offline (Coins, Snake, 2048, Redstone), IIFE, zero Firestore |
| `fps.html` | 3147 | Samodzielny prototyp FPS (Three.js z unpkg), link powrotny do `app.html` |
| `index.html` | 265 | Logowanie/rejestracja (email+hasło, Google) |
| `verify.html` | 200 | Weryfikacja emaila kodem (EmailJS, kod w pamięci przeglądarki) |
| `parent.html` | 376 | Panel rodzica (read-only), własna kopia logiki formatowania |
| `sw.js` | 110 | Service Worker: FCM background + app-shell cache |
| `style.css` | 506 | Zmienne motywów (LifeXP/Apple/Gold), przyciski, modale, toast, animacje |
| `firestore.rules` | 125 | Reguły: owner full, rodzic read-only (bez prywatnych danych Money), admin bugów po emailu |
| `scripts/*.js` | 236 | Push co godzinę + raport tygodniowy (Admin SDK, uruchamiane przez GitHub Actions) |
| `tests/` | ~2800 | Playwright: Redstone, FPS, offline SW, Ex-us (na **kopii** kodu w harnessie) |
| `firebase.json` | 16 | Konfiguracja `functions/` — **katalog nie istnieje** |

Hosting: GitHub Pages (`caqyx.github.io/lifexp-app/`), brak build stepu, Firebase SDK 10.12.0
ładowane jako moduły ES z `gstatic.com`, i18next/EmailJS/Tabler Icons/marked/DOMPurify z jsDelivr.

### 1.2 Boot i autoryzacja

Sekwencja w `core.js:350-427` (`onAuthStateChanged`):

1. Brak usera → `index.html`.
2. `loadProfile()` — czyta `users/{uid}`; jeśli brak dokumentu, tworzy go (self-heal po logowaniu Google).
3. `syncLangWithProfile()` — język z profilu wygrywa z localStorage.
4. Brama weryfikacji: `userProfile.emailVerified` (pole w Firestore, zapisywalne przez ownera) → `verify.html`.
5. Brama trybu konta (`accountMode` solo/supervised) → modal.
6. Brama onboardingu (`enabledModules` undefined) → modal wyboru modułów.
7. `renderModuleNav()`, `loadActivityDefs()` (seed przy pierwszym użyciu), `loadDashboard()`.
8. Po starcie: „Co nowego?”, nasłuch broadcastów, baner offline, przegląd szkiców offline.

Auth: Firebase Auth (email+hasło, Google popup). Weryfikacja emaila to **własny mechanizm** (EmailJS + kod
w pamięci `verify.html`), a nie `sendEmailVerification` Firebase. Flaga `emailVerified` w Firestore jest
zapisywalna przez użytkownika, więc brama jest kosmetyczna. Admin = twardo zakodowany email
(`bug-reports.js:21`, `firestore.rules:34`). Rodzic = konto, którego email równa się `parentEmail` dziecka.

### 1.3 Routing i nawigacja

- Brak routera i URL-i. `window.showPage(id)` (`core.js:528-570`) przełącza klasę `.active` na `div.page`
  i odpala `load*()` danego ekranu. Brak historii przeglądarki: przycisk wstecz na Androidzie zamyka apkę.
- Nawigacja budowana z `MODULE_REGISTRY` (`core.js:45-76`): sidebar (desktop) + dolny pasek (<700 px).
  Poniżej 700 px sidebar jest całkowicie ukryty (`app.html:702-707`), więc każda strona musi mieć wpis
  w dolnym pasku — dokładnie to spowodowało bug „moduł nie widoczny na telefonie” (`core.js:69-73`).
- Na telefonie dolny pasek ma do 8 pozycji po 10 px tekstu (Home, Obowiązki, Money, Gry, Historia,
  Notatnik, Asystenci, Ustawienia).
- Strony poza nawigacją: `log-activity`, `log-gaming`, `generator` (przyciski na dashboardzie),
  `report-bug`, `broadcasts`, `update-history` (hub), `shop` (**nieosiągalna** — martwy kod).

### 1.4 Moduły funkcjonalne

| Obszar | Gdzie | Co robi | Dane |
|---|---|---|---|
| Dashboard / XP | `dashboard.js`, `activities.js`, `history-stats.js` | Saldo punktów + PLN, poziom (500 XP/poziom), streak z „zamrożeniem” raz na 7 dni, dzienny limit punktów, wykres 7 dni, TOP 5, ciekawostki, 14 osiągnięć, log aktywności (pkt/h × czas, cap dzienny), log grania, generator | `users/{uid}.points`, `activities`, `dailyLog`, `gamingSessions`, `activityDefs` |
| Chores | `chores.js` | Definicje (seed 8 szt., jednorazowe znikają po użyciu), dodawanie z bottom-sheetu, pytanie „dziś/wczoraj”, kalendarz miesiąca, „do wypłaty”, rozliczenie → przychód w Money | `choreDefs`, `chores`, `chorePayouts`, `moneyTransactions`, `money/balance` |
| Money | `money.js` | Saldo PLN (nie może zejść < 0), transakcje income/expense (expense zdejmuje też punkty), kategorie (seed), pożyczki lent/borrowed ze spłatami, limit miesięczny, archiwum miesięcy | `money/settings`, `money/balance`, `moneyTransactions`, `moneyCategories`, `moneyLoans`, `users.moneyIncomeAllTime` |
| Goals | `dashboard.js:49-250` | Do 3 celów (punktowe albo pieniężne); pieniężne mają `saved` — wpłata zdejmuje saldo Money, usunięcie celu zwraca | `users/{uid}.goals[]` |
| Tasks / To Do | `notes.js:561-683` | Max 30 zadań, termin (wymagany, nie w przeszłości), rozmiar S/M/L = 1/2/3 „kawałki” budowy PC; zrobione w terminie dodaje kawałki, przeterminowane zabiera jeden | `todos`, `users.pcBuild` |
| Notes | `notes.js:370-559` | Max 30 aktywnych, Markdown (marked + DOMPurify), archiwum, ikona/kolor, long-press menu | `notes` |
| Bugs | `bug-reports.js` | 1 zgłoszenie/dzień + bonus za zaakceptowane, filtr spamu słowami kluczowymi, wątek wiadomości, panel admina (4 zakładki), auto-kasowanie spamu po 12 h (leniwie) | `bugReports`, `bugReportsConfig/keywords`, `users.lastBugReportAt` |
| Reports | `parent.html`, `scripts/send-weekly-report.js`, `settings.js` | Panel rodzica read-only; raport tygodniowy email (EmailJS REST); push reminders | `users` (query po `parentEmail`), `autoReport`, `notifHours`, `fcmTokens` |
| Updates / broadcasty | `updates.js` | Modal „Co nowego?” raz na wersję, pełny changelog, broadcasty admina jako baner (live `onSnapshot`) | `broadcasts` |
| Settings | `settings.js` | Moduły, motyw (3), font (4), język, tryb konta, profil, email rodzica z kodem, raport, powiadomienia + godziny, limit dzienny, ekonomia (dwa kursy pkt→zł), definicje obowiązków/aktywności, gry | `users/{uid}` + definicje |
| Assistants | `assistants.js` | Siri-ous (losowe żarty, localStorage) + Ex-us (Gemini) — patrz 1.9 | localStorage + backend |
| Games | `games.js`, `fps.html` | 4 gry canvas + FPS; rekordy w localStorage; zero Firestore | localStorage |
| Offline | `offline.js` | Wpisy offline (aktywność, granie, obowiązek, transakcja) jako szkice; zatwierdzane ręcznie po powrocie online ze świeżym stanem serwera (celowy design) | `localStorage['lifexp-offline-queue']` |

### 1.5 Model danych (stan faktyczny)

`users/{uid}` — dokument profilu (wszystko w jednym dokumencie):

| Pole | Typ | Uwagi |
|---|---|---|
| `name`, `email`, `createdAt` | string | `createdAt` jako ISO string |
| `points.{total, earnedAllTime, spentAllTime}` | number | Zdenormalizowane liczniki, aktualizowane z ~8 miejsc |
| `dailyLimit` | number | Domyślnie 150 |
| `pointsRateGeneralZl/Pts`, `pointsRateChoresZl/Pts` | number | Kursy pkt → zł (domyślnie 1 zł/10 pkt i 0,45 zł/1 pkt) |
| `goals[]` | `{id, name, type:'points'\|'money', amount, celebrated, saved}` | Max 3; legacy pola `goalName/goalType/goalAmount/...` migrowane leniwie |
| `achievements[]` | string[] | Id osiągnięć |
| `streakFreezeLastUsed` | `YYYY-MM-DD` | Data UTC |
| `moneyIncomeAllTime` | number | Backfill leniwy z transakcji |
| `pcBuild` | `{componentOrder[6], progress{}, currentComponentIndex}` | |
| `enabledModules[]`, `onboardingDone`, `accountMode`, `lang` | | |
| `parentEmail`, `parentEmailVerifiedAt`, `pendingParentEmail`, `parentEmailCode`, `parentEmailCodeExpiry` | | Kod weryfikacyjny leży w dokumencie czytelnym dla usera |
| `autoReport`, `lastReportSent`, `notifHours[]`, `games[]`, `lastBugReportAt`, `emailVerified` | | |
| `aiSettings` | `{lastResetDate, tokensUsedToday}` | Zapisywalne tylko przez Cloud Function |

Podkolekcje `users/{uid}/…`:

| Kolekcja | Kształt dokumentu | Klucz / uwagi |
|---|---|---|
| `activities` | `{type, typeName?, duration, points, desc, timestamp: Timestamp}` | `type` = id z `activityDefs` albo `__generated__` |
| `activityDefs/{id}` | `{name, points (pkt/h), color, icon ('ti-*'), order}` | Seed z id `learning`, `project`… |
| `dailyLog/{YYYY-MM-DD}` | `{pointsEarned, gamingMinutes}` | **Klucz liczony w UTC** |
| `gamingSessions` | `{game, duration, date, timestamp}` | |
| `purchases` | `{description, amount, pointsCost, timestamp}` | Legacy „sklep”; UI martwe, czytane przez `parent.html` i raport |
| `chores` | `{choreId, choreName, choreEmoji, points, dateISO, monthKey, createdAt}` | `dateISO` **lokalne**; kasowane przy rozliczeniu |
| `choreDefs/{id}` | `{name, desc, emoji, points, oneTime, order}` | |
| `chorePayouts` | `{points, amountPln, fromISO, toISO, createdAt}` | Trwała historia wypłat |
| `money/settings`, `money/balance` | `{monthlyLimit, currency}`, `{current}` | Saldo zdenormalizowane; w części kont legacy `pendingPoints` (usunięte „Wypłać punkty”) |
| `moneyTransactions` | `{type, amount, category (NAZWA), note, date, source, pointsCost, createdAt}` | `source`: `manual`\|`chore_payout` |
| `moneyCategories` | `{name, color, icon}` | Transakcje wskazują kategorię **po nazwie** |
| `moneyLoans` | `{person, amount, repaidAmount, direction, note, date, createdAt, completedAt}` | Ruszają saldo **bez** wpisu w transakcjach |
| `notes` | `{title, content, icon, color, createdAt (ISO), archived}` | |
| `todos` | `{text, size, dueDate, done, createdAt (ISO), penaltyApplied}` | |
| `fcmTokens/{token}` | `{token, createdAt, ua}` | |
| `plannerTasks` | `{title, time, durationMin, type, points, dateISO, done, activityId: null, createdAt}` | **Osierocone**: UI usunięte 24.08, ale `aiConfirmTask` nadal tu pisze |
| `aiConversations` | `{messages[{role, text}], updatedAt}` | Historia czatu Ex-us zapisywana przez backend (klient v1 jej nie czyta); rodzic ma do niej odczyt przez regułę `{col}/{docId}` |
| `moneyGoals` | legacy | Czytane tylko przez skrypt raportu |

Top-level: `bugReports`, `bugReportsConfig/keywords`, `broadcasts`, `aiTestAccess/{uid}`, `aiUsageGlobal/{date}` (`{totalTokens}`).
Do 2026-09-29 była też `aiTestAccces/{uid}` (literówka, 1 dokument). Jej uid był też w `aiTestAccess`, więc
właściciel ją usunął; nic jej nie czytało. Stan faktyczny policzony
na produkcji: `INVENTORY.md`.

### 1.6 Operacje CRUD

| Encja | Create | Read | Update | Delete | Efekty uboczne (zapisy w innych miejscach) |
|---|---|---|---|---|---|
| Aktywność | `logActivity`, szkic offline | ostatnie 5, 50 (TOP), **wszystkie** (historia) | — | `deleteActivity` | `dailyLog.pointsEarned`, `users.points.*` |
| Sesja grania | `logGaming`, szkic | ostatnie 30 | — | tak | `dailyLog.gamingMinutes` |
| Zakup (legacy) | martwe UI | parent, raport | martwe UI | martwe UI | `users.points.*` |
| Def. aktywności | Ustawienia, seed | wszystkie | — | tak (historia traci nazwę) | — |
| Wpis obowiązku | sheet, szkic | wszystkie nierozliczone | — | tak | jednorazowa def. kasowana |
| Def. obowiązku | Ustawienia, seed | wszystkie | — | tak | — |
| Rozliczenie | `settleChores` | wszystkie | — | — | payout + kasowanie N wpisów + transakcja + saldo + `moneyIncomeAllTime` |
| Transakcja | `saveMoneyTx`, szkic, rozliczenie | **wszystkie** | — | tak | saldo, `points.*`, `moneyIncomeAllTime`, osiągnięcia |
| Kategoria | Ustawienia, „nowa” w formularzu, seed | wszystkie | — | tak | — |
| Pożyczka | tak | wszystkie | spłata | tak | saldo |
| Cel | formularz, `aiConfirmGoal` (backend) | z profilu | edycja, wpłata | tak | saldo Money (wpłata/zwrot) |
| Zadanie (todo) | formularz | wszystkie | edycja, done | **brak w UI** | `users.pcBuild`, kara przy wejściu w zakładkę |
| Notatka | edytor | wszystkie | edycja, archiwum | tak | — |
| Zgłoszenie błędu | formularz | własne / wszystkie (admin) | wiadomości, status | admin | `users.lastBugReportAt`, bonus |
| Broadcast | admin | live 10 ostatnich | — | admin | — |
| Profil/ustawienia | self-heal, rejestracja | `loadProfile` po każdym zapisie | wiele | — | — |

### 1.7 Dane lokalne (localStorage)

| Klucz | Zawartość | Uwagi dla v2 |
|---|---|---|
| `lifexp-offline-queue` | Szkice offline | **Musi być czytany przez v2** (niezatwierdzone wpisy użytkownika) |
| `lifexp-theme`, `lifexp-font`, `lifexp-lang` | Preferencje | Migrować wartości przy pierwszym starcie v2 |
| `lifexp-exus-history`, `lifexp-exus-conversation-id` | Historia Ex-us | **Nie per-user** — inne konto na tym samym urządzeniu widzi cudzą historię |
| `lifexp-aichat-chats`, `lifexp-aichat-history`, `lifexp-aichat-active` | Siri-ous | Do usunięcia przy cutover |
| `lifexp-bug-read`, `lifexp-seen-broadcasts`, `lifexp-seen-version`, `lifexp-settings-collapsed` | Stan UI | Przenieść `seen-broadcasts` (żeby banery nie wróciły) |
| `lifexp-game-highscore-*`, `lifexp-redstone-world` | Gry | Zachować bez zmian (gry zostają) |

Dodatkowo: Firestore `persistentLocalCache` (IndexedDB, single-tab), cache Service Workera `lifexp-shell-v54`.

### 1.8 Zależności między modułami

```
core ──imports──▶ activities, assistants, bug-reports, chores, dashboard, history-stats,
                  money, notes, offline, settings, updates
każdy moduł ──imports──▶ core            (cykl: core ↔ wszystko)
dashboard ↔ money                         (cykl: cele ↔ saldo)
dashboard ↔ history-stats                 (cykl)
chores → money, offline → money + dashboard, assistants → dashboard, settings → chores
```

- Wspólny, mutowalny stan: `userProfile` jest modyfikowany z 8 plików (goals, pcBuild, achievements,
  `moneyIncomeAllTime`, `accountMode`, `notifHours`…). Nie ma jednego właściciela.
- ~133 funkcje na `window.*` wołane z `onclick="..."` w stringach HTML. `core.js` woła `loadMoney`,
  `updateGameSelect`, `loadGamingHistory` bez importu, jako globale.
- Odświeżanie widoków jest ręczne: po zapisie woła się `loadProfile()` + `loadDashboard()` + `load*()`.
  `refreshDynamicI18n()` (`core.js:194-220`) to ręczna lista „co przerysować po zmianie języka”.

### 1.9 Assistants: Siri-ous i Ex-us

- **Siri-ous** (`assistants.js:5-351`, CSS `app.html:913-1078`): ~100 losowych żartobliwych odpowiedzi,
  słowa-klucze, wiele czatów, wszystko w localStorage. Do usunięcia.
- **Ex-us** (`assistants.js:353-761`): Gemini przez Cloud Functions (`httpsCallable`):

```
wiadomość usera
  ├─▶ aiClassifyIntent({message})           — wywołanie 1 (zawsze)
  │     ├─ intent:"task" + proposal  → karta → aiConfirmTask(...)   → zapis do plannerTasks (niewidoczne!)
  │     ├─ intent:"goal" + proposal  → karta → aiConfirmGoal(...)   → zapis do users.goals (backend)
  │     └─ intent:"chat" [+ note]
  ├─▶ aiAssistantChat({message, conversationId})   — wywołanie 2 (dla "chat")
  └─▶ aiAssistantPing()                            — wywołanie 3 (zawsze, tylko pasek limitu tokenów)
```

  Czyli 2-3 wywołania backendu na wiadomość, z czego co najmniej dwa idą do Gemini. Zapis celów/zadań
  robi backend (Admin SDK), więc logika celów istnieje w **dwóch** miejscach (klient + funkcja).
  Historia czatu w localStorage bez klucza uid. Markdown przez marked + DOMPurify (poprawnie sanityzowany).

### 1.10 Responsywność i mobilny layout

- Jeden breakpoint 700 px: sidebar 220 px ↔ dolny pasek. Brak stanu pośredniego (tablet).
- `meta viewport ... maximum-scale=1, user-scalable=no` (`app.html:9`) — zablokowany zoom (dostępność),
  wprowadzony jako obejście auto-zoomu iOS na polach < 16 px.
- `100vh` zamiast `100dvh` w oknach czatu (`app.html:951`, `1134`) — na telefonie pasek adresu/klawiatura
  zasłania pole wpisywania.
- FAB-y `position:fixed` zasłaniają treść; łatane `padding-bottom: 96px` per strona (`app.html:462-467`, `519`).
- `overflow-x: hidden` na `html, body` maskuje przepełnienia zamiast im zapobiegać; historia commitów pokazuje
  serię poprawek „coś wystaje poza prawą krawędź” (Siri-ous, Redstone, strona zgłoszeń).
- `#toast { white-space: nowrap }` (`style.css:429`) — długi komunikat wychodzi poza ekran telefonu.
- Dużo stylów inline w HTML i w szablonach JS — brak jednego źródła wymiarów/odstępów.
- Google Fonts: 5 rodzin ładowanych blokująco przez `@import` (Inter, JetBrains Mono, Manrope, Plus Jakarta, Poppins).

### 1.11 Backend i infrastruktura poza kodem aplikacji

- **Cloud Functions nie ma w repo.** `firebase.json` wskazuje `functions/`, katalog nie istnieje; historia gita
  go nigdy nie zawierała. Wdrożone funkcje: `aiClassifyIntent`, `aiAssistantChat`, `aiAssistantPing`,
  `aiConfirmTask`, `aiConfirmGoal` (+ prawdopodobnie zarządzanie `aiTestAccess`/`aiSettings`).
- **Klucz konta serwisowego w sekrecie `FIREBASE_SERVICE_ACCOUNT` był nieważny od 2026-07-25**: od tego dnia
  każde uruchomienie `notify.yml` (push reminders) kończyło się błędem uwierzytelnienia (`16 UNAUTHENTICATED`),
  a `weekly-report.yml` używał tego samego sekretu. Klucz odnowiony 2026-09-27.
- **`.github/workflows` usunięte** w commicie `d841f58` (2026-08-19, seria „Delete … / Add files via upload”).
  Z wysokim prawdopodobieństwem przypadkowo (upload przez przeglądarkę pomija katalogi zaczynające się od
  kropki). Skutek: od 19.08 nie uruchamiają się ani push i raport (i tak już zepsute kluczem), ani CI (`test.yml`).
- Skrypt raportu jest i tak nieaktualny: czyta legacy `moneyGoals` i `purchases`, liczy PLN jako `/10`
  na sztywno (`scripts/send-weekly-report.js:54,132,146`).
- EmailJS: publiczny klucz w kliencie, szablony `template_f2b4jeo` (kod), `template_jztwowz` (raport).

### 1.12 Testy

- 50 testów Playwright: Redstone (gry), FPS (7 failuje lokalnie — timeouty WebGL), SW offline (3),
  Ex-us (5) — ale Ex-us jest testowany na **ręcznie skopiowanym** kodzie w `tests/fixtures/exus-harness.html`,
  bo prawdziwe moduły importują Firebase z `gstatic.com`. Harness już się rozjechał z produkcją
  (test nadal mówi o „planner refresh”).
- Zero testów domeny: punkty, limity, streak, Money, pożyczki, rozliczenia, cele, budowa PC.

---

## 2. Analiza architektury

### 2.1 Co jest dobre (i przechodzi do v2 jako idea)

- **Model danych per-user w podkolekcjach** + reguły owner/parent — prosty, bezpieczny, skalowalny dla tej apki.
- **Rejestr modułów** (`MODULE_REGISTRY`) jako jedno źródło dla nawigacji, onboardingu i ustawień —
  dobry pomysł, w v2 rozszerzony o routing, komendy Ex-us i kontekst AI.
- **Denormalizacja nazw** (`choreName`, `typeName`) — historia przeżywa usunięcie definicji.
- **Celowy design offline** (szkice zatwierdzane online ze świeżym stanem) — poprawny dla operacji
  z limitami (dzienny limit, saldo ≥ 0). v2 zachowuje semantykę.
- **Mechanika budowy PC** w `notes.js:33-99` — już napisana jako czyste funkcje (stan in → stan out).
  Wzorzec, który v2 rozciąga na całą domenę.
- **Sanityzacja Markdown** (marked → DOMPurify, fallback na escape) — poprawna.
- **i18n przez i18next** z kompletnym słownikiem EN/PL — treść do przeniesienia 1:1.
- **Brama boot + ekran ładowania bez FOUC**, **reduced-motion** respektowane.
- Gry: kompletne, przetestowane, izolowane od danych — zostają jako moduł ładowany leniwie.

### 2.2 Problemy strukturalne (dlaczego obecna architektura blokuje rozwój)

1. **Brak warstw.** Każda funkcja robi naraz: odczyt DOM → walidację → logikę domeny → zapisy Firestore →
   odświeżenie widoków → toast. Nie da się przetestować logiki bez przeglądarki i Firebase, więc testów domeny nie ma.
2. **Stan globalny i mutowalny** (`userProfile`, zmienne modułów) + ręczne przerysowywanie → klasa bugów
   „widok pokazuje stare dane” i konieczność pamiętania, co odświeżyć po każdej operacji.
3. **HTML w stringach + `innerHTML` + `onclick="fn('${id}')"`**: escapowanie ręczne (łatwo pominąć — np.
   `activities.js:253`), brak typów, kolizje nazw na `window`, niemożliwy tree-shaking.
4. **Operacje wielodokumentowe bez transakcji.** Jedna akcja użytkownika = 3-6 osobnych zapisów; błąd
   w połowie zostawia niespójność, której nic nie wykrywa ani nie naprawia.
5. **Logika zduplikowana** w 4 miejscach: `app` (klient), `parent.html` (własne kursy i lista aktywności),
   skrypt raportu (własne kursy i legacy kolekcje), Cloud Functions (cele). Każda kopia już się rozjechała.
6. **Importy z CDN po URL** uniemożliwiają testy jednostkowe prawdziwego kodu (dowód: harness z kopią Ex-us)
   i przypinanie wersji w lockfile.
7. **Layout łatany punktowo** (inline style, `position:fixed`, magiczne `padding-bottom`, `overflow-x:hidden`,
   blokada zoomu) zamiast systemu (tokeny, jeden shell, reguły przepełnień).
8. **Dla AI**: pliki po 500-2600 linii, niejawne zależności przez `window`, brak kontraktów. Model musi
   wczytać ogromny kontekst, żeby bezpiecznie zmienić jedną rzecz — i nadal nie ma kompilatora, który złapie
   literówkę w nazwie pola `'points.total'`.

### 2.3 Rejestr problemów technicznych i źródeł bugów

| # | Problem | Gdzie | Skutek | Jak v2 to rozwiązuje |
|---|---|---|---|---|
| B1 | SW: moduły JS nie są w precache, a strategia dla nich to cache-first | `sw.js:37`, `100-108` | Po deployu bez podbicia `CACHE` telefon trzyma stary JS z nowym HTML (niespójne wersje). Po podbiciu cache i starcie offline: HTML jest, `core.js` nie → wieczny ekran ładowania | Workbox precache z hashowanymi nazwami plików, atomowa aktualizacja wersji |
| B2 | Klucze dni w UTC (`todayStr` = `toISOString`) vs lokalne (`dateISOLocal`) | `core.js:581`, `dashboard.js:269`, `history-stats.js:13` vs `chores.js`, `notes.js` | W PL między 00:00 a 01:00/02:00 aktywność liczy się do limitu i wykresu **poprzedniego** dnia; streak liczony w innym kalendarzu niż obowiązki i zadania | Jedna funkcja `dayKey()` w `lib/dates.ts`, przełączenie na czas lokalny przy cutover (5.4, M4) |
| B3 | Zapisy wielodokumentowe bez transakcji/batcha | `activities.js:70-87`, `chores.js:135-172` (błędy kasowania połykane w 150-152), `money.js:266-281`, `dashboard.js:208-224` | Częściowy zapis = dryf punktów/salda; przy rozliczeniu obowiązków możliwa podwójna wypłata albo utrata wpisów | Każdy use-case w `runTransaction`/`writeBatch` |
| B4 | Saldo Money i cofanie punktów jako read-modify-write | `money.js:53-58`, `dashboard.js:476-495` | Dwa urządzenia/karty jednocześnie → utracona aktualizacja; clamp do 0 powoduje, że liczniki przestają zgadzać się z historią | Transakcje Firestore; clamp zostaje, ale jawnie w domenie i przetestowany |
| B5 | Zadania z Ex-us trafiają do `plannerTasks` | `assistants.js:689-691` | Użytkownik widzi „Dodano zadanie”, ale zadanie nigdzie się nie pojawia | `/create-task` pisze lokalnie do `todos` |
| B6 | Ex-us: 2-3 wywołania backendu na wiadomość | `assistants.js:607-666` | Koszt tokenów, opóźnienie, limit dzienny zjadany przez klasyfikację | Jedno wywołanie z function calling + usage w odpowiedzi |
| B7 | Historia Ex-us/Siri-ous w localStorage bez uid | `assistants.js:195`, `363-364` | Po zmianie konta na tym samym urządzeniu widać cudzą rozmowę i `conversationId` | Magazyn per-uid, czyszczony przy wylogowaniu |
| B8 | `Notification.permission` bez sprawdzenia istnienia API | `settings.js:712` (wołane z `core.js:567`) | iOS Safari bez instalacji PWA: `ReferenceError` przy wejściu w Ustawienia, reszta inicjalizacji (akordeon) się nie wykonuje | Capability checks w jednym module `platform.ts` |
| B9 | Moduły jako lista „włączonych” | `core.js:83-86` | Konta z onboardingiem sprzed 24.08 mają `planner` zamiast `notes` → **Notatnik ukryty**, dopóki user sam go nie włączy | Lista „wyłączonych” + migracja M3 |
| B10 | `parent.html` z twardymi kursami i listą aktywności | `parent.html:137-138`, `234` | Rodzic widzi złe kwoty PLN przy zmienionych kursach; cele pieniężne pokazują saldo zamiast `saved` | Widok rodzica jako route v2 korzystający z tej samej domeny |
| B11 | Raport tygodniowy na legacy danych + workflowy usunięte | `scripts/send-weekly-report.js`, brak `.github/workflows` | Raport nie wychodzi; gdyby wychodził, pokazywałby błędne dane | Przepisany skrypt na wspólnej domenie + przywrócone workflowy |
| B12 | Kod weryfikacji emaila rodzica w dokumencie usera | `settings.js:465-469` | Dziecko może odczytać kod albo wpisać `parentEmail` bezpośrednio — weryfikacja jest kosmetyczna | Kod generowany i sprawdzany w Cloud Function (etap 6) |
| B13 | Wątek zgłoszenia jako read-modify-write tablicy | `bug-reports.js:169-172` | Równoczesna odpowiedź admina i usera → jedna ginie | `arrayUnion` |
| B14 | Strona `shop` nieosiągalna | `activities.js:282-441`, `app.html:1583-1608` | Martwy kod, ale `purchases` nadal czytane (rodzic, raport, `spentAllTime`) | Niepotrzebne w v2; kolekcja zostaje (read-only) |
| B15 | Zapisy w trakcie renderu | `dashboard.js:80-85` (cel „osiągnięty”), `305-308` (zużycie freeze) | Samo otwarcie dashboardu pisze do Firestore; wielokrotny render = wielokrotne zapisy | Efekty tylko w serwisach, wywoływane jawnie |
| B16 | Odczyty całych kolekcji | `dashboard.js:272-277` (cały `dailyLog`), `history-stats.js:171-176` (wszystkie aktywności), `money.js:108-113` (wszystkie transakcje), `history-stats.js:245-249` (7 sekwencyjnych `getDoc`) | Koszt i czas ładowania rosną liniowo z historią | Zapytania z zakresem dat, paginacja kursorem, subskrypcje |
| B17 | Usunięcie definicji aktywności | `core.js:282` | Historia pokazuje surowe id zamiast nazwy | Soft-delete (`archived: true`) zamiast kasowania |
| B18 | Kategoria transakcji po nazwie | `money.js:268` | Nie da się zmienić nazwy kategorii bez „osierocenia” transakcji | Zostaje (kompatybilność); zmiana nazwy jako jawna migracja wsadowa |
| B19 | Testy Ex-us na kopii kodu | `tests/fixtures/exus-harness.html` | Fałszywe poczucie pokrycia | Vitest importuje prawdziwe moduły; Firebase za interfejsem |
| B20 | Blokada zoomu + 100vh + nowrap toast | `app.html:9`, `951`, `1134`, `style.css:429` | Dostępność, zasłonięte pole czatu, ucięte komunikaty | Pola ≥ 16 px, `dvh`, toast wielowierszowy |
| B21 | i18n niepełne | `assistants.js` (PL na sztywno), `parent/index/verify.html` (tylko PL), `toLocaleDateString('pl-PL')` w kilku miejscach | EN użytkownik widzi mieszankę języków | Wszystkie teksty przez i18n, `Intl` z aktywnym locale |
| B22 | Rodzic może czytać `notes` i `todos` | `firestore.rules:57-67` | Prywatne notatki technicznie dostępne dla rodzica (UI ich nie pokazuje) | Wykluczenie w regułach (etap 8) — do decyzji |
| B23 | Firebase SDK z innego originu | `core.js:1-9` | SW go nie cache'uje; start offline zależy od cache HTTP przeglądarki | SDK w bundlu, precache |

### 2.4 Kod: zachować / przenieść logikę / przepisać / usunąć

**Zachować bez zmian (na początek):**
`firestore.rules`, dane konfiguracyjne Firebase (`firebase-config.js`), `games.js` (cały silnik; w v2 owinięty
w lazy moduł), `fps.html` (samodzielna strona), testy Redstone/FPS, `email-templates/weekly-report.html`,
ikony i logo, `manifest.json` (aktualizacja pól przy cutover).

**Przenieść logikę 1:1 (przepisać w TS, zachować semantykę — z testami „golden”):**

| Logika | Źródło | Uwagi |
|---|---|---|
| Punkty za aktywność i cap dzienny | `activities.js:113-125` | `round(min/60 × pkt/h)`, `min(earned, max(0, limit − today))`, min. 5 min |
| Poziom | `dashboard.js:253-266` | 500 XP/poziom, tytuły z i18n |
| Streak + freeze | `dashboard.js:268-359` | Freeze raz na 7 dni, przeskakuje jedną lukę; start od wczoraj, jeśli dziś 0 |
| Osiągnięcia | `dashboard.js:362-418` | 14 progów, dopisywanie bez odbierania |
| Obowiązki: „dziś/wczoraj”, jednorazowe, rozliczenie | `chores.js:266-309`, `135-172` | Rozliczenie po **bieżącym** kursie |
| Money: saldo ≥ 0, koszt w punktach, pożyczki, limit miesięczny | `money.js` | Pożyczki bez wpisu w transakcjach (patrz 5.4 M6) |
| Cele: max 3, wpłata z salda, zwrot przy usunięciu/zmianie typu | `dashboard.js:176-250` | |
| Budowa PC (kawałki, kara) | `notes.js:33-137` | Już czyste funkcje — port prawie dosłowny |
| Szkice offline (payloady) | `offline.js` | Te same kształty i ten sam klucz localStorage |
| Zgłoszenia: 1/dzień, bonus, spam, TTL 12 h | `bug-reports.js` | |
| Kolejka broadcastów, „Co nowego?” | `updates.js` | CHANGELOG jako dane |
| Brama boot (kolejność kroków) | `core.js:350-427` | |
| Seedy (aktywności, obowiązki, kategorie) | `core.js:288-294`, `chores.js:19-28`, `money.js:92` | Te same id, żeby historia się nie zgubiła |

**Przepisać od zera:** cały HTML/CSS, nawigacja, globalne `window.*`, SW, klient Ex-us, `parent.html`,
formularze, modale, toasty, integracja i18n (sam słownik zostaje), `index.html`/`verify.html`.

**Usunąć:** Siri-ous (kod, CSS, klucze localStorage), Tabler Icons, strona `shop`, przełącznik asystentów,
dolny pasek nawigacji, pozostałości Plannera, fonty ładowane „na zapas”.

---

## 3. Plan migracji

### 3.1 Strategia: strangler fig na tym samym originie

Intuicja: zamiast wyłączyć stary dom i budować nowy, stawiamy nowy obok, na tych samych fundamentach (dane),
i przeprowadzamy się pokój po pokoju. Stary dom stoi, dopóki nowy nie jest w pełni zamieszkany.

Mechanika:

1. v2 jest budowane przez Vite i wdrażane przez GitHub Actions na **ten sam** GitHub Pages pod ścieżką
   `/lifexp-app/v2/`. v1 zostaje w katalogu głównym bez zmian.
2. v1 i v2 korzystają z tego samego projektu Firebase, tych samych kont i tych samych kolekcji.
3. Moduł w v2 jest „gotowy”, gdy przejdzie testy parytetu (sekcja 8.3): ten sam scenariusz w v1 i v2 daje
   identyczny stan Firestore.
4. Cutover: v2 przejmuje katalog główny (w tym `sw.js`, `app.html` jako przekierowanie), v1 ląduje pod
   `/v1/` jako fallback na 2-4 tygodnie.

### 3.2 Zasady obowiązujące przez cały okres równoległy

| Zasada | Dlaczego |
|---|---|
| Schemat tylko addytywny: nowe pola/kolekcje OK, rename/delete/zmiana typu NIE | v1 musi dalej czytać wszystko, co zapisze v2 |
| v2 zapisuje dokumenty w kształcie, który v1 rozumie (te same nazwy pól, typy, `source`) | Pożyczki, cele, transakcje są czytane przez v1, rodzica i raport |
| Firebase SDK w v2 przypięty do **10.12.x** (npm), domyślna nazwa app, te same ustawienia cache | Ta sama wersja schematu IndexedDB → brak konfliktu cache i wspólna sesja logowania. Upgrade SDK po wyłączeniu v1 |
| Push (FCM) tylko w v1 do cutover | Dwa Service Workery = dwie subskrypcje push = podwójne powiadomienia |
| SW v2 ze scope `/lifexp-app/v2/` | Dłuższy scope wygrywa — v2 kontroluje swoje strony, v1 swoje |
| Migracje danych uruchamiane jawnie, idempotentne, z markerem w profilu | Brak „napraw przy odczycie” (v1 robi to w renderze — B15) |
| Nie używać v1 i v2 jednocześnie na dwóch urządzeniach do operacji na saldzie | v1 nie ma transakcji (B3/B4) — wyścig nadal możliwy po stronie v1 |

### 3.3 Co zachować, co przepisać — kolejność

Kolejność wynika z ryzyka i sprzężeń: najpierw rzeczy tylko do odczytu, potem moduły izolowane, na końcu
moduły, które piszą do salda i punktów (sprzężenia Money ↔ Chores ↔ Goals ↔ Activities). Szczegóły
i Definition of Done — sekcja 9.

```
0 Siatka bezpieczeństwa ─▶ 1 Fundament ─▶ 2 Dane + domena (read-only) ─▶ 3 Moduły z zapisem
   (backup, CI, emulator,     (shell, auth,     (repozytoria, konwertery,        3a Tasks+Notes
    inwentaryzacja danych,     drawer, tokens,   domena z golden testami,        3b Chores
    functions/ w repo)         router, i18n)     dashboard read-only)            3c Money
                                                                                  3d Goals
                                                                                  3e XP/aktywności
                                                                                  3f Offline
 ─▶ 4 Settings + Reports/Bugs ─▶ 5 Ex-us (5a lokalne komendy, 5b AI 1-call) ─▶ 6 Rodzic, raport, push
 ─▶ 7 Cutover ─▶ 8 Sprzątanie + reguły
```

---

## 4. Architektura LifeXP v2

### 4.1 Stack

| Warstwa | Wybór | Dlaczego (i analogia C#) |
|---|---|---|
| Język | TypeScript `strict` | Kompilator łapie literówki w polach i nieobsłużone `null` — główne źródło bugów tego kodu. ≈ C# z nullable reference types |
| UI | Preact 10 + `@preact/signals` | ~4 KB, API zgodne z React (największa baza wiedzy modeli AI), deklaratywny render ze stanu. Signals ≈ `INotifyPropertyChanged`/`ObservableProperty` — tylko zależne fragmenty się przerysowują |
| Build | Vite | Szybki dev server, bundling, hashowane assety. ≈ MSBuild + `dotnet watch` |
| Routing | hash router (`wouter` z hash location albo ~60 linii własnego) | GitHub Pages nie ma SPA fallback; hash działa offline i z SW bez sztuczek |
| Walidacja | `zod` (v4) | Jeden schemat → walidacja argumentów komend, parsowanie dokumentów, JSON Schema dla Gemini. ≈ FluentValidation + kontrakt `System.Text.Json` |
| Dane | Firebase JS SDK 10.12.x z npm (modular) | Ta sama wersja co v1 w okresie równoległym; wersja w lockfile |
| i18n | i18next + typowane klucze | Słownik przenoszony 1:1 z `i18n-resources.js` |
| Markdown | marked + DOMPurify, dynamic import | Bez zmian semantyki, ale z bundla zamiast CDN |
| PWA | `vite-plugin-pwa` (strategia `injectManifest`) | Własny SW (FCM + precache Workbox) |
| Testy | Vitest, Playwright, Firebase Emulator Suite | ≈ xUnit + Playwright .NET + testowa baza |
| Lint | ESLint + reguły architektury (zakaz importów w złą stronę, zakaz inline style, zakaz `innerHTML`) | Egzekwuje warstwy automatycznie, nie „na słowo” |

Plan B (jeśli build step jest nie do przyjęcia): ES modules bez bundlera + import maps + JSDoc + `tsc --checkJs`.
Działa, ale traci model komponentów, lockfile SDK i precache hashowanych plików. Rekomendacja: plan A.

### 4.2 Warstwy i reguła zależności

Opis: każda warstwa może importować tylko warstwy **pod sobą**. Logika domeny nie wie, że istnieje Firebase
ani DOM, więc testuje się ją w milisekundach, bez przeglądarki.

```
features/*   (widoki + stan ekranu)          ≈ Blazor pages/components
   │ używa
services/*   (use-case'y, transakcje)         ≈ MediatR handlers / application services + UnitOfWork
   │ używa                     │ używa
domain/*  (czyste funkcje)   data/* (repozytoria, konwertery, Firebase) ≈ EF Core DbContext + value converters
   │
lib/*  (daty, pieniądze, tekst — czyste)
ui/*   (design system — bez wiedzy o domenie)
```

Zakazy egzekwowane lintem: `domain` nie importuje `data`/`features`/`ui`; `ui` nie importuje `domain`/`data`;
`features` nie importuje `data` bezpośrednio (tylko przez `services`/`stores`).

### 4.3 Struktura katalogów

```
/                         # w okresie równoległym: pliki v1 bez zmian
├─ v2/                    # nowa aplikacja (root Vite)
│  ├─ index.html
│  ├─ vite.config.ts
│  ├─ tsconfig.json
│  ├─ public/             # manifest, ikony, self-hosted font (subset latin-ext)
│  └─ src/
│     ├─ main.tsx
│     ├─ app/             # AppShell, Drawer, TopBar, router, boot gates, registry.ts
│     ├─ ui/              # tokens.css, base.css, components/*
│     ├─ lib/             # dates.ts, money.ts, format.ts, text.ts, markdown.ts, platform.ts
│     ├─ i18n/            # init.ts, pl.json, en.json, types.d.ts
│     ├─ data/            # firebase.ts, paths.ts, converters/*, repos/*
│     ├─ domain/          # points, level, streak, achievements, chores, money, loans, goals, tasks(pcBuild), notes, bugs
│     ├─ services/        # activity, gaming, chores, money, loans, goals, tasks, notes, bugs, profile, migrations
│     ├─ stores/          # session, profile, today, … (signals + subskrypcje)
│     ├─ offline/         # kolejka szkiców kompatybilna z v1
│     └─ features/
│        ├─ today/        # dashboard
│        ├─ tasks/  goals/  chores/  money/  notes/
│        ├─ stats/        # historia, statystyki, osiągnięcia, generator, granie
│        ├─ reports/      # zgłoszenia, historia aktualizacji, broadcasty (admin)
│        ├─ settings/  parent/  games/
│        └─ exus/         # engine: parser/, pipeline.ts, registry.ts, undo.ts, context.ts, api.ts, ui/
├─ functions/             # Cloud Functions odtworzone od nowa, osobny codebase — exusTurn, weryfikacja rodzica (6.12)
├─ tests/                 # e2e v2 + istniejące testy gier
├─ docs/v2/               # ten plan + decyzje (ADR)
└─ .github/workflows/     # test.yml, deploy.yml, notify.yml, weekly-report.yml
```

### 4.4 Kontrakt modułu (feature)

Każdy moduł rejestruje się jednym obiektem. Nawigacja, onboarding, lista modułów w Ustawieniach, komendy Ex-us
i kontekst AI są **generowane** z rejestru — dodanie modułu = jeden katalog + jedna linia w `registry.ts`.
(≈ `services.AddFeature<T>()` w DI.)

```ts
// app/registry.ts
export interface FeatureDef {
  id: ModuleId;                          // 'tasks'
  labelKey: I18nKey;                     // etykieta w nawigacji
  routes: RouteDef[];                    // { path: '/tasks', view: lazy(() => import('./TasksPage')) }
  nav?: { group: 'main' | 'secondary'; order: number; meta?: () => string | null }; // np. "3 po terminie"
  toggleable: boolean;                   // czy można wyłączyć w Ustawieniach
  commands?: CommandDef<any>[];          // komendy Ex-us tego modułu
  exusContext?: (s: Stores) => unknown;  // wkład modułu do snapshotu kontekstu AI
}
```

### 4.5 Stan i przepływ danych

- `stores/session` — user z Auth, bramy boot.
- `stores/profile` — `onSnapshot(users/{uid})` przez cały czas życia sesji (1 dokument).
- Stores modułów subskrybują swoje kolekcje **tylko gdy moduł jest otwarty** (subscribe on enter,
  unsubscribe on leave) albo gdy potrzebuje ich Ex-us (lazy fetch).
- Po zapisie nie ma ręcznego „przeładuj wszystko”: Firestore z `onSnapshot` daje natychmiastową kompensację
  opóźnienia (lokalny zapis widać od razu), a widoki są funkcją stanu.
- Jeden kierunek: widok → `service.x()` → Firestore → snapshot → store → widok.

### 4.6 Serwisy i transakcje

Każda akcja użytkownika to jedna funkcja serwisu, która liczy plan w domenie i zapisuje go atomowo:

```ts
// services/activity.ts
export async function logActivity(input: LogActivityInput): Promise<LogActivityResult> {
  const uid = session.uid();
  return runTransaction(db, async (tx) => {
    const dayRef = paths.dailyLog(uid, dayKey(new Date()));
    const day = dailyLogConverter.fromSnap(await tx.get(dayRef));
    const profile = profileStore.value;                        // limit i kursy
    const plan = planActivity(input, { todayEarned: day.pointsEarned, dailyLimit: profile.dailyLimit }); // domena, czysta
    if (plan.points === 0) throw new DomainError('dailyLimitHit');
    tx.set(paths.newActivity(uid), plan.activityDoc);
    tx.set(dayRef, { pointsEarned: increment(plan.points) }, { merge: true });
    tx.update(paths.user(uid), { 'points.total': increment(plan.points), 'points.earnedAllTime': increment(plan.points) });
    return plan;
  });
}
```

Transakcje wymagają sieci — to zgodne z obecnym designem offline: gdy offline, serwis zwraca
`{ status: 'queued' }` i zapisuje szkic (ten sam format co v1), zamiast próbować zapisu.

Dla Money zostaje dokładna semantyka zaokrągleń v1 (`round2(current + delta)` w transakcji, nie `increment`
na floatach), a domena liczy w groszach (liczby całkowite) i konwertuje na granicy zapisu.

### 4.7 Routing

`#/today`, `#/tasks`, `#/goals`, `#/chores`, `#/money`, `#/money/loans`, `#/notes`, `#/notes/:id`, `#/stats`,
`#/stats/history`, `#/reports`, `#/settings/:section?`, `#/exus`, `#/games`, `#/parent`, `#/login`, `#/verify`.
Każdy widok ładowany leniwie. Wyłączony moduł → route niedostępny (przekierowanie na `#/today`, jak dziś).
Otwarcie drawera/sheetu dokłada wpis do historii, więc systemowe „wstecz” na Androidzie je zamyka.

### 4.8 Offline i Service Worker

- Precache: wszystkie hashowane assety + `index.html` (manifest Workbox) → aktualizacja atomowa, koniec B1.
- Nawigacje: network-first z fallbackiem na precache `index.html`.
- Firebase SDK w bundlu → start offline nie zależy od cache HTTP (B23).
- Dane offline: `persistentLocalCache` jak dziś (odczyt z cache).
- Zapisy offline: kolejka szkiców (`offline/queue.ts`) czyta i pisze **ten sam** klucz `lifexp-offline-queue`
  i te same payloady co v1. Zatwierdzanie szkicu wywołuje ten sam serwis co formularz.
- Aktualizacja: baner „Nowa wersja — odśwież” zamiast `skipWaiting` w ciemno (nie przerywa wpisywania).
  **Zmiana w 1f (2026-09-30):** skoro nawigacje są network-first, start online zawsze dostaje najnowszy build,
  a baner mylił (strona często już była nowa). Nowy SW instaluje się w tle i przejmuje kontrolę bez
  przeładowania; otwarta strona przeładowuje się raz tylko wtedy, gdy prosi o chunk usunięty deployem
  (`vite:preloadError`, `app/pwa.ts`). Wpisywanie nie jest przerywane.
- v1 `sw.js` przy aktywacji kasował wszystkie cache poza własnym, czyli też precache v2 — od 1f kasuje tylko
  `lifexp-shell-*`; cache v2 mają prefiks `lifexp-v2`.

### 4.9 i18n i motywy

- Słownik z `i18n-resources.js` przeniesiony do `pl.json`/`en.json`, klucze typowane (błąd kompilacji przy
  literówce w kluczu). Daty i liczby wyłącznie przez `Intl` z aktywnym locale.
- Motywy jako zestawy tokenów, bez selektorów per-komponent (dziś `body.theme-apple .btn-primary` itd.).
  Motyw = rodzina × tryb: `[data-theme="lifexp|ios|gold"][data-mode="light|dark"]`. Tryb do wyboru:
  jasny, ciemny albo jak system (`prefers-color-scheme`). Decyzja D4:

  | Rodzina | Tryby | Domyślny tryb | Charakter |
  |---|---|---|---|
  | **LifeXP** (domyślna) | ciemny = obecny wygląd v1, jasny = nowy | ciemny | Fiolet `#6c63ff` + zieleń `#4ecca3`, Manrope |
  | **iOS** (nowa, zastępuje „Apple”) | jasny i ciemny | jak system | Kolory systemowe iOS: tło grupowane `#F2F2F7`/`#000`, komórki `#FFF`/`#1C1C1E`, akcent systemBlue `#007AFF`/`#0A84FF`, zieleń `#34C759`/`#30D158`, czerwień `#FF3B30`/`#FF453A`; font systemowy (`-apple-system`); listy „inset grouped” z cienkimi separatorami zamiast kart z obramowaniem; rozmycie tylko w top barze (U5) |
  | **Gold** | ciemny | ciemny | Zestaw tokenów z v1 bez zmian |

  Obecny motyw „Apple” (jasne szkło z zielonym akcentem na kartach) nie przechodzi do v2: nie wygląda jak iOS,
  a rozmycie na kartach obniża płynność. Migracja `lifexp-theme` z v1: `lifexp` → LifeXP ciemny,
  `apple` → iOS, `gold` → Gold. Wybór fontu zostaje (leniwe ładowanie).

### 4.10 Konwencje dla rozwoju z AI

Plik `CLAUDE.md` w katalogu głównym (treść do przygotowania w etapie 1):

- Mapa warstw i reguła zależności (4.2), gdzie co leży (4.3), kontrakt `FeatureDef`.
- „Każda zmiana danych przez serwis; serwis = domena + transakcja; domena ma testy.”
- „Nowe pole w Firestore: dodaj do konwertera z wartością domyślną; nigdy nie zmieniaj istniejącego.”
- „Zero inline style, zero `innerHTML` poza komponentem Markdown, zero `window.*`.”
- „Każdy tekst przez i18n; każda kwota przez `formatMoney`; każda data przez `lib/dates`.”
- Komendy walidacyjne przed PR: `npm run typecheck && npm run lint && npm test`.
- Małe PR-y: jeden moduł lub jeden serwis na PR.

---

## 5. Model danych

### 5.1 Zasady

1. **Nic nie jest kasowane ani przemianowywane** w okresie równoległym. Legacy kolekcje (`purchases`,
   `moneyGoals`, `plannerTasks`) zostają nietknięte; decyzje o nich zapadają w etapie 8.
2. **Każdy dokument przechodzi przez konwerter** (`data/converters/*`) z wartościami domyślnymi dla
   brakujących pól i tolerancją legacy kształtów. Konwerter tylko czyta — nigdy nie zapisuje „poprawionej”
   wersji przy odczycie.
3. **Migracje są jawne**: funkcja w `services/migrations`, idempotentna, zapisuje marker
   `users/{uid}.migrations.{id} = timestamp` w tym samym batchu co zmiana.
4. **Zapisy v2 muszą być czytelne dla v1** (kontraktowe testy w emulatorze, 8.3).

### 5.2 Decyzje per kolekcja

| Kolekcja / pole | Decyzja | Uwagi |
|---|---|---|
| `users/{uid}` (profil) | Zachować | Nowe pola: `schemaVersion`, `migrations{}`, `disabledModules[]`, `dayKeyMode` |
| `users.goals[]` | Zachować (tablica, max 3) | Zapis przez transakcję (koniec lost update). Przeniesienie do podkolekcji — tylko po wyłączeniu v1 i przepisaniu backendu, o ile w ogóle potrzebne |
| `users.points.*` | Zachować | Aktualizacja wyłącznie w transakcjach z dokumentem źródłowym |
| `activities`, `activityDefs` | Zachować | `activityDefs.archived: true` zamiast kasowania (B17); v1 zignoruje pole |
| `dailyLog/{key}` | Zachować | Zmiana semantyki klucza UTC → lokalny przy cutover (M4) |
| `gamingSessions` | Zachować | |
| `purchases` | Read-only | Tylko dla historii i `spentAllTime`; brak zapisu w v2 |
| `chores`, `choreDefs`, `chorePayouts` | Zachować | Nowe opcjonalne pole wpisu: `rate` (kurs w chwili dodania) — tylko informacyjnie, rozliczenie liczone jak w v1 |
| `money/settings`, `money/balance` | Zachować | |
| `moneyTransactions` | Zachować | Nowe wartości `source` dopiero po wyłączeniu v1 (M6) |
| `moneyCategories` | Zachować | Referencja po nazwie zostaje |
| `moneyLoans` | Zachować | |
| `notes`, `todos` | Zachować | `todos` = moduł Tasks. Nowe opcjonalne: `doneAt` |
| `users.pcBuild` | Zachować | |
| `plannerTasks` | Nie ruszać | Opcjonalny import niezrobionych do `todos` (M5, decyzja usera) |
| `moneyGoals` | Nie ruszać | W produkcji brak dokumentów; skrypt raportu przestaje ją czytać (etap 6) |
| `aiConversations` | Nie ruszać, v2 nie czyta | Historia backendu v1. Nie importujemy do lokalnej historii v2; dostęp rodzica — D7 |
| ~~`aiTestAccces`~~ (literówka) | Usunięta 2026-09-29 | Duplikat wpisu z `aiTestAccess` |
| `fcmTokens` | Zachować | Po cutover nowe tokeny z SW v2; martwe czyści skrypt push |
| `bugReports`, `bugReportsConfig`, `broadcasts` | Zachować | Wiadomości przez `arrayUnion` |
| `aiTestAccess`, `aiUsageGlobal`, `aiSettings` | Zachować | Obsługiwane przez backend |
| Ex-us: historia czatu | Nowe, lokalnie (IndexedDB per uid) | Jedyne źródło historii; backend `exusTurn` jest bezstanowy (6.9) |
| Ex-us: zużycie tokenów | Nowe: `aiUsage/{uid}_{data}`, `aiUsageGlobalV2/{data}` | Top-level, zapis tylko z funkcji (6.12) |

### 5.3 Legacy kształty, które konwertery muszą obsłużyć

Zweryfikowane na produkcji 2026-09-27 (`INVENTORY.md`: 6 kont, sam schemat bez wartości). Kolumna „Produkcja”
mówi, ile dokumentów ma dany wariant; wariant nieobecny dziś zostaje obsłużony, jeśli kosztuje jedną linię
wartości domyślnej, bo v1 wciąż zapisuje dane w okresie równoległym.

| Encja | Wariant | Produkcja | Obsługa |
|---|---|---|---|
| Profil | brak `enabledModules`/`accountMode`/`onboardingDone` | 1/6 kont | Domyślne jak w v1 (`core.js:450-453`, `83-86`), także dla `points` (dziś 6/6) |
| Profil | brak `lang`, `dailyLimit`, kursów `pointsRate*` | 3-4/6 kont | Domyślne jak w v1 (150, 1 zł/10 pkt, 0,45 zł/1 pkt) |
| Profil | `parentEmail: ''` | 5/6 kont | Pusty string = brak |
| Profil | legacy `goalName/goalType/goalAmount/goalCelebrated` | 0/6 | Brak konwersji; M1 skreślona (v1 już tych pól nie zapisuje) |
| Cel | brak `saved` | 1/3 celów | `0` |
| Aktywność | `type: '__generated__'` + `typeName` | 3/37 | Nazwa z `typeName` |
| Aktywność | `type` spoza seedów (własna albo skasowana definicja) | 20/37 | Nazwa z `activityDefs`; gdy definicji brak, etykieta zastępcza z i18n zamiast surowego id |
| Aktywność | `timestamp` jako string | 0/37 (Timestamp 37/37) | Tolerancja zostaje (jedna gałąź w konwerterze) |
| Aktywność | `desc: ''` | 33/37 | Pusty string = brak opisu |
| Obowiązek | `choreId` wskazujący nieistniejącą definicję | 2/14 (wszystkie 36 definicji to seedy) | Nazwa i emoji ze zdenormalizowanych `choreName`/`choreEmoji` (14/14) |
| Obowiązek | brak `monthKey` | 0/14 | Wyliczenie z `dateISO` zostaje jako fallback |
| Wypłata / zakup | `amountPln` / `amount` raz int, raz float | float: 4/6 wypłat, 1/2 zakupów | Zwykła liczba; zaokrąglanie jak w v1 (`round2`) |
| Money | legacy `pendingPoints` w `money/*` | 2/12 | Ignorowane, nie wyświetlane, nie kasowane |
| Transakcja | brak `pointsCost`, brak `source` | 0/5 | `0`, `'manual'` |
| Transakcja | wypłata obowiązków bez transakcji `chore_payout` | 6 wypłat, 0 takich transakcji | Saldo nie jest odtwarzalne z historii transakcji — „Sprawdź spójność” (5.5) pokazuje różnicę, nie poprawia |
| Notatka / zadanie | `createdAt` jako ISO string | 8/8, 7/7 | Normalizacja do `Date` w pamięci, zapis w tym samym formacie co v1 |
| Zgłoszenie | `createdAt` Timestamp, `messages[].at` ISO string | 4/4 | Oba formaty w jednym dokumencie |
| Pożyczka | brak `repaidAmount`/`completedAt` | brak pożyczek w produkcji | `0`, `null` |

### 5.4 Migracje

| Id | Kiedy | Co robi | Odwracalność |
|---|---|---|---|
| ~~M1~~ | — | ~~Legacy pola celu → `goals[]`~~ Skreślona: inwentaryzacja pokazała 0/6 kont z legacy polami | — |
| M2 | Etap 3c | Backfill `moneyIncomeAllTime` (identycznie jak `money.js:73-83`). Dziś pole ma 6/6 kont, więc M2 dotyczy tylko kont, które nigdy nie otworzyły Money | Idempotentna |
| M3 | Etap 4 | `disabledModules` = moduły istniejące w dniu zapisu `enabledModules` minus `enabledModules`. `notes` włączone, jeśli `planner` był włączony. `enabledModules` dalej zapisywane dla v1 | Tylko nowe pole |
| M4 | Cutover | `dayKeyMode: 'local'` — nowe wpisy do `dailyLog` pod lokalną datą. Historia bez zmian (różnica dotyczy wyłącznie okna 0:00-2:00) | Flaga |
| M5 | Opcjonalnie | Import niezrobionych `plannerTasks` jako `todos` (termin = `dateISO`) | Źródło nietknięte |
| M6 | Po wyłączeniu v1 | Ledger Money: wpłaty na cele i pożyczki zaczynają tworzyć wpisy z nowymi `source` (`goal_deposit`, `goal_refund`, `loan_*`) + wpis „saldo otwarcia”. Dzięki temu saldo da się przeliczyć z historii i zweryfikować | Nowe dokumenty, filtrowane w UI |

### 5.5 Ochrona przed utratą danych

1. **Backup przed każdym etapem z zapisami**: eksport Firestore (`gcloud firestore export` do bucketu GCS;
   projekt ma już Cloud Functions, więc jest na planie Blaze).
2. **Dry-run migracji** na kopii: eksport → import do emulatora → migracja → diff dokumentów.
3. **Kontrakt v1↔v2**: scenariusze zapisów wykonane w v2 muszą dać dokumenty, które v1 czyta bez błędów
   (test e2e v1 na emulatorze po zapisie v2).
4. **Reconcile (tylko odczyt)**: narzędzie w Ustawieniach → „Sprawdź spójność”: suma punktów z `activities`
   i `purchases`/transakcji vs `points.*`, suma `dailyLog` vs aktywności, saldo vs transakcje (dokładne po M6).
   Pokazuje różnice, nic nie poprawia automatycznie.
5. **Szkice offline** z v1 odczytywane przez v2 — test na kolejce z wpisami każdego typu.
6. **Fallback**: v1 dostępne pod `/v1/` po cutover.

---

## 6. Architektura Ex-us

### 6.1 Cel i zasada

Ex-us jest jedynym asystentem. Zasada: **AI rozpoznaje intencję, aplikacja wykonuje lokalnie**.

- Komenda `/...` → **0 wywołań AI**. Parser, walidacja, wykonanie — wszystko lokalnie.
- Wiadomość w języku naturalnym → **dokładnie 1 wywołanie** backendu, które zwraca odpowiedź tekstową
  **i** listę akcji w formacie identycznym z sparsowaną komendą. Potwierdzenie, wykonanie, cofnięcie,
  odświeżenie licznika tokenów — lokalnie, bez kolejnych wywołań.

### 6.2 Przepływ

```
                    ┌──────────── "/create-goal Rower 1500 zł" ────────────┐
input ──▶ router ──▶│ parser (tokenize → slot filling → entity resolve)     │──┐
                    └───────────────────────────────────────────────────────┘  │  ParsedCommand
                    ┌──────────── "odłóż 50 zł na rower" ──────────────────┐  │  { command, args }
                    │ exusTurn(message, context)  ── 1 wywołanie ──▶ Gemini │──┤
                    │ ◀── { reply, actions: ParsedCommand[], usage }        │  │
                    └───────────────────────────────────────────────────────┘  ▼
                                                        pipeline (wspólny):
                                                        validate (zod) → resolve refs → preview (karta)
                                                        → [potwierdzenie wg ryzyka] → execute (serwis)
                                                        → wynik w czacie + toast → stos undo
```

(≈ MediatR: `ParsedCommand` to `IRequest`, handler komendy to `IRequestHandler`, walidacja/potwierdzenie to
pipeline behaviors.)

### 6.3 Parser komend

**Intuicja.** Użytkownik pisze tak, jak myśli: `/zadanie Kupić mleko jutro M`. Nie pamięta kolejności
argumentów. Parser powinien rozpoznać, że „jutro” to data, „M” to rozmiar, a reszta to treść — niezależnie
od kolejności.

**Opis słowny (slot filling).** Każda komenda deklaruje sloty z typami. Każdy typ ma rozpoznawacz
(recognizer), który mówi, czy token do niego pasuje. Parser:

1. Dzieli tekst na tokeny, szanując cudzysłowy (`"..."`, `„...”`).
2. Zdejmuje argumenty nazwane (`kwota=1500`, `--jednorazowy`).
3. Sortuje pozostałe sloty od najbardziej do najmniej specyficznego typu:
   `enum` → `date` → `duration` → `money` → `number` → `entity` → `text`.
4. Dla każdego slotu bierze pierwszy niezwiązany token, który pasuje do rozpoznawacza, i go „zjada”.
5. Wszystkie tokeny, które zostały, sklejone w kolejności tworzą jedyny slot typu `text` (np. treść zadania).
6. Brakujące wymagane sloty **nie są błędem** — karta podglądu jest edytowalnym formularzem z uzupełnionymi
   polami i zaznaczonym brakiem. Parser nie musi być perfekcyjny, bo zawsze jest krok korekty.
7. Encje (`<zadanie>`, `<cel>`, `<obowiązek>`, `<pożyczka>`): najpierw dokładny ref (`t3`, `g1`), potem
   dopasowanie rozmyte po znormalizowanej nazwie (małe litery, bez polskich znaków, odległość Levenshteina
   ≤ 2 albo pokrycie tokenów). Kilku kandydatów → karta z wyborem.

**Formalnie.** Dla tokenów `T = (t₁…tₙ)` i slotów posortowanych po specyficzności `S = (s₁…sₖ)`:
`bind(sᵢ) = min{ j : tⱼ ∉ Used ∧ recognizeᵢ(tⱼ) ≠ ⊥ }`; slot tekstowy dostaje `T \ Used`.
Złożoność O(n·k) — przy n, k < 20 pomijalna. Rozpoznawanie jest deterministyczne, więc łatwe do testów
tabelarycznych.

**Rozpoznawacze:**

| Typ | Przykłady wejścia | Wynik |
|---|---|---|
| `money` | `12,50` `12.5zł` `12 zł` `1 500 PLN` | grosze (int) + sygnał jednostki (`zł`) |
| `points` | `500pkt` `500 pkt` | int + sygnał jednostki (`pkt`) |
| `duration` | `90` `90m` `1h` `1h30` `1,5h` | minuty |
| `date` | `dziś` `jutro` `pojutrze` `pt` `12.10` `2026-10-12` `+3d` | `YYYY-MM-DD` lokalnie |
| `enum` | `S/M/L`, `dziś/wczoraj`, `punkty/pieniądze` | wartość enuma |
| `entity` | `t3`, `rower`, `"nowy rower"` | id dokumentu |

Jednostka wnioskuje typ: `/cel Rower 1500 zł` → cel pieniężny, `/cel Rower 5000 pkt` → punktowy.

**Kod (potwierdzenie mechanizmu):**

```ts
type Recognizer<T> = (token: string, ctx: ParseCtx) => T | undefined;

interface SlotDef<T> { name: string; type: SlotType; required: boolean; recognize: Recognizer<T> }

export function fillSlots(tokens: string[], slots: SlotDef<unknown>[], ctx: ParseCtx) {
  const used = new Set<number>();
  const out: Record<string, unknown> = {};
  for (const slot of [...slots].sort(bySpecificity)) {
    if (slot.type === 'text') continue;
    const j = tokens.findIndex((t, i) => !used.has(i) && slot.recognize(t, ctx) !== undefined);
    if (j >= 0) { used.add(j); out[slot.name] = slot.recognize(tokens[j], ctx); }
  }
  const text = slots.find((s) => s.type === 'text');
  if (text) out[text.name] = tokens.filter((_, i) => !used.has(i)).join(' ') || undefined;
  return out; // walidacja wymaganych slotów dopiero w pipeline (zod)
}
```

UI parsera: wpisanie `/` otwiera paletę komend (lista tekstowa, filtrowana na bieżąco, ↑↓/Enter, na telefonie
tap). Rozpoznane fragmenty są podświetlane w polu na żywo, jak w Todoist Quick Add (U9): data, kwota, rozmiar
dostają kolor semantyczny, a karta podglądu pokazuje, co z nich wynika.

Reguły palety (U11, wzorce Linear/Raycast): pusta paleta pokazuje ostatnie i najczęstsze komendy; wyniki
w grupach „Komendy / Ekrany / Ostatnie”; dokładny prefiks nazwy albo aliasu zawsze przed dopasowaniem
rozmytym; każdy wiersz = nazwa + moduł + składnia; brak wyników nigdy nie kończy się ślepą uliczką —
ostatnia pozycja to „Zapytaj Ex-us: <wpisany tekst>”. Placeholder pola: „Napisz do Ex-us albo wpisz /”. Po wyborze komendy — podpowiedź składni pod polem (`/create-task <treść> <termin> [S|M|L]`).
Ta sama paleta działa globalnie (Ctrl/Cmd+K na desktopie).

### 6.4 Command registry

```ts
export interface CommandDef<A> {
  id: string;                     // 'create-goal' — kanoniczne, angielskie (jak w przykładach)
  module: ModuleId;               // 'goals' — komenda znika, gdy moduł wyłączony
  aliases: string[];              // ['cel'] — polskie skróty do wpisywania
  summaryKey: I18nKey;            // opis w palecie i /help
  slots: SlotDef<unknown>[];      // do parsowania tekstu
  schema: z.ZodType<A>;           // walidacja + JSON Schema dla Gemini (z.toJSONSchema)
  risk: 'read' | 'write' | 'destructive';
  aiExposed: boolean;             // czy model może ją proponować
  preview(args: A, s: Stores): PreviewModel;               // treść karty + effects: skutki, np. 'Saldo: 312,50 → 262,50 zł' (U8)
  execute(args: A, svc: Services): Promise<CommandResult>; // wywołuje TEN SAM serwis co formularz w UI
  undo?(result: CommandResult, svc: Services): Promise<void>;
}
```

Rejestr = suma `commands` ze wszystkich włączonych `FeatureDef`. Z tego samego źródła powstają: paleta,
`/help`, walidacja, deklaracje funkcji dla Gemini, testy tabelaryczne.

### 6.5 Kompletny zestaw komend

Ryzyko: `read` — wykonanie od razu; `write` — karta z przyciskiem „Wykonaj”; `destructive` — dialog
z jawnym opisem skutku. Wszystkie `write`/`destructive` przechodzą przez serwisy (limity, saldo ≥ 0,
max 3 cele, max 30 zadań itd. egzekwowane w jednym miejscu).

| Komenda | Alias | Argumenty | Ryzyko | AI | Serwis |
|---|---|---|---|---|---|
| **Ogólne** | | | | | |
| `/help` | `/pomoc` | `[komenda]` | read | — | lokalnie |
| `/today` | `/dzis` | — | read | tak | podsumowanie: punkty/limit, saldo, zadania na dziś, do wypłaty |
| `/go` | `/idz` | `<ekran>` | read | tak | router |
| `/undo` | `/cofnij` | — | write | — | stos undo |
| `/new-chat` | `/nowy` | — | read | — | czat |
| `edit-pending` | — | `<ref karty> <zmienione args>` | read | tak (tylko AI) | aktualizuje niezatwierdzoną kartę (U10) |
| **XP / aktywności** | | | | | |
| `/log-activity` | `/aktywnosc` | `<typ> <czas> [opis]` | write | tak | `activity.log` |
| `/log-gaming` | `/granie` | `<gra> <czas> [data]` | write | tak | `gaming.log` — **w v2 nie ma tej komendy** (5a-9); od etapu gier (g-1) czas grania w grach v2 liczy się sam |
| `/delete-activity` | `/usun-aktywnosc` | `[ostatnia\|ref]` | destructive | tak | `activity.delete` |
| `/what-now` | `/co-teraz` | `<czas>` | read | tak | generator |
| `/streak` | `/seria` | — | read | tak | domena streak |
| `/stats` | `/statystyki` | `[7d\|30d]` | read | tak | domena stats |
| **Zadania** | | | | | |
| `/create-task` | `/zadanie` | `<treść> <termin> [S\|M\|L]` | write | tak | `tasks.create` |
| `/complete-task` | `/zrobione` | `<zadanie>` | write | tak | `tasks.complete` (kawałki PC) |
| `/edit-task` | `/edytuj-zadanie` | `<zadanie> [treść=] [termin=] [rozmiar=]` | write | tak | `tasks.update` |
| `/delete-task` | `/usun-zadanie` | `<zadanie>` | destructive | tak | `tasks.delete` (nowość — v1 nie ma usuwania) |
| `/tasks` | `/zadania` | `[dzis\|zalegle\|wszystkie]` | read | tak | store |
| **Cele** | | | | | |
| `/create-goal` | `/cel` | `<nazwa> <kwota zł\|pkt>` | write | tak | `goals.create` |
| `/deposit-goal` | `/wplac` | `<cel> <kwota>` | write | tak | `goals.deposit` (zdejmuje saldo) |
| `/edit-goal` | `/edytuj-cel` | `<cel> [nazwa=] [kwota=]` | write | tak | `goals.update` |
| `/delete-goal` | `/usun-cel` | `<cel>` | destructive | tak | `goals.delete` (zwrot na saldo) |
| `/goals` | `/cele` | — | read | tak | store |
| **Obowiązki** | | | | | |
| `/complete-chore` | `/obowiazek` | `<obowiązek> [dzis\|wczoraj]` | write | tak | `chores.addEntry` |
| `/create-chore` | `/nowy-obowiazek` | `<nazwa> <pkt> [--jednorazowy]` | write | tak | `chores.createDef` |
| `/delete-chore-entry` | `/usun-wpis` | `[ostatni\|ref]` | destructive | tak | `chores.deleteEntry` |
| `/delete-chore` | `/usun-obowiazek` | `<obowiązek>` | destructive | tak | `chores.deleteDef` |
| `/settle-chores` | `/rozlicz` | — | destructive | tak | `chores.settle` (atomowo → Money) |
| `/chores` | `/obowiazki` | — | read | tak | do wypłaty + miesiąc |
| **Money** | | | | | |
| `/add-money` | `/wplyw` | `<kwota> [kategoria] [notatka] [data]` | write | tak | `money.addIncome` |
| `/remove-money` | `/wydatek` | `<kwota> [kategoria] [notatka] [data]` | write | tak | `money.addExpense` (+ koszt w pkt) |
| `/delete-transaction` | `/usun-transakcje` | `[ostatnia\|ref]` | destructive | tak | `money.deleteTx` |
| `/balance` | `/saldo` | — | read | tak | store |
| `/create-category` | `/kategoria` | `<nazwa>` | write | tak | `money.createCategory` |
| `/lend` | `/pozyczam` | `<osoba> <kwota> [notatka]` | write | tak | `loans.create(lent)` |
| `/borrow` | `/pozyczam-od` | `<osoba> <kwota> [notatka]` | write | tak | `loans.create(borrowed)` |
| `/repay` | `/splata` | `<pożyczka\|osoba> <kwota>` | write | tak | `loans.repay` |
| `/loans` | `/pozyczki` | — | read | tak | store |
| `/money-limit` | `/limit-wydatkow` | `<kwota>` | write | tak | `money.setLimit` |
| **Notatki** | | | | | |
| `/create-note` | `/notatka` | `<tytuł> [treść]` | write | tak | `notes.create` |
| `/archive-note` | `/archiwizuj` | `<notatka>` | write | tak | `notes.archive` |
| `/find-note` | `/szukaj` | `<fraza>` | read | tak | lokalne wyszukiwanie |
| **Zgłoszenia** | | | | | |
| `/report-bug` | `/blad` | `<tytuł> \| <obszar> \| <opis>` | write | tak | `bugs.submit` (limit 1/dzień) |
| **Ustawienia** | | | | | |
| `/daily-limit` | `/limit` | `<pkt>` | write | tak | `profile.setDailyLimit` |
| `/theme` | `/motyw` | `<nazwa>` | write | — | lokalnie |
| `/lang` | `/jezyk` | `<pl\|en>` | write | — | `profile.setLang` |
| `/module` | `/modul` | `<id> <on\|off>` | write | — | `profile.toggleModule` |

Komendy admina (broadcast, moderacja zgłoszeń) celowo **nie** są wystawione do AI.

### 6.6 Wykonanie, potwierdzenia, undo

- Pipeline jest jeden dla slash-komend i akcji z AI; różni się tylko źródłem `ParsedCommand`.
- Polityka potwierdzeń zależy od ryzyka **i źródła** (U7):

  | Źródło | `read` | `write` | `destructive` |
  |---|---|---|---|
  | Komenda wpisana ręcznie (`/...`), wszystkie wymagane sloty rozpoznane | wykonaj | wykonaj + toast „Cofnij” | dialog ze skutkami |
  | Komenda z brakującymi/niepewnymi slotami | wykonaj | karta-formularz | dialog ze skutkami |
  | Akcja zaproponowana przez AI | wykonaj | karta „Wykonaj / Pomiń” | dialog ze skutkami |

  Jawnie wpisana komenda to już intencja użytkownika — drugie pytanie byłoby zmęczeniem potwierdzeniami.
  Propozycja AI to domysł modelu, więc zawsze przechodzi przez kartę.
- Akcje z AI: max 3 na turę; każda jako osobna karta ze skutkami (`effects`).
- `undo`: stos ostatnich 10 wykonanych komend w sesji; handler deklaruje odwrotność (np. `create-task` →
  usuń utworzony dokument; `add-money` → usuń transakcję z cofnięciem salda). Komendy bez sensownej
  odwrotności (`settle-chores`) mają `risk: 'destructive'` i nie trafiają na stos.
- Offline: komendy, które v1 obsługuje szkicami (aktywność, granie, obowiązek, transakcja) → szkic;
  pozostałe → komunikat „wymaga internetu”. Wiadomości w języku naturalnym offline są zablokowane
  z jasnym komunikatem (bez kolejkowania do AI).
- Wynik wykonania wraca do czatu jako krótki tekst i jest dołączany do kontekstu następnej tury
  (`recentActions`), bo backend nie wie, czy użytkownik potwierdził akcję.

### 6.7 Kontekst LifeXP (snapshot dla AI)

Budowany lokalnie z danych, które i tak są w stores — bez dodatkowych odczytów, tylko dla włączonych modułów.
Encje dostają krótkie refy (`g1`, `t3`, `c2`) zamiast id Firestore: mniej tokenów, a model nie ma czego
„wymyślać” — jeśli ref nie istnieje w mapie, walidacja odrzuca akcję.

```json
{
  "now": "2026-10-03T18:40", "tz": "Europe/Warsaw", "lang": "pl",
  "points": { "total": 1240, "today": 90, "dailyLimit": 150, "level": 3 },
  "money":  { "balance": 312.5, "monthSpent": 140, "monthlyLimit": 200 },
  "goals":  [{ "ref": "g1", "name": "Rower", "type": "money", "saved": 120, "amount": 1500 }],
  "tasks":  [{ "ref": "t1", "text": "Wypracowanie", "due": "2026-10-04", "size": "M" }],
  "chores": { "defs": [{ "ref": "c1", "name": "Zmywarka", "points": 15 }], "unsettledPts": 85 },
  "activityTypes": [{ "ref": "a1", "name": "Nauka", "ptsPerHour": 40 }],
  "categories": ["jedzenie", "gry", "szkoła"],
  "recentActions": [{ "command": "create-task", "status": "executed" }],
  "pendingActions": [{ "ref": "p1", "command": "create-task", "args": { "text": "Mleko", "due": "2026-10-04" } }]
}
```

Budżet: ~1-2 tys. tokenów (limity z v1: max 3 cele, 30 zadań; treści ucinane do 80 znaków).

`pendingActions` (U10, wzorzec Todoist Ramble): niezatwierdzone karty z poprzedniej tury. Wiadomość typu
„zmień termin na piątek” zwraca akcję `edit-pending` z refem karty — klient aktualizuje istniejącą kartę
zamiast dokładać nową.
Każdy moduł dokłada swój fragment przez `FeatureDef.exusContext`.

### 6.8 System prompt

Przechowywany **po stronie backendu** (wersjonowany plik w `functions/src/exus/prompt.ts`) — gdyby leżał
w kliencie, dało się go podmienić i używać Gemini na koszt właściciela do dowolnych celów. Struktura:

1. **Rola**: „Jesteś Ex-us, asystent LifeXP. Odpowiadasz krótko, w języku użytkownika (`lang`).”
2. **Słownik domeny**: punkty LifeXP ≠ pieniądze Money (PLN); dzienny limit punktów; obowiązki mają
   osobny kurs i są rozliczane do Money; cele: max 3, punktowe albo pieniężne; zadania mają termin i rozmiar
   S/M/L (kawałki budowy PC); saldo Money nie może spaść poniżej zera.
3. **Zasady akcji**: proponuj akcję tylko przy wyraźnej prośbie o zmianę danych; używaj wyłącznie refów
   z kontekstu; gdy brakuje danych albo dopasowanie jest niejednoznaczne — dopytaj zamiast zgadywać;
   max 3 akcje; nigdy nie twierdź, że coś zostało wykonane (wykonuje aplikacja po potwierdzeniu).
4. **Kontekst**: blok JSON z 6.7 oznaczony jako **dane, nie instrukcje** (treści notatek i zadań to tekst
   użytkownika — higiena prompt injection).
5. **Format wyjścia**: wymuszony schemat (Gemini `responseSchema` / function calling):
   `{ reply: string, actions: { command: enum, args: object }[] }`. Enum komend i schematy argumentów
   generowane z rejestru (`aiExposed: true`) w czasie builda i dołączane do deploya funkcji.

### 6.9 Backend: `exusTurn`

Funkcja jest **bezstanowa**: nie przechowuje rozmów. Klient wysyła ostatnie tury z własnej historii
(już ją ma lokalnie), więc znika `conversationId` i cała kolekcja rozmów po stronie serwera.

```
exusTurn({ message, history: [{role, text}] (ostatnie ≤ 8 tur, ucięte), context, lang, clientVersion })
  → auth wymagany
  → dostęp: aiTestAccess/{uid} istnieje (ten sam allowlist co dziś)
  → limit: dzienny budżet tokenów usera + globalny bezpiecznik (transakcja na liczniku)
  → system prompt + kontekst + history + message
  → JEDNO wywołanie Gemini z wymuszonym schematem odpowiedzi
  → walidacja odpowiedzi po stronie serwera (enum komend, kształt args)
  → zapis zużycia tokenów
  ← { reply, actions[], usage: { tokensUsedToday, tokensLimitDaily, remainingPercent } }
```

- `usage` w odpowiedzi → pasek limitu bez osobnego `aiAssistantPing`.
- Backend **nie zapisuje** danych LifeXP (koniec duplikacji logiki celów/zadań po stronie funkcji).
- Stare callable (`aiClassifyIntent`, `aiAssistantChat`, `aiConfirmTask`, `aiConfirmGoal`, `aiAssistantPing`)
  **nie są odtwarzane** — wdrożone wersje działają dalej bez kodu źródłowego i obsługują v1 do cutover;
  kasowane w etapie 8. Szczegóły odtworzenia backendu: 6.12.

### 6.10 UI Ex-us

- Route `#/exus` (pełny ekran czatu) + pole „Napisz do Ex-us albo wpisz /” na ekranie „Dziś” + paleta
  Ctrl/Cmd+K. Wszystkie trzy korzystają z tego samego silnika.
- Dymki: użytkownik (tekst), Ex-us (Markdown sanityzowany), karta akcji (tytuł komendy, pola argumentów
  jako edytowalny formularz, „Wykonaj” / „Pomiń”), wynik (tekst + „Cofnij”).
- Pole wpisywania przyklejone do dołu z `100dvh` i `env(safe-area-inset-bottom)`; na iOS reakcja na
  `visualViewport` (klawiatura nie zasłania pola).
- Historia: IndexedDB per uid, czyszczona przy wylogowaniu; „Nowa rozmowa” czyści lokalną historię
  (backend jest bezstanowy, więc nic więcej nie trzeba resetować).

### 6.11 Usunięcie Siri-ous

v2 po prostu go nie zawiera. Przy cutover migracja lokalna usuwa klucze `lifexp-aichat-*`. Moduł `aichat`
w `enabledModules` mapowany na `exus`.

### 6.12 Odtworzenie backendu (Cloud Functions)

Decyzja: kod funkcji jest nieodnaleziony → **odtwarzamy**, ale tylko to, czego potrzebuje v2.

**Dlaczego nie trzeba odtwarzać pięciu starych funkcji.** Wdrożona funkcja żyje w Google Cloud niezależnie
od tego, czy jej kod gdzieś leży. v1 dalej woła `aiClassifyIntent`/`aiAssistantChat`/… i będą one działać aż
do cutover. v2 ich nie używa. Odtwarzamy więc wyłącznie nowe rzeczy:

| Funkcja | Etap | Zakres |
|---|---|---|
| `exusTurn` | 5b | 6.9 — jedno wywołanie Gemini, limit, allowlist |
| `sendParentEmailCode`, `verifyParentEmailCode` | 6 | Kod generowany i sprawdzany na serwerze (koniec B12) |
| (opcjonalnie) wysyłka raportu i push jako funkcje harmonogramowane | 6 | Zamiast GitHub Actions — do decyzji, skrypty w `scripts/` też wystarczą |

**Co wiemy o starych funkcjach (kontrakt odczytany z klienta i reguł):**

| Element | Znany kształt | Źródło |
|---|---|---|
| `aiClassifyIntent` | `{message}` → `{intent: 'task'\|'goal'\|'chat', proposal?, note?}` | `assistants.js:607-622` |
| `aiAssistantChat` | `{message, conversationId?}` → `{reply, conversationId}` | `assistants.js:585-596` |
| `aiAssistantPing` | `()` → `{tokensUsedToday, tokensLimitDaily, remainingPercent}` | `assistants.js:514-528`, `630-636` |
| `aiConfirmTask` | `{title, time, durationMin, type}` → zapis do `plannerTasks` | `assistants.js:678-680` |
| `aiConfirmGoal` | `{name, type, amount}` → zapis do `users.goals` | `assistants.js:726-728` |
| Allowlist | `aiTestAccess/{uid}` — dokument istnieje = dostęp | `firestore.rules:114-117` |
| Ustawienia per user | `users/{uid}.aiSettings` (np. `advancedEnabled`), zapis tylko z serwera | `firestore.rules:39-46` |
| Globalny licznik | `aiUsageGlobal/{date}`, klient bez dostępu | `firestore.rules:121-123` |

**Czego nie wiemy (zginęło razem z kodem):** treść obecnego system promptu, nazwa modelu Gemini,
wartości limitów tokenów, format dokumentów `aiUsageGlobal`, miejsce przechowywania rozmów, nazwa sekretu
z kluczem API. Nowy backend definiuje te rzeczy od nowa i jawnie — nie próbuje zgadywać starego formatu.

**Opcjonalny skrót przed odtwarzaniem (5 minut, bez ryzyka):** Google przechowuje źródła wdrożonych funkcji.
Konsola Google Cloud → projekt `faiobaj4` → Cloud Functions (albo Cloud Run functions) → np.
`aiAssistantChat` → zakładka „Źródło” → „Pobierz ZIP”. Jeśli archiwum jest dostępne, służy wyłącznie jako
materiał referencyjny (prompt, limity, model) — nowy kod i tak powstaje według 6.9.

**Struktura `functions/`:**

```
functions/
├─ package.json            # firebase-functions v2 (onCall), firebase-admin, @google/genai, zod
├─ tsconfig.json
└─ src/
   ├─ index.ts             # eksport: exusTurn (+ później funkcje rodzica)
   ├─ exus/
   │  ├─ turn.ts           # handler: auth → allowlist → limit → Gemini → walidacja → usage
   │  ├─ prompt.ts         # system prompt (wersjonowany, 6.8)
   │  ├─ schema.gen.json   # enum komend + JSON Schema args — GENEROWANE z rejestru v2 przy buildzie
   │  └─ quota.ts          # liczniki w transakcji
   └─ shared/admin.ts
```

**Dane backendu (nowe, bez kolizji ze starymi):**

| Ścieżka | Zawartość | Reguły |
|---|---|---|
| `aiUsage/{uid}_{YYYY-MM-DD}` | `{tokens, calls}` | `read, write: if false` — top-level, bo reguła wildcard w `users/{uid}/{col}` daje ownerowi zapis każdej podkolekcji i user mógłby wyzerować sobie licznik |
| `aiUsageGlobalV2/{YYYY-MM-DD}` | `{tokens, calls}` | `if false` |
| `users/{uid}.aiSettings.exusDailyTokens` | opcjonalny limit per user | pole już chronione regułami |

**Sekrety i konfiguracja:** nowy klucz Gemini z Google AI Studio zapisany jako sekret
(`firebase functions:secrets:set GEMINI_API_KEY`, w kodzie `defineSecret`). Model i limity jako parametry
(`defineInt`/`defineString`), nie w kodzie. Region: taki sam jak lokalizacja bazy Firestore (do odczytania
w konsoli) — klient v2 podaje go jawnie w `getFunctions(app, region)`.

**Bezpieczny deploy — najważniejsza pułapka.** `firebase deploy --only functions` porównuje lokalny kod
z wdrożonymi funkcjami i proponuje **usunięcie** tych, których lokalnie nie ma. Gdyby nowy `functions/`
wdrożyć w tym samym codebase co stare funkcje, deploy zaproponowałby skasowanie pięciu funkcji, na których
stoi Ex-us w v1. Zabezpieczenia:

1. Osobny codebase w `firebase.json` (np. `"codebase": "lifexp-v2"`) — CLI zarządza wtedy tylko funkcjami
   z tego codebase i nie dotyka starych.
2. Deploy wyłącznie celowany: `firebase deploy --only functions:lifexp-v2` (skrypt npm, nigdy ręcznie
   „wszystko”).
3. Stare funkcje usuwane jawnie w etapie 8: `firebase functions:delete aiClassifyIntent …`.

**Testy backendu:** Vitest + emulator Functions/Firestore; Gemini podmieniony fałszywym klientem
(stała odpowiedź zgodna ze schematem). Testy: brak auth → błąd, brak na allowliście → błąd, przekroczony
limit → błąd z czytelnym komunikatem, niepoprawna odpowiedź modelu (zła komenda/args) → odfiltrowana akcja
zamiast awarii, licznik rośnie o zużycie z odpowiedzi modelu.

---

## 7. Architektura UI

### 7.1 Zasady

> **Zmiana 2026-09-29 (D9, D10):** właściciel wybrał styl referencyjny — jasne tło, białe karty z miękkim
> cieniem, niebieski akcent z ikony LifeXP, ikony **z podpisem**, dolny pasek z „+”. Ikony są dozwolone
> obok tekstu (`lucide-preact`); pierwsza reguła poniżej obowiązuje w części „nigdy sama ikona”.

- **Bez ikon jako nośnika znaczenia.** Nawigacja i akcje to tekst. Znaczenie niesie hierarchia
  typograficzna, położenie i kolor semantyczny. Jedyne znaki graficzne: kształt przycisku Menu (dwie kreski
  rysowane CSS), zamknięcie (×), chevron w listach (›), znacznik wykonania (✓) — jako znaki/CSS, nie font ikon.
- **Dane użytkownika zostają**: pola `icon` (np. `ti-book`) w `activityDefs` i `notes` nie są kasowane.
  Notatki (decyzja właściciela 2026-09-30, D11): v2 pokazuje i pozwala wybrać ikonę; zapisuje tę samą klasę
  Tabler co v1, a rysuje jej odpowiednik z `lucide-preact`. Ikony `activityDefs` — do decyzji przy etapie 3e.
  Emoji obowiązków (dane usera) mogą zostać wyświetlane jako treść.
- Nowoczesny, nie „formularzowy”: duże liczby jako bohaterowie ekranu, dużo powietrza, karty z jedną
  intencją, ruch 150-250 ms, subtelne tła i cienie.

### 7.2 Design tokens

| Grupa | Wartości |
|---|---|
| Typografia | Jeden variable font self-hosted (Inter albo Manrope, subset latin-ext). Skala 1.25: 12 / 14 / 16 / 20 / 24 / 32 / 40. Wagi 400/500/600/700. `tabular-nums` dla wszystkich kwot i punktów. Overline: 12 px, uppercase, `letter-spacing .06em` |
| Spacing | Siatka 4 px: 4, 8, 12, 16, 20, 24, 32, 40, 56 |
| Kolor | Skala neutralna (10 stopni), jeden akcent jako rampa, semantyczne: `positive`, `negative`, `warning`. Motywy: LifeXP ciemny (domyślny) i jasny, iOS (jasny/ciemny jak system), Gold — 4.9 |
| Kształt | Promienie 8 / 12 / 16 / 999 |
| Elewacja | 0 (płaskie karty z 1 px obramowaniem), 1 (sheet, drawer), 2 (dialog). Rozmycie tła (`backdrop-filter`) wyłącznie w top barze — jedna warstwa nawigacji nad treścią, jak zaleca Apple HIG; nigdy na kartach (v1: spadki FPS) (U5) |
| Z-index | `topbar 100 < drawer 200 < sheet 300 < dialog 400 < toast 500` — jedyne dozwolone warstwy |
| Ruch | 150 / 200 / 250 ms, `cubic-bezier(.2,.8,.2,1)`, `prefers-reduced-motion` → 0 |

### 7.3 App shell i breakpointy

| Klasa szerokości | Zakres | Nawigacja | Treść |
|---|---|---|---|
| compact | < 600 px | Drawer wysuwany z lewej + top bar | 1 kolumna, marginesy 16 px |
| medium | 600-839 px | Drawer (jak compact) | 1-2 kolumny kart, max 720 px |
| expanded | ≥ 840 px | Stały sidebar 264 px (zwijany do wąskiego paska z inicjałami sekcji) | 2-3 kolumny, max 1100 px |

Progi 600/840 to klasy szerokości Material 3 (U4). Dolny pasek mieści 3-5 celów, LifeXP ma ich 8+ (v1 miał
8 pozycji w dolnym pasku, co łamało tę regułę). Dlatego od D10 (2026-09-29) pasek < 840 px ma tylko pięć
pozycji: Dziś, Obowiązki, „+”, Pieniądze i „Menu”, które otwiera drawer z pełną listą. Pasek jest
przyklejony do dołu karty treści (sticky), więc przesuwa się razem z nią przy otwieraniu drawera.

Shell to CSS grid: `grid-template-columns: [nav] auto [main] 1fr`. Tylko shell zna `position: fixed`
i safe-area; strony nigdy (koniec FAB-ów i łatek `padding-bottom`).

### 7.4 Sidebar mobilny — specyfikacja zachowania (jak ChatGPT)

> Od D10 przycisk „Menu” jest w dolnym pasku, nie w top barze; top bar ma tytuł wyrównany do lewej.
> Zachowanie drawera poniżej bez zmian.

**Top bar** (56 px + `safe-area-inset-top`): po lewej przycisk z napisem **„Menu”** (U1; min. 44×44 — tekst
zamiast ikony hamburgera, bo goła ikona jest słabiej odkrywalna wg NN/g, a UI i tak jest bez ikon), na środku
tytuł ekranu, po prawej jedna akcja kontekstowa tekstem („Dodaj”, „Nowa”, „Rozlicz”). Top bar przyklejony,
półprzezroczysty z rozmyciem tła, przy scrollu w dół lekko się kompaktuje.

**Kompensata ukrytej nawigacji** (NN/g: ukryte menu obniża odkrywalność mniej więcej o połowę): ekran Dziś
zawiera bezpośrednie wejścia do modułów (7.6), pole Ex-us/komend daje dostęp do wszystkiego z każdego ekranu,
a metadane w drawerze („2 po terminie”) dają powód, żeby go otwierać. Plan awaryjny, gdyby testy
z użytkownikiem wykazały problem: hybryda jak w Monarch (3-4 najczęstsze moduły w dolnym pasku + drawer).

**Otwieranie:**
- tap w Menu;
- przeciągnięcie od lewej krawędzi (strefa 0-24 px) — tylko w trybie standalone PWA; w Safari w przeglądarce
  lewa krawędź należy do systemowego „wstecz”, więc tam gest jest wyłączony;
- karta treści podąża za palcem 1:1 (`pointermove`, bez animacji w trakcie); po puszczeniu decyduje pęd:
  krótkie, szybkie machnięcie otwiera/zamyka, wolne przeciągnięcie osiada po stronie progu 50%; przerwany gest
  (`pointercancel`) wraca do najbliższego stanu (U3).

**Wygląd w ruchu (model ChatGPT, U2):** to **karta treści** jest obiektem, który się przesuwa — odjeżdża
w prawo o ok. 82% szerokości ekranu (bez skalowania), dostaje zaokrągloną lewą krawędź (28 px) i cień.
Menu leży pod spodem: startuje z `translateX(-10%)` i krycia 0,55 i dojeżdża do pozycji docelowej, więc
wygląda, jakby „było tam cały czas”. Brak przyciemniającego scrimu na całym ekranie — odsłonięty pasek
karty sam jest celem zamknięcia. Czas ~300-450 ms z miękkim wygaszeniem; `prefers-reduced-motion` →
natychmiastowe przełączenie. Animowane tylko `transform`, `opacity`, `border-radius` (kompozytor GPU).

**Zamykanie:** tap w odsłoniętą kartę, przeciągnięcie karty w lewo, wybór pozycji, `Esc`, systemowe „wstecz”
(otwarcie dokłada wpis historii).

**Dostępność:** otwarty drawer = `role="dialog" aria-modal="true"`, treść pod spodem `inert`, fokus na pierwszej
pozycji, po zamknięciu powrót fokusu na Menu, `aria-expanded` na przycisku. Blokada scrolla treści
(`overflow: hidden` na `html`) + `overscroll-behavior: contain` w drawerze.

**Zawartość drawera:**

```
LifeXP                                   ← wordmark
Szymon · Poziom 3                        ← konto (tekst, drobny)

[ Zapytaj Ex-us ]                        ← główna akcja, wyróżniony przycisk

Dziś                                     ← aktywna pozycja: tło-pigułka + waga 600
Zadania                       2 po terminie
Cele                                1 / 3
Obowiązki                   12,40 zł do wypłaty
Pieniądze                        312,50 zł
Notatki
Statystyki
Gry

Zgłoszenia i aktualizacje
Ustawienia
──────────────────────────
Wyloguj
```

Metadane po prawej (tekst, `text-secondary`, `tabular-nums`) zastępują ikony i badge — nawigacja staje się
jednocześnie mini-dashboardem. Pozycje generowane z rejestru modułów (wyłączony moduł = brak pozycji).

### 7.5 Komponenty (`ui/components`)

`AppShell`, `Drawer`, `TopBar`, `Page` (nagłówek + treść), `Section`, `Card`, `Metric` (duża liczba + etykieta +
opcjonalny trend), `ListRow` (tekst główny / meta / wartość po prawej), `Button` (primary / secondary / quiet /
danger), `TextField`, `NumberField` i `MoneyField` (polski przecinek, grosze), `DateField`, `Select` (natywny),
`SegmentedControl`, `FilterChip`, `ProgressBar` (4-6 px), `Sheet` (bottom sheet < 600 px, dialog ≥ 600 px —
jeden komponent), `ConfirmDialog`, `Toast` (kolejka, `aria-live`, wielowierszowy), `EmptyState` (tekst + jedna
akcja), `Skeleton`, `Markdown` (lazy, sanityzowany), `CommandInput` (z paletą `/`).

Reguły komponentów z benchmarku:
- `Sheet` (U12): zawsze tekstowy przycisk „Zamknij” w nagłówku (uchwyt tylko jako dodatek), jeden arkusz
  na akcję — nigdy arkusz otwierany z arkusza; przy fokusie pola z klawiaturą arkusz rośnie do pełnej
  wysokości (`visualViewport`); zamknięcie gestem z pędem, wolne przeciągnięcie wraca.
- `MoneyField` (U13): `inputmode="decimal"` (klawiatura z przecinkiem, bez spinnerów `type="number"`),
  kwota prezentowana dużą cyfrą, pod polem podgląd skutku („Saldo po operacji: 262,50 zł”).

### 7.6 Wzorce ekranów

- **Dziś** (U6, tryb skupienia jak Today w Things 3): kolejność według listy priorytetów z `RESEARCH.md` §3 —
  zadania na dziś i zaległe (odhaczanie w miejscu) → pole Ex-us/komend → stan dnia (punkty dziś / limit,
  seria z informacją, czy dzisiejszy dzień już się liczy) → szybkie akcje (obowiązek, aktywność, transakcja)
  → cele (ile brakuje) → saldo i do wypłaty → wejścia do pozostałych modułów. Poziom, osiągnięcia, TOP,
  ciekawostki i wykresy → ekran Statystyki (przestroga Habitica: grywalizacja nie może zagracać głównego
  przepływu).
- **Pieniądze** (U14, wzorce Copilot i Revolut Vaults): saldo jako bohater z podziałem „Dostępne / W celach”;
  „Ten miesiąc vs poprzedni do tego samego dnia” (wydatki i wpływy); alert limitu tekstem; transakcje
  grupowane po dniach; pożyczki jako podsekcja `#/money/loans`.
- **Seria** (U15, Duolingo i Finch): jasna reguła dnia („dzień liczy się, gdy zdobędziesz co najmniej 1 pkt”);
  po przerwanej serii komunikat zachęcający do powrotu, bez tonu straty; użyte zamrożenie opisane wprost.
- **Obowiązki**: do wypłaty + „Rozlicz”; kalendarz miesiąca (siatka liczb, dni z wpisami podświetlone
  akcentem); lista wpisów dnia; dodawanie przez Sheet z listą definicji.
- **Formularze**: zawsze w `Sheet`, jedna kolumna, primary na dole w strefie kciuka, walidacja inline.

### 7.7 Odporność layoutu (reguły egzekwowane automatycznie)

| Reguła | Egzekwowanie |
|---|---|
| Zero inline `style` (wyjątek: zmienne CSS dla wartości dynamicznych, np. `--progress`) | ESLint |
| Zero stałych wysokości treści; `100dvh` tylko w shellu | Stylelint (zakaz `100vh`) |
| Dzieci flex/grid z tekstem mają `min-width: 0` (w `base.css` dla prymitywów layoutu) | Test przepełnień |
| Tekst użytkownika: `overflow-wrap: anywhere`, obcinanie tylko przez utility `clamp-1/2/3` | Review + test długich stringów |
| `position: fixed` tylko w shellu i warstwach (drawer, sheet, dialog, toast) | Lint (zakaz w `features/`) |
| Pola formularzy ≥ 16 px → brak auto-zoomu iOS → zoom użytkownika z powrotem włączony | Stylelint |
| Cele dotyku ≥ 44×44 px | Test e2e |
| Brak poziomego scrolla na każdym route | Test e2e: `scrollWidth ≤ innerWidth` dla 360/390/768/839/840/1280 px |

---

## 8. Strategia testowania

### 8.1 Piramida

| Poziom | Narzędzie | Co | Kiedy |
|---|---|---|---|
| Domena | Vitest | Wszystkie czyste funkcje: punkty/cap, poziom, streak+freeze, osiągnięcia, obowiązki (dziś/wczoraj, rozliczenie), Money (saldo ≥ 0, koszt w pkt, pożyczki), cele (wpłata/zwrot/zmiana typu), budowa PC, daty, kwoty | Każdy commit |
| Parser / komendy | Vitest | Tabele wejście → `ParsedCommand`; rozpoznawacze; rozmyte dopasowanie encji; pipeline z fałszywymi serwisami | Każdy commit |
| Konwertery / repozytoria | Vitest + Firestore Emulator | Legacy kształty (5.3), round-trip, transakcje, reguły bezpieczeństwa | Każdy PR |
| E2E | Playwright + Emulator (Auth + Firestore) | Krytyczne ścieżki każdego modułu na profilach iPhone 13 i Pixel 7 + desktop; budżety tapnięć z `RESEARCH.md` §2 jako asercje | Każdy PR |
| Wizualne | Playwright screenshots | Każdy route × 360/390/768/1280 × dark/light × drawer otwarty/zamknięty | Każdy PR (diff do akceptacji) |
| Layout | Playwright | Brak poziomego overflow, cele dotyku, fokus w drawerze | Każdy PR |
| Parytet v1↔v2 | Playwright + Emulator | 8.3 | Przed oznaczeniem modułu jako gotowy |

### 8.2 Testy charakteryzacyjne (golden) przed przepisaniem

Zanim powstanie domena v2, dla każdej reguły z 2.4 powstaje tabela przypadków opisująca **obecne** zachowanie
(wraz z dziwactwami: clamp do zera przy cofaniu, nadmiar kawałków PC przepada, rozliczenie po bieżącym kursie).
Domena v2 musi przejść te tabele. Świadoma zmiana zachowania = zmiana tabeli w osobnym commicie z uzasadnieniem.

### 8.3 Testy parytetu v1 ↔ v2 (najważniejsze dla bezpieczeństwa danych)

Mechanizm:

1. Minimalna zmiana w v1: parametr `?emulator=1` w `firebase-config.js`/`core.js` podłącza Auth i Firestore
   do emulatora (tylko w testach; produkcja bez zmian).
2. Scenariusz (np. „zaloguj 60 min nauki, dodaj obowiązek wczoraj, rozlicz, wpłać 20 zł na cel”) wykonany
   w v1 na czystym emulatorze → eksport stanu.
3. Ten sam scenariusz w v2 na czystym emulatorze → eksport stanu.
4. Diff po normalizacji (bez id dokumentów i znaczników czasu). Musi być pusty albo zawierać wyłącznie
   udokumentowane, addytywne pola v2.
5. Kontrakt odwrotny: po zapisach v2 otwarcie v1 na tym samym emulatorze nie daje błędów w konsoli,
   a liczby na dashboardzie v1 zgadzają się z v2.

W CI (GitHub Actions) `gstatic.com` jest osiągalny, więc v1 w testach działa z prawdziwym SDK.

### 8.4 Dane produkcyjne

- Inwentaryzacja kształtów (5.3): zrobiona na produkcji read-only (`INVENTORY.md`); powtarzana workflowem
  „Data inventory” przed etapem 2 i przed cutover.
- Dry-run każdej migracji na tej kopii + diff.
- Narzędzie „Sprawdź spójność” (5.5) uruchamiane na koncie produkcyjnym po każdym etapie z zapisami.

### 8.5 Ręczna checklista na telefonie (po każdym etapie)

Instalacja PWA, logowanie, drawer (tap, gest, back), każdy formularz z klawiaturą ekranową, tryb samolotowy
(start offline, szkic, zatwierdzenie online), obrót ekranu, duża czcionka systemowa, motyw jasny/ciemny.

---

## 9. Kolejność implementacji

Każdy etap kończy się działającą aplikacją (v1 nietknięte, v2 pod `/v2/`) i ma Definition of Done.
Rozmiar: S ≈ 1-2 PR, M ≈ 3-5 PR, L ≈ 6+ PR.

| Etap | Zakres | Definition of Done | Rozmiar |
|---|---|---|---|
| **0. Siatka bezpieczeństwa** | Przywrócenie `.github/workflows` (test + decyzja o notify/weekly), szkielet `functions/` jako osobny codebase (TS, emulator, bez wdrażania) + opcjonalne pobranie starych źródeł z konsoli jako referencji, eksport/backup Firestore, konfiguracja emulatorów, skrypt inwentaryzacji kształtów, tabele golden (8.2), przełącznik `?emulator=1` w v1 | CI zielone na v1 (poza znanymi FPS), backup istnieje, raport inwentaryzacji w `docs/v2/` | M |
| **1. Fundament** | Scaffold Vite+TS+Preact w `v2/`, deploy Actions na Pages (`/` = v1, `/v2/` = v2), tokens + base CSS, AppShell z sidebarem i drawerem, router, i18n (port słownika), Toast/Dialog/Sheet, logowanie/rejestracja/Google/weryfikacja/wylogowanie, bramy boot, SW v2 (scope `/v2/`), `CLAUDE.md` | Logowanie prawdziwym kontem na telefonie; drawer spełnia 7.4; testy layoutu zielone; Lighthouse PWA/perf ≥ 90 na mobile | L |
| **2. Dane + domena (read-only)** | Konwertery wszystkich kolekcji, repozytoria, stores, domena z golden testami, ekran „Dziś” tylko do odczytu, Statystyki/Historia read-only | Liczby na „Dziś” v2 = v1 na prawdziwym koncie; zero zapisów z v2 | M |
| **3a. Zadania + Notatki** | CRUD, budowa PC, kary, Markdown, archiwum, usuwanie zadań | Parytet 8.3; e2e na telefonie | M |
| **3b. Obowiązki** | Definicje, wpisy, dziś/wczoraj, kalendarz, rozliczenie w jednym batchu → Money | Parytet; test „rozliczenie przerwane w połowie” nie zostawia niespójności | M |
| **3c. Money** | Transakcje, kategorie, pożyczki, limit, archiwum, M2 | Parytet; saldo zgodne po serii operacji z dwóch kart | M |
| **3d. Cele** | Cele punktowe/pieniężne, wpłaty, zwroty, osobny ekran `#/goals` | Parytet | S |
| **3e. XP / aktywności** | Log aktywności/grania, cap, historia z paginacją kursorem, statystyki, generator, osiągnięcia, streak (freeze zapisywany w serwisie, nie w renderze) | Parytet; historia ładuje się w stałym czasie niezależnie od liczby wpisów | M |
| **3f. Offline** | Kolejka szkiców kompatybilna z v1, przegląd, zatwierdzanie przez serwisy | Szkice utworzone w v1 zatwierdzane w v2 | S |
| **4. Ustawienia + Zgłoszenia** | Wszystkie sekcje ustawień, M3 (moduły), tryb konta, email rodzica (na razie jak v1), zgłoszenia + admin + broadcasty + historia aktualizacji, „Sprawdź spójność” | Parytet; Notatnik widoczny dla kont sprzed 24.08 | L |
| **5a. Ex-us lokalnie** | Parser, rejestr, pipeline, karty, undo, paleta `/`, `/help`, `/today`, wszystkie komendy z 6.5 | Każda komenda ma testy tabelaryczne; zero wywołań backendu dla `/...` | L |
| **5b. Ex-us AI** | `exusTurn` od zera (6.9, 6.12): bezstanowy, 1 wywołanie Gemini ze schematem, limity, allowlist, sekret; generowanie schematu komend z rejestru; celowany deploy osobnego codebase | Pomiar: dokładnie 1 wywołanie na wiadomość; akcje z AI przechodzą ten sam pipeline; stare funkcje nadal wdrożone i v1 działa | M |
| **6. Rodzic, raport, push** | Route `#/parent` na wspólnej domenie, poprawiony skrypt raportu (cele z profilu, kursy z profilu, transakcje), weryfikacja emaila rodzica w Cloud Function, przygotowanie push w SW v2 | Raport testowy wysłany na własny adres z poprawnymi liczbami | M |
| **7. Cutover** | v2 w katalogu głównym, `sw.js` = SW v2 (przejmuje zainstalowane PWA, czyści `lifexp-shell-v*`), `app.html`/`verify.html`/`parent.html` jako przekierowania na route'y, v1 pod `/v1/`, push w v2, M4 (lokalne klucze dni), sprzątanie localStorage Siri-ous, gry jako lazy moduł | Zainstalowana PWA na telefonie sama przechodzi na v2; link z powiadomienia i powrót z FPS działają | M |
| **8. Sprzątanie** | Usunięcie v1 po okresie próbnym, upgrade Firebase SDK, reguły Firestore (walidacja pól, notatki bez dostępu rodzica — do decyzji) + testy reguł, usunięcie starych callable, decyzje o `plannerTasks`/`purchases`/`moneyGoals`, opcjonalnie M6 | Repo bez v1; testy reguł zielone | M |

Kolejność 3a → 3e jest celowa: od modułów izolowanych do tych, które piszą do punktów i salda. Moduł, który
nie przeszedł parytetu, nie blokuje kolejnych — ale nie wchodzi do cutover.

### 9.1 Stan realizacji

**Przeniesienie repo (2026-10-28):** repo przeniesiono na `caqyx/lifexp-app`; aplikacja działa pod `https://caqyx.github.io/lifexp-app/` (stary adres Pages już jej nie serwuje). Linki w powiadomieniach push, testach i dokumentacji zaktualizowane; źródła gier (Wartime, gridlock) bez zmian.

**Etap 0 (2026-09-27)** — zrobione w repo:

| Element | Wynik |
|---|---|
| Testy deterministyczne | 5 porażek starego CI (Ex-us ×4, menu FPS) wynikało z zależności od sieci; fixture `tests/support/hermetic.js` blokuje ruch zewnętrzny. Test FPS naprawiony po dodaniu ekranu ładowania. `fps-gameplay` w osobnym projekcie z 1 workerem. Lokalnie 50/50 |
| CI | `.github/workflows/test.yml` przywrócony: jobs „App”, „FPS gameplay” (osobno: renderowanie WebGL w software, limit 120 s na test), „Cloud Functions build”, „v1 against Firebase emulators” |
| Emulatory | `firebase.emulators.json` (projekt `demo-lifexp`, osobno od `firebase.json`), `npm run test:emulator` |
| Przełącznik `?emulator=1` w v1 | Tylko localhost; `typeof`-guard na stary config z cache SW; cache SW podbity do v55 |
| Prawdziwe v1 w testach | CDN (Firebase 10.12.0, i18next, EmailJS) serwowane z `node_modules` — koniec zależności od kopii kodu w harnessach (B19) |
| Charakteryzacja | `tests/emulator/v1-characterization.spec.js` — 4 przypadki e2e; pełne tabele w `GOLDEN.md` |
| `functions/` | Pusty codebase `lifexp-v2` (TS, kompiluje się, emulator go wczytuje); deploy tylko `functions:lifexp-v2` |
| Inwentaryzacja | `scripts/inventory.js` + workflow „Data inventory” (tylko schemat; test na emulatorze sprawdza brak wycieku wartości). Uruchomiona na produkcji 2026-09-27 → `INVENTORY.md`, wnioski w 5.3. Błędy klucza są opisywane bez cytowania sekretu |
| Sekret `FIREBASE_SERVICE_ACCOUNT` | Nieważny od 25.07; odnowiony 2026-09-27 |
| Backup | Instrukcja w `BACKUP.md` |

**Do zrobienia przez właściciela** (wymaga dostępu do Google Cloud / ustawień GitHub):
1. ~~Scalić zmiany do `main`~~ (PR #12).
2. ~~Backup wg `BACKUP.md`~~ (2026-09-29: PITR, codzienny backup, eksport `2026-09-29-0850/`).
3. ~~Uruchomić „Data inventory”~~ (2026-09-27, `INVENTORY.md`).
4. ~~Usunąć stary klucz konta serwisowego~~ (2026-09-29; „Data inventory” zielone po usunięciu).
5. ~~Sprawdzić `aiTestAccces`~~ (duplikat `aiTestAccess`, usunięta 2026-09-29).
6. ~~Decyzje D3 i D4~~ (2026-09-29). Etap 0 zamknięty; etap 1 startuje po akceptacji właściciela.

**Etap 1 (start 2026-09-29, zaakceptowany przez właściciela)** — podział na PR-y:

| PR | Zakres | Stan |
|---|---|---|
| 1a | Szkielet `v2/` (Vite 8, TypeScript 5.9 strict, Preact), lint architektury z testami (warstwy 4.2, zakazy 7.7), `scripts/build-site.js` (v1 bez zmian + v2 pod `/v2/`, kontrola plików v1), workflow „Deploy”, job CI „v2 checks and site build”, `CLAUDE.md` | scalone (#14) |
| 1b | Tokeny i motywy (LifeXP ciemny/jasny, iOS, Gold; migracja `lifexp-theme` z v1; skrypt przed pierwszym renderem), `base.css`, AppShell z sidebarem i drawerem (7.4), hash router, rejestr modułów z ekranami „W budowie”, i18n (typowane klucze pl/en), testy przeglądarkowe powłoki | scalone (#15); płynniejsze otwieranie drawera po teście na telefonie (#16) |
| 1c | Komponenty `ui/`: Page, Section, Card, Stack, Metric, List/ListRow, ProgressBar, EmptyState, Skeleton, Button, pola (tekst, liczba, kwota w groszach, data, select), SegmentedControl, FilterChip; `lib/money` (grosze); moduły ładowane leniwie; galeria `#/ui` z przełącznikiem motywu | scalone (#17) |
| 1d | Warstwy na natywnym `<dialog>`: Sheet (bottom sheet < 600 px / dialog ≥ 600 px, przeciąganie w dół, nad klawiaturą), ConfirmDialog, Toast (kolejka, akcja „Cofnij”, dwa regiony live); wspólne: „wstecz” zamyka, animacja wyjścia, blokada przewijania | scalone (#18) |
| 1e | Firebase 10.12.0 z npm (ta sama sesja co v1), logowanie e-mailem i Google, wylogowanie, bramy startu w kolejności v1, język z profilu; rejestracja, weryfikacja e-maila i pierwsza konfiguracja odsyłają do v1 (niżej); testy przeglądarkowe v2 na emulatorach z logowaniem | scalone (#19) |
| 1g | Styl referencyjny właściciela (D9, D10): jasny motyw LifeXP pod referencję (białe karty z cieniem, akcent z ikony LifeXP, kontrast ≥ 4.5:1), ikony z podpisem (`lucide-preact`), dolny pasek z „+” i „Menu”, `IconTile`, arkusz „Dodaj” (do etapu 3 odsyła do v1) | scalone (#20) |
| 2a | Ekran „Dziś” tylko do odczytu: punkty (≈ zł), poziom (G2), seria z tygodniem Pn–Nd i zamrożeniem (G3, liczone bez zapisu), punkty dziś względem limitu i granie (G1), saldo, skróty wg `enabledModules`, ostatnie 5 aktywności; `lib/dates` (dzień UTC i lokalny), konwertery i repozytoria `dailyLog`/`activities`/`activityDefs`/`money/balance`; e2e: te same liczby co dashboard v1 i zero zapisów | scalone (#21) |
| 1f | Service Worker v2 (`vite-plugin-pwa` + Workbox: precache całego buildu, nawigacje network-first 3 s, scope `/v2/`), manifest „LifeXP v2” z ikonami, meta iOS; v1 `sw.js` nie kasuje cache v2; Auth bez gapi przy starcie; akcent LifeXP ciemny rozdzielony na wypełnienie i tekst (4.5:1). Lighthouse (telefon, gzip jak Pages): wydajność 95, dostępność 100, dobre praktyki 100 | scalone (#23) |
| 2b | Obowiązki na „Dziś” (tylko odczyt): definicje v1 w kolejności `order` ze znacznikiem i liczbą wpisów z dnia lokalnego (G8, G13), wpisy dzisiejsze bez definicji (jednorazowe) zostają na liście, „Do wypłaty” = wszystkie nierozliczone wpisy × bieżący kurs obowiązków (G8.5–G8.7); e2e: te same kwoty co v1, zero zapisów | scalone (#24) |
| 2c | Statystyki `#/stats` i historia `#/stats/history` (tylko odczyt, G14): sumy z profilu, punkty i granie z 7 dni jako dwa osobne wykresy słupkowe (`ui/BarChart`: jedna oś od zera, etykiety tylko na najwyższym i dzisiejszym słupku, tooltip na najechanie/fokus/dotyk, wartości w tekście dla czytników), TOP 5 z ostatnich 50 wpisów, ciekawostki jak w v1; historia stronami po 15 z kursorem i licznikiem `count()`; ekran modułu dostaje ścieżkę z routera; e2e: te same liczby co v1, zero zapisów | scalone (#25) |
| 3a-1 | Notatki `#/notes`, `#/notes/:id` (pierwsze zapisy, G15): lista aktywne/archiwum z kolorem jako znakiem notatki, edytor (tytuł, kolor, Markdown z paskiem formatowania, Edytuj/Podgląd), archiwizacja z „Cofnij”, usuwanie z potwierdzeniem; dokumenty w kształcie v1 (ikona v1 zostaje nietknięta); `ui/Markdown` (marked + DOMPurify z npm, ładowane leniwie, jedyne miejsce z HTML); zapis nie czeka na serwer (offline kolejkuje Firestore); „+” → Notatka; e2e: parytet 8.3 (v1 i v2 zapisują ten sam dokument, v1 pokazuje notatkę z v2), sanityzacja XSS | scalone (#26) |
| 3a-1b | Ikony notatek (D11): wybór jednej z 12 ikon v1 w edytorze, ikona na kafelku w kolorze notatki na liście i w nagłówku; zapis `icon` przy edycji jak w v1; e2e: parytet v1↔v2 z ikoną | scalone (#27) |
| 1h | Płynny ruch (prośba właściciela 2026-09-30): wjazd każdego ekranu (Web Animations, bez przeładowania widoku), przesuwany wskaźnik w przełącznikach segmentowych i `ViewSwitch`, toast znika animacją, karty z danymi pojawiają się miękko, słupki i paski postępu rosną od zera, reakcja wierszy, drawera i dolnego paska na dotyk (bez skoku grubości tekstu); tokeny `--duration-enter/exit`, `--ease-out/in`; tylko `transform`/`opacity`; „ogranicz ruch” = 0 ms; e2e `motion.spec.js` | scalone (#27) |
| 3a-2 | Zadania `#/tasks` i budowa PC (G9): grupy „Po terminie” / „Do zrobienia” / „Zrobione”, arkusz dodawania i edycji (reguły v1: tekst, termin nie w przeszłości, rozmiar S/M/L, limit 30 łącznie ze zrobionymi), odhaczenie w transakcji (zadanie + `pcBuild`, kawałki tylko w terminie), kary za zaległe przy wejściu na ekran w transakcji odpornej na dwie karty, usuwanie z „Cofnij” (D8), karta budowy PC; `pcBuild` w profilu; „+” → Zadanie otwiera formularz; e2e: parytet 8.3 (pierwsze zadanie i kara dają ten sam stan w v1 i v2), v1 pokazuje zadanie z v2 | scalone (#28) |
| 3b-1 | Obowiązki `#/chores`: bieżący/poprzedni miesiąc z zarobkiem po bieżącym kursie, kalendarz (pn–nd, dni z wpisami i punktami, dziś), wpisy wybranego dnia z usuwaniem i „Cofnij”, „Do wypłaty” ze wszystkich miesięcy; dodawanie z arkusza z listą definicji i pytaniem „Dzisiaj / Wczoraj” w tym samym arkuszu (G8.2, G8.3), jednorazowe znikają w tym samym batchu (G8.4); „+” → Obowiązek; e2e: parytet 8.3 i v1 pokazuje wpis z v2. Rozliczenie w 3b-2 | scalone (#30) |
| 3b-2 | Rozliczenie „Do wypłaty” → Pieniądze w jednej transakcji (payout, skasowanie wpisów, saldo, transakcja przychodu z kategorią z i18n, `moneyIncomeAllTime`; wpisy czytane w transakcji, więc nic nie zostanie wypłacone dwa razy), potwierdzenie z kwotą, historia wypłat (najnowsze pierwsze, okres wpisów); e2e: parytet G8.5 (v1 i v2 dają ten sam stan), rozliczenie przerwane offline nie zmienia niczego i przechodzi po powrocie sieci, historia | scalone (#31) |
| 3b-3 | Lista obowiązków `#/chores/defs` (drugi widok modułu obok „Przeglądu”): definicje w kolejności v1, nowa w arkuszu (nazwa, opis, punkty, jedno z 12 emoji v1 albo brak, powtarzalny/jednorazowy; reguły v1), usuwanie z „Cofnij”; seed 8 definicji v1 dla konta bez żadnej (tylko po potwierdzeniu z serwera); e2e: parytet dodania i seeda z v1, v1 pokazuje definicję z v2, „Cofnij” przywraca ten sam dokument | scalone (#32) |
| 3c-1 | Pieniądze `#/money`: saldo z „W celach”, ten miesiąc wobec poprzedniego do tego samego dnia (wydatki i wpływy), alert limitu, transakcje po dniach (ostatnie 30 dni albo miesiąc z archiwum), dodawanie w arkuszu (wydatek/wpływ, kwota z saldem po operacji i kosztem w punktach, kategoria albo nowa, data UTC jak v1, notatka) i usuwanie z potwierdzeniem — każde jako jedna transakcja Firestore (saldo ≥ 0 sprawdzane na serwerze, punkty, `moneyIncomeAllTime`); przygotowanie konta jak `loadMoney()` (dokumenty, 5 kategorii, M2); „+” → Wydatek; e2e: parytet G5.1/G5.6 z v1, dwie karty naraz, v1 pokazuje transakcję z v2. Pożyczki w 3c-2, kategorie i limit w 3c-3 | scalone (#34) |
| 3c-2 | Pożyczki `#/money/loans` (drugi widok Pieniędzy obok „Przeglądu”): do odzyskania / do oddania, pożyczki z postępem spłaty, nowa w arkuszu (pożyczam komuś / od kogoś, osoba, kwota z saldem po operacji, data UTC jak v1, notatka), spłata w arkuszu (ograniczona do tego, co zostało, z podpowiedzią), usuwanie z potwierdzeniem — każde jako jedna transakcja Firestore z saldem (G6); e2e: parytet G6.1 i G6.3 z v1, blokady G6.4 i G6.6, v1 pokazuje pożyczkę z v2 | scalone (#35) |
| 3c-3 | Ustawienia Pieniędzy `#/money/settings` (trzeci widok obok „Przeglądu” i „Pożyczek”): miesięczny limit wydatków (puste = 200 zł, 0 = bez limitu, jak v1) i kategorie transakcji (dodawanie z kontrolą duplikatu i kolorem z kolejki v1, usuwanie z „Cofnij”); e2e: parytet z formularzem Ustawień v1, alert limitu znika po ustawieniu 0 | scalone (#36) |
| 3c-p | Poprawki po teście etapu 3c (właściciel 2026-10-01): przejście między widokami jednego modułu (Obowiązki, Pieniądze, Statystyki) przesuwa wskaźnik i treść zamiast wjazdu całego ekranu (`FeatureDef.views`, `ViewPanel`); „Do wypłaty” jako kwota i punkty w osobnych liniach (Obowiązki, Dziś); usuwanie powtórzonych kategorii Pieniędzy jednym zapisem z „Cofnij”, seed kategorii v2 pod stałymi id; otwarta karta proponuje odświeżenie, gdy wdrożono nowszy build | scalone (#37) |
| 3d-1 | Cele `#/goals` (G7): do 3 celów pieniężnych albo punktowych z postępem i „Brakuje”, nowy w arkuszu (rodzaj, nazwa, cena albo punkty), edycja nazwy i kwoty (rodzaj jak w v1 bez zmian), wpłata z salda Pieniędzy, usuwanie ze zwrotem odłożonych pieniędzy, osiągnięty cel oznaczany raz przez serwis; każda zmiana w transakcji na `users.goals` (i saldzie); „W celach” w Pieniądzach liczone z celów; e2e: parytet G7.1–G7.3 z v1, v1 pokazuje cel z v2 | scalone (#38) |
| 3d-2 | Cele na „Dziś” (PLAN 7.6): karta z każdym celem, paskiem postępu i „Brakuje”, link do `#/goals`, a bez celów zaproszenie „Ustaw cel”; osiągnięty cel oznaczany także z „Dziś” (jak dashboard v1); pusta karta obowiązków prowadzi do „Listy obowiązków” zamiast do v1; e2e: lista, przejście, pusty stan, oznaczenie z „Dziś” | scalone (#39) |
| 3e-1 | Zapis aktywności (G1): arkusz na „Dziś” (przycisk w karcie dnia, „+” → Aktywność) z rodzajem, czasem (szybki wybór 15–120 min), opisem i podglądem punktów obciętych do dziennego limitu; zapis w jednej transakcji (wpis, `dailyLog` dnia UTC, `points.total`/`earnedAllTime`), limit liczony z danych serwera, przy pełnym limicie nic nie jest zapisywane; nowy poziom ogłaszany toastem; definicje v1 seedowane pod tymi samymi id przy pierwszym otwarciu formularza (samo wejście na „Dziś” dalej niczego nie zapisuje); usuwanie z Historii z potwierdzeniem, w transakcji na danych serwera (G11, koniec B4); e2e: parytet G1.2 i G11 z v1, G1.7, G1.8, poziom, „+”, v1 pokazuje wpis z v2 | scalone (#40) |
| 3d-p | Poprawki po teście etapu 3d (właściciel 2026-10-02: „przyciski czasem nie działają do odświeżenia”): okno zamknięte przez samą przeglądarkę (Chrome na Androidzie zamyka górny `<dialog>` na „Wstecz”, czasem bez zdarzenia `cancel`) zgłasza to rodzicowi i zabiera swój wpis historii, więc przycisk, który je otwiera, znów działa; okno otwarte ponownie w trakcie animacji zamykania wraca zamiast zostać niewidoczne i modalne; zamykające się okno nie przyjmuje dotyku (tapnięcie w dół ekranu nie trafia w link „Dodaj w obecnej wersji” i nie przenosi do v1); e2e `modal.spec.js` na emulowanym telefonie | scalone (#40) |
| 3d-p2 | Obowiązki na „Dziś” (prośba właściciela 2026-10-02): dotknięcie zapisuje obowiązek na dziś, „Cofnij” w toaście zabiera wpis (i przywraca jednorazową definicję) jednym batchem; link „Zmień listę” do „Listy obowiązków”; e2e w `chores.spec.js` | scalone (#41) |
| 3d-p3 | Karta „Obowiązki dziś” (prośby właściciela 2026-10-02): każdy obowiązek na karcie zaznacza się raz dziennie (zrobiony zostaje wyłączony; w Obowiązkach nadal można zapisać kilka razy); domyślnie 3–4 obowiązki losowane na dzień bez zapisu (hash konta i dnia, ranking po id, jednorazowe nie są losowane), albo lista wybrana w edytorze „Edytuj listę” zapisana w nowym polu `users.choresCard` (`{mode, ids}`, v1 je ignoruje); nowy wygląd karty (stan z paskiem postępu, wiersz jako przycisk, płynnie wypełniany znacznik); `ui/Checkbox`; e2e: losowanie, raz dziennie, „Cofnij”, edytor z jednorazowym obowiązkiem, pusta lista nie zapisuje się | scalone (#42) |
| 3b-4 | Edycja obowiązku (prośba właściciela 2026-10-02; v1 umie tylko dodać i usunąć): dotknięcie obowiązku na „Liście obowiązków” otwiera ten sam arkusz w trybie edycji (nazwa, opis, punkty, emoji, rodzaj); id i miejsce na liście zostają, pola nieznane v2 też; „Cofnij” zapisuje stare pola; zapisane wpisy zostają z dawną nazwą i punktami; punkty pod nazwą, żeby długie nazwy miały miejsce; e2e: edycja, nieznane pole zostaje, „Cofnij” | scalone (#43) |
| 3e-2 | Seria i osiągnięcia zapisywane przez serwisy (G3, G4; koniec B15): zamrożenie zapisane raz transakcją i przykrywające tę samą lukę także później (świadoma zmiana wobec v1, GOLDEN G3.7); 14 odznak v1 sprawdzanych na „Dziś”, dopisywanych transakcją i ogłaszanych toastem; siatka odznak w Statystykach; sesje grania nie przechodzą do v2 (decyzja właściciela 2026-10-02: nikt ich nie używa) | scalone (#44) |
| 3e-3 | „Co teraz?” (generator v1): przycisk na „Dziś” obok „Zapisz aktywność” otwiera arkusz aktywności od razu z losowaniem, a „Losuj” jest też w samym arkuszu (bez arkusza z arkusza, PLAN 7.5); pula 33 aktywności v1 w języku aplikacji plus własne rodzaje, każda tak samo prawdopodobna; aktywność z puli zapisywana jak w v1 (`type: __generated__` + `typeName`); e2e: losowanie i zapis, parytet z generatorem v1 | scalone (#44) |
| 3d-p4 | Drugi powód zgłoszenia „przyciski czasem nie działają do odświeżenia” (2026-10-02): po zamknięciu arkusza następny ekran wjeżdżał ze stylem, który Chrome zapamiętał z czasu otwartego okna („inert”), i nie przyjmował dotknięć aż do odświeżenia; animacja wjazdu (`ui/motion.ts` `playEnter`) wymusza teraz pełne przeliczenie stylu ekranu; e2e w `modal.spec` (bez poprawki czerwone za każdym razem) | scalone (#45) |
| 3f-1 | Przegląd szkiców offline zgodnych z v1 (ten sam klucz `lifexp-offline-queue` i format wpisu): arkusz „Szkice zrobione offline” otwiera się sam po starcie online i po powrocie sieci, a także z przypomnienia na „Dziś”; „Dodaj” zapisuje aktywność, obowiązek albo transakcję tą samą transakcją co formularz, na obecnym stanie konta (limit dnia z dnia szkicu, saldo), z czasem utworzenia szkicu (GOLDEN G1, G8.9); szkic znika z kolejki dopiero po udanym zapisie; „Odrzuć” usuwa; szkic grania można tylko odrzucić (bez sesji grania w v2), nieznane typy zostają nietknięte dla v1; e2e: szkice z v1 zatwierdzone w v2 zostawiają ten sam stan konta co zatwierdzenie w v1 (DoD 3f) | scalone (#45) |
| 3f-2 | Szkice z v2: bez sieci pasek „Jesteś offline…” pod nagłówkiem, a zapis aktywności i transakcji trafia do kolejki w formacie v1 (v1 też go pokaże i zatwierdzi); po powrocie sieci przegląd otwiera się sam; e2e: offline → dwa szkice → online → zatwierdzenie | scalone (#45) |
| 4a | Ekran Ustawień `#/settings`: lista sekcji z tym, na co są ustawione, każda sekcja pod własnym adresem; Wygląd (motyw i tryb na urządzeniu, język w profilu `lang` i w kluczu v1 `lifexp-lang`), Konto (imię, do 30 znaków), Punkty i nagrody (dzienny limit 50–500, kurs punktów i kurs obowiązków jako „X zł za Y pkt”, pola v1 tego samego typu); skróty do ustawień w Obowiązkach i Pieniądzach; zakresy pól v1 sprawdzane z komunikatem zamiast zapisu wartości domyślnej; czcionka v1 nie przechodzi (jeden font, 7.2); e2e: zapis, walidacja, v1 pokazuje wartości z v2, ten sam zapis w v1 daje te same pola | scalone (#46) |
| 4b-1 | Moduły (M3, koniec B9): Ustawienia → Moduły z przełącznikiem przy każdym module v1 (Obowiązki, Pieniądze, Notatki, Statystyki XP, Gry, Ex-us); zmiana od razu, bez pytania, dane zostają; wyłączony moduł znika z menu, dolnego paska (jego miejsce zajmuje następny moduł z menu), „+” i „Dziś” (Statystyki XP zabierają też zapisywanie aktywności, jak w v1), a jego adres prowadzi na „Dziś”; dla modułów v1 prawdą zostaje `enabledModules` (v1 nadal je zmienia), v2 dopisuje obok `disabledModules`; konto z ankietą sprzed 24.08 (`planner`) ma Notatki; Zadania, Cele i „Dziś” są zawsze; e2e: wyłączenie i włączenie, Statystyki XP, konto z Plannerem, v1 ukrywa moduł wyłączony w v2, to samo `enabledModules` po wyłączeniu w v1 i v2 | scalone (#47) |
| 4b-2 | Tryb konta i pierwsze uruchomienie: pytania v1 przy pierwszym starcie (solo albo nadzorowane, potem moduły, wszystkie zaznaczone, dopóki ktoś ich nie odznaczy) zadaje teraz v2 i zapisuje pola v1 (`accountMode`, `enabledModules`, `onboardingDone`, obok `disabledModules`), więc v1 nie pyta drugi raz; do v1 trafia już tylko konto bez profilu; Ustawienia → Konto: tryb konta, a przejście na solo przy podpiętym rodzicu najpierw pyta, potem zrywa połączenie dokładnie jak v1 (`parentEmail` pusty, raport wyłączony, pola weryfikacji usunięte); e2e: pierwsze uruchomienie, v1 startuje bez pytań, solo z rodzicem (anuluj i potwierdź), bramki w `auth.spec` | scalone (#48) |
| 4c | Rodzaje aktywności (v1 Ustawienia → Aktywności): lista w kolejności v1 z kolorem i punktami za godzinę; nowy rodzaj w arkuszu (nazwa do 60 znaków, 1–10 000 pkt/h, ikona i kolor z presetów v1 wybierane po nazwie, bo v2 nie rysuje ikon Tablera, 7.1) zapisany jak w v1 (`name`, `points`, `icon`, `color`, `order` po ostatnim); zmiana rodzaju w tym samym arkuszu (tylko v2) i usuwanie z „Cofnij” (D8; v1 pyta); lista v1 zasiana przy wejściu, jak w Ustawieniach v1; e2e: walidacja, zapis, rodzaj od razu w arkuszu aktywności, zmiana i usunięcie z cofnięciem, v1 pokazuje rodzaj z v2, ten sam dokument z v1 | scalone (#49) |
| 4d | Zgłoszenia (strona zgłaszającego, v1 bug-reports.js): `#/reports` z kartą „Zgłoś błąd” (arkusz: tytuł do 80, miejsce z listy v1, opis do 400 z licznikiem) i listą „Moje zgłoszenia” na żywo; jedno zgłoszenie dziennie (dzień UTC jak `todayStr` v1), dodatkowe za każde przyjęte (`bonusGranted` → `bonusUsed`); filtr spamu ze słów admina (`bugReportsConfig/keywords`, bez dokumentu lista v1), spam widziany przez zgłaszającego jako „Sprawdzane”; zgłoszenie razem z `lastBugReportAt` albo zużyciem bonusu w jednym zapisie wsadowym (v1: dwa osobne); wątek w arkuszu, odpowiedź przez `arrayUnion` (koniec B13), „Nowa wiadomość” do przeczytania, znaczniki przeczytania pod kluczem v1 `lifexp-bug-read`; e2e: walidacja i zapis, limit, spam, bonus, wątek z wiadomością dopisaną w międzyczasie, v1 pokazuje zgłoszenie z v2, ten sam dokument z v1 | scalone (#50) |
| 4e-1 | Wiadomości globalne i historia aktualizacji: baner u góry dla każdego zalogowanego (ostatnie 10 `broadcasts` na żywo, najstarsze pierwsze, każda raz na urządzeniu na tyle sekund, ile ustawił admin, 1–30; „Zamknij” kończy wcześniej; widziane pod kluczem v1 `lifexp-seen-broadcasts`, więc pokazana w jednej wersji nie wraca w drugiej); admin wysyła i usuwa (po pytaniu) w widoku „Wiadomości” (`#/reports/broadcasts`); kto jest adminem, rozstrzygają reguły Firestore (v2 pyta serwer, adresu admina nie ma w kodzie ani w testach: testy wgrywają te same reguły z adresem testowym); „Aktualizacje” (`#/reports/updates`): CHANGELOG v1 jako dane, w języku aplikacji; e2e: wysyłka przez admina, baner raz na urządzeniu i na żywo, nie-admin nie widzi „Wiadomości”, historia, v1 nie pokazuje drugi raz | scalone (#51) |
| 4e-2 | Panel admina zgłoszeń (v1 bug-reports.js): w `#/reports` admin zamiast formularza widzi zakładki Nowe, Spam, Odłożone i Historia (przyjęte i odrzucone) z licznikami; wątek każdego zgłoszenia z akcjami v1 (przyjmij, odrzuć, odłóż, „To nie spam”, usuń po pytaniu); przyjęcie daje zgłaszającemu dodatkowe zgłoszenie (`bonusGranted`); spam nieuratowany przez 12 godzin znika, gdy admin otworzy panel (jak v1), z licznikiem godzin; słowa filtra spamu (`bugReportsConfig/keywords`, bez dokumentu lista v1) dodawane bez powtórzeń i usuwane z cofnięciem; e2e na regułach z adresem testowym: zakładki i sprzątanie spamu, przyjęcie z odpowiedzią, ratowanie spamu, usunięcie po pytaniu, słowa filtra | scalone (#52) |
| 4f | „Sprawdź spójność” (5.5 pkt 4) w Ustawieniach → Spójność danych: jedno dotknięcie czyta konto z serwera i zestawia liczniki z historią, niczego nie zapisując: punkty zdobyte = suma aktywności; wydane = koszty wydatków Money + zakupy v1 (`purchases`); do wydania = zdobyte − wydane; `dailyLog` każdego dnia UTC = suma jego aktywności (lista dni z różnicą); `moneyIncomeAllTime` = suma przychodów; saldo = przychody − wydatki − odłożone na cele + nieoddane pożyczki (do M6 cele i pożyczki nie mają wpisów), a wypłaty obowiązków bez transakcji `chore_payout` pokazane osobno, nie doliczone; przy każdej kontroli wartość z historii, z konta i różnica (tekst i ikona, nie sam kolor); przy okazji odstęp 24 px między sekcjami jednej strony Ustawień (wcześniej stykały się); e2e: zgodne konto bez zapisu, każda różnica z dniami i rozbiciem salda, konto po zapisie aktywności w v2 nadal spójne | scalone (#53) |
| 4-p1 | Poprawki zgłoszone przez właściciela (telefon, 2026-10-03): Ustawienia z menu i paska otwierały „Nie ma takiej sekcji” (link prowadził pod wzorzec trasy `/settings/:section?`; teraz `featurePath` bez parametrów, test rejestru dla każdego modułu); przy wyłączonych „Statystykach XP” Dziś nie pokazuje punktów, poziomu, serii ani karty dnia (v1 je zostawiało; decyzja właściciela), opis modułu to mówi; klasa `.stack` w 21 formularzach nie miała reguły CSS, więc pola i przyciski stykały się (Pieniądze → kategorie, arkusze) — teraz kolumna z odstępem 16 px; e2e: menu → Ustawienia, karty XP znikają i wracają z modułem, odstęp pole–przycisk | scalone (#53) |
| 4g-1 | E-mail rodzica i raport tygodniowy (v1 settings.js, „na razie jak v1”): w Ustawieniach → Konto, tylko w trybie nadzorowanym; cztery stany v1 (brak, kod wysłany, potwierdzony, adres sprzed weryfikacji do ponownego potwierdzenia); 6-cyfrowy kod ważny 10 min przez EmailJS (te same publiczne identyfikatory co v1), sprawdzany na kopii z serwera; v2 najpierw wysyła, potem zapisuje (v1 odwrotnie: nieudana wysyłka zostawiała „kod wysłany”); anulowanie, zmiana adresu; przełącznik `autoReport` z informacją, dokąd idzie raport; e2e z udawanym EmailJS: walidacja, żądanie jak v1, zły i dobry kod, raport, nieudana wysyłka bez zapisu, kod wygasły, adres sprzed weryfikacji, v1 pokazuje adres potwierdzony w v2. Do sprawdzenia przez właściciela: prawdziwy e-mail | scalone (#54) |
| 4g-2 | Powiadomienia push i godziny przypomnień (`fcmTokens`, `notifHours`): zgodnie z R7 zostają w v1 do cutover (dwa Service Workery = dwie subskrypcje = podwójne powiadomienia); v2 ich nie czyta i nie zapisuje. Uwaga: wysyłka push i raportu tygodniowego nie działa dziś w ogóle (workflowy `notify`/`weekly-report` usunięte 19.08, R10, D2) — przełącznik raportu z 4g-1 zapisuje `autoReport`, ale nic go jeszcze nie czyta; wysyłka wraca w etapie 6 | przeniesione do etapów 6–7 |
**Etap 4 zamknięty (2026-10-09).** DoD: parytet ustawień z v1 poza push (4g-2, R7) i wyborem czcionki (7.2); Notatnik widoczny dla kont, które przed 24.08 wybrały Planer (M3, #47, test `modules.spec.js`). Właściciel sprawdził prawdziwy e-mail z kodem (4g-1). Następny: etap 5 (Ex-us).

**Etap 5 (start 2026-10-09)** — Ex-us lokalnie (5a), potem AI (5b):

| PR | Zakres | Stan |
|---|---|---|
| 5a-1 | Rdzeń parsera komend w domenie (6.3), bez UI: tokenizer (cudzysłowy "…" i „…”, `klucz=wartość`, `--flaga`, jednostka pisana osobno doklejana do liczby: `12 zł`, `1 500 PLN`, `500 pkt`), rozpoznawacze (kwota w groszach z sygnałem jednostki, punkty, kwota celu zł/pkt, czas w minutach `90`/`1h30`/`1,5h`, dzień lokalny `dziś`/`jutro`/dzień tygodnia/`12.10`/`+3d`, wybór z listy bez względu na wielkość liter i polskie znaki), wypełnianie slotów od najbardziej szczegółowego typu, reszta to tekst; brakujące sloty nie są błędem (karta je pokaże); testy tabelaryczne | scalone (#56) |
| 5a-2 | Rejestr komend w domenie (6.4: id, polskie aliasy, moduł, ryzyko, sloty; dopasowanie po id albo aliasie bez względu na wielkość liter i polskie znaki; komendy wyłączonych modułów znikają) i pierwszy ekran `#/exus` (z menu „Zapytaj Ex-us”): rozmowa w pamięci, `/pomoc [komenda]`, `/dzis` (punkty, limit, saldo, zadania na dziś i zaległe), `/zadanie <treść> <termin> [S/M/L]` przez ten sam serwis co ekran Zadań (limit 30, termin nie w przeszłości) z „Cofnij”; brakujące pola nazwane ze składnią; zwykły tekst czeka na AI (5b); e2e: menu, pomoc, nieznana komenda, zadanie w dowolnej kolejności i cofnięcie, podsumowanie, Ex-us wyłączony | scalone (#57) |
| 5a-3 | Paleta komend (6.3): po wpisaniu `/` pod polem lista pasujących komend (najpierw nazwy zaczynające się od wpisu, potem zawierające go; id i aliasy bez polskich znaków), każda ze składnią i opisem; tapnięcie wstawia komendę i wraca kursorem do pola, a po spacji pod polem zostaje składnia; komenda wpisana przed wczytaniem zadań czeka na listę zamiast prosić o ponowienie; e2e palety | scalone (#58) |
| 5a-4 | Pipeline wykonania (6.6) przed kolejnymi komendami: zamiast łańcucha `if` w ekranie mapa handlerów w `features/exus/handlers.ts` (jeden na `CommandId`, wspólny kształt `run(args, ctx)` → odpowiedź, zapis z toastem błędu, opcjonalne `undo`; `effect` dla komend nieodwracalnych), więc nowa komenda = spec w domenie + handler; polityka ryzyka w domenie (`whatToDo`: read i write od razu, destructive przez `ConfirmDialog` ze skutkiem, brakujące pola nazwane ze składnią); stos cofania ostatnich 10 zapisów rozmowy i `/cofnij` (mówi, co cofnęło, albo że nie ma czego); „Cofnij” w toaście bierze ten sam wpis, więc nic nie cofa się dwa razy; e2e: dwa zadania cofnięte po kolei, pusty stos, toast i `/cofnij` bez podwójnego cofnięcia | scalone (#59) |
| 5a-5 | Komendy celów (6.5) przez te same serwisy co ekran Celów (limit trzech, wpłata nie schodzi poniżej zera salda, usunięcie zwraca odłożone na saldo): `/cel <nazwa> <kwota zł\|pkt>` (jednostka rozstrzyga rodzaj, sama liczba prosi o „zł” albo „pkt”; „Cofnij” usuwa nowy cel, bo nic na nim nie odłożono), `/wplac <cel> <kwota>` (tylko cele pieniężne, bez cofania, bo serwisy nie mają odwrotności), `/cele` (postęp: punkty albo odłożone z formatMoney), `/edytuj-cel <cel> [nazwa=] [kwota=]` (nazwane argumenty z tokenizera trafiają do slotów; nieczytelna wartość jest nazwana), `/usun-cel <cel>` przez ConfirmDialog ze skutkiem (cel i kwota wracająca na saldo; bez cofania); slot `<cel>` (6.3, krok 7): czysty `matchEntity` w domenie (dokładna nazwa, początek, fragment, Levenshtein ≤ 2 na złożonej nazwie; wiele trafień = lista z prośbą o dokładniejszą nazwę, brak = komunikat), cudzysłowy działają; kwota celu czytana od końca, żeby liczba w nazwie została w nazwie; `check` handlera odpowiada przed pytaniem o zgodę, gdy celu nie ma. Poprawka z 5a-4: wiadomość wysłana, gdy ConfirmDialog jeszcze znikał, ginęła, bo natywny modal trzymał stronę nieaktywną (inert) przez cały ruch wyjścia (200 ms) i tekst nie trafiał do pola; teraz `useModal` zamyka modal od razu (strona żyje, fokus wraca), a ruch wyjścia dokończa zamknięty dialog trzymany w warstwie wierzchniej przez `transition: overlay, display … allow-discrete`, tapnięcia w tym czasie nie trafiają w stronę (`html[data-modal-closing]`); e2e: cel pieniężny i punktowy z komendy, wpłata, odmowa ponad saldo, lista, edycja, nazwa po literówce i wiele trafień, usunięcie z Anuluj i Wykonaj, wiadomość w trakcie zamykania | scalone (#60) |
| 5a-6 | Komendy pieniężne (6.5, „Money”) przez te same serwisy co ekran Pieniędzy (saldo nie spada poniżej zera, wydatek kosztuje punkty po przeliczniku ogólnym, wpływ zwiększa `moneyIncomeAllTime`), tylko przy włączonym module Pieniądze: `/wplyw` i `/wydatek <kwota> [kategoria] [notatka] [data]` (kwota, dzień i reszta w dowolnej kolejności; kategoria to istniejąca nazwa — dokładna, w dowolnym miejscu reszty, także wielowyrazowa — albo pierwsze słowo, które jest jej początkiem, fragmentem lub literówką; słowo bez kategorii nigdy nie tworzy nowej, nową zapisuje się `kategoria=nazwa`, brak kategorii prosi o nią z listą; odpowiedź podaje koszt „−50 pkt” jak toast ekranu; „Cofnij” i `/cofnij` usuwają transakcję serwisem usuwania, więc saldo, punkty i licznik wpływów wracają dokładnie, a wpływ, którego saldo już nie pokrywa, zostaje), `/saldo` (saldo, wydatki miesiąca z limitem, odłożone w celach), `/kategoria <nazwa>` (duplikat odrzucony jak na ekranie; cofnięcie usuwa kategorię, bo transakcje trzymają nazwy), `/usun-transakcje [ostatnia\|tekst]` przez ConfirmDialog ze skutkiem (saldo ±, punkty wracają; „ostatnia” to ostatnio wpisana, nie ostatnia z datą; bez cofania, bo nic nie odtwarza usuniętej transakcji z saldem i punktami). Czysta domena `domain/exus/money.ts` (podział „kategoria notatka”, wybór transakcji); `AddTxOutcome` zwraca id nowego dokumentu, `prepareMoney` współdzieli trwające przygotowanie, a handler czeka na dane Pieniędzy (`loadedMoney`) i na przygotowane konto; nowy hak `ready` handlera czeka na dane, które czytają synchroniczne `check` i `effect` | scalone (#61) |
| 5a-7 | Dwie poprawki z przeglądu 5a-6 i komendy obowiązków oraz XP (6.5), każda przez te same serwisy i funkcje domeny co ekran, który ją ma. Poprawki: (1) „(celów: N z 3)” w odpowiedzi `/cel` pochodzi z transakcji serwisu (`GoalOutcome.count`, addytywnie), a nie z migawki profilu, która przy dwóch szybkich `/cel` albo pod dławieniem procesora podawała stary stan; (2) w komendzie z polem kwoty samo `5.10` albo `5.1` jest kwotą, nie datą 5 października (slot daty był wypełniany przed kwotą): `dateFrom(today, { dayMonth: false })` w `domain/exus/commands.ts` (`dateWithMoney`), a test tabelaryczny przechodzi po całym rejestrze i pilnuje każdej komendy, która ma slot kwoty i daty; data zostaje `dziś/wczoraj/pojutrze`, dzień tygodnia, `12.10.2026`, `2026-10-12`, `+3d`, a `12.10` w komendzie bez kwoty (`/zadanie`) nadal jest datą; opis `/wplyw` i `/wydatek` w pomocy to mówi. Obowiązki (moduł Obowiązki): `/obowiazek <obowiązek> [dzis|wczoraj]` (ten sam wpis co ekran, dopasowanie nazwy jak cel: początek, fragment, literówka, wiele trafień = lista; obowiązek jednorazowy znika z listy; „Cofnij” i `/cofnij` usuwają wpis serwisem `logChore` i przywracają jednorazowy), `/obowiazki` (zrobione dziś, do wypłaty w punktach i złotych po kursie obowiązków, wpisy bieżącego miesiąca), `/rozlicz` (destrukcyjna: `ConfirmDialog` mówi, ile punktów i jakich wpisów, ile złotych i do jakiej kategorii; potwierdzenie to atomowa transakcja `settleChores`; bez cofania, bo nic nie odwraca wypłaty; brak wpisów = odpowiedź bez pytania). XP (moduł Statystyki XP): `/aktywnosc <rodzaj> <czas> [opis]` (rodzaj to początek tekstu: najdłuższy zaczynający się dokładną nazwą albo pierwsze słowo, reszta to opis; czas z dowolnego miejsca; typy zakładane jak w arkuszu; kredyt i dzienny limit liczy transakcja `saveActivity` jak w G1, odpowiedź podaje „+20 pkt” i ucięcie limitem albo brak punktów; `LogActivityOutcome` zwraca addytywnie `id` i `limit`; „Cofnij” i `/cofnij` usuwają wpis serwisem `removeActivity`, który odejmuje punkty dokładnie; offline mówi, że zapis potrzebuje serwera, szkice zostają na ekranie Dziś), `/seria` (`streakOf` w domenie, tę samą funkcję czyta karta serii na Dziś), `/statystyki [7d|30d]` (punkty z dzienników dni jak wykres, czas aktywności i najczęstsza aktywność z ostatnich 50 wpisów jak ekran, z dopiskiem „co najmniej”, gdy 50 wpisów mieści się w okresie), `/co-teraz <czas>` (losuje z puli generatora jak „Co teraz?” i podaje punkty po limicie; nic nie zapisuje). Czekanie na dane przez wspólne `waitFor` w `features/exus/loaded.ts` (także dla typów aktywności i obowiązków, które konto bez nich dostaje z zasiewu v1); komendy znikają z palety, pomocy i parsera przy wyłączonym module; e2e na emulatorach, także pod `setCPUThrottlingRate` 6 | scalone (#62) |
| 5a-8 | Komendy zadań, notatek, ustawień i nawigacji (6.5), każda przez te same serwisy i store'y co ekran, który ją ma; polecenie czeka na wczytane dane (`loadedTasks`, `loadedNotes` w `features/exus/loaded.ts`). Zadania: `/zrobione <zadanie>` (`completeTask`: kawałki budowy PC jak na ekranie, po terminie 0 i komunikat; bez cofania, bo zrobione jest w v1 ostateczne i serwisy nie mają odwrotności), `/zadania [dzis\|zalegle\|wszystkie]` (domyślnie na dziś i zaległe; tylko otwarte, od najbliższego terminu, z terminem i rozmiarem), `/edytuj-zadanie <zadanie> [tresc=] [termin=] [rozmiar=]` (`updateTask` z tymi samymi sprawdzeniami; zaległe zadanie bez nowego terminu dostaje podpowiedź `termin=jutro`, jak arkusz; „Cofnij” przywraca stare wartości tym samym serwisem, ale tylko gdy stary termin nie minął), `/usun-zadanie <zadanie>` (`ConfirmDialog` z nazwą zadania; `deleteTask` ma w serwisie odwrotność, lecz polecenie destrukcyjne po pytaniu nie trafia na stos, więc bez „Cofnij”). Notatki (moduł Notatki): `/notatka <tytuł> [treść]` (tytuł to pierwsze słowo albo słowa w cudzysłowie, reszta to treść, także `tytul=` i `tresc=`: nowa opcja `leading` slotu w parserze; `createNote` z limitem 30 aktywnych i 1000 linii, tytuł do 80 znaków; „Cofnij” usuwa notatkę, chyba że ktoś ją w międzyczasie zmienił), `/archiwizuj <notatka>` (dopasowanie po tytule wśród aktywnych; „Cofnij” przywraca z archiwum), `/szukaj <fraza>` (czysta domena `domain/exus/notes.ts`: wszystkie słowa w tytule lub treści bez względu na wielkość liter i polskie znaki, tytuł przed treścią, aktywne przed archiwalnymi, pięć najlepszych z fragmentem treści). Ustawienia i nawigacja (zawsze dostępne): `/limit <pkt>` (`saveDailyLimit`, zakres 50–500 jak w Ustawieniach; „Cofnij” przywraca poprzednią wartość; czyta bieżący profil, nie migawkę z początku rozmowy), `/jezyk <pl\|en>` (jak Wygląd: `setLanguage`, klucz v1 i profil; odpowiedź już w nowym języku), `/motyw [lifexp\|ios\|gold] [jasny\|ciemny\|system]` (`chooseTheme` w domenie: sama rodzina zaczyna od trybu domyślnego, sam tryb zostawia rodzinę, Gold tylko ciemny; zapis tylko na urządzeniu, jak w Ustawieniach), `/modul <moduł> <on\|off>` (`saveModule`; nazwy po polsku i angielsku oraz id; wyłączenie Ex-us z poziomu rozmowy jest odrzucone z odsyłaczem do Ustawień; „Cofnij” przełącza z powrotem), `/idz <ekran>` (`domain/exus/screens.ts`, dopasowanie jak encje; ekran wyłączonego modułu jest odrzucony; `ExusPage` znów dostaje `RouteProps`, a `navigate` idzie do handlera w `HandlerContext`; test w `registry.test.ts` pilnuje zgodności ekranów z rejestrem). Testy tabelaryczne: parser (`leading`), nowe komendy w rejestrze, wyszukiwanie, nazwy modułów i motywów, nazwy ekranów; e2e na emulatorach, także pod `setCPUThrottlingRate` 6 z zimnego startu | scalone (#63) |
| 5a-9 | Reszta komend z 6.5 oprócz `edit-pending` (tylko AI, 5b) i `log-gaming` (v2 nie ma sesji grania, decyzja właściciela), każda przez te same serwisy co ekran, który ją ma. `aiExposed` w `CommandSpec` (kolumna „AI” z 6.5: nie dla `/pomoc`, `/cofnij`, `/nowy`, `/motyw`, `/jezyk`, `/modul`; test pilnuje dokładnego zbioru, nic go jeszcze nie czyta, użyje go 5b). Pożyczki (moduł Pieniądze, `features/exus/loanHandlers.ts` przez `services/loans`, czyli jedna transakcja z saldem): `/pozyczam` i `/pozyczam-od <osoba> <kwota> [notatka]` (osoba to pierwsze słowo albo słowa w cudzysłowie, kwota z dowolnego miejsca; pożyczanie ponad saldo odrzucone jak na ekranie; „Cofnij” usuwa pożyczkę serwisem `removeLoan`, który zwraca saldo dokładnie, a przy pożyczce od kogoś, gdy pieniądze poszły, odmawia i nic nie zmienia; `addLoan` zwraca teraz addytywnie `id`), `/splata <pożyczka|osoba> <kwota>` (`findLoan` w domenie: osoba, a przy kilku pożyczkach jednej osoby fragment notatki; spłata ucięta do tego, co zostało; bez cofania, bo serwisy nie mają odwrotności), `/pozyczki` (do odzyskania i do oddania, osobami, rozliczone pominięte). `/limit-wydatkow <kwota>` (`saveMonthlyLimit`, 0 wyłącza jak na ekranie, „Cofnij” przywraca poprzedni). Obowiązki: `/nowy-obowiazek <nazwa> <pkt> [--jednorazowy]` (parser dostał flagi `--x`: `SlotDef.flags`; punkty to ostatnia liczba, więc liczba w nazwie zostaje w nazwie; `createChoreDef` z tymi samymi sprawdzeniami co arkusz; „Cofnij” usuwa definicję, bo wpisy mają własną kopię nazwy i punktów), `/usun-obowiazek <obowiązek>` i `/usun-wpis [ostatni|<obowiązek>]` (destrukcyjne: `ConfirmDialog` ze skutkiem, brak celu odpowiadany przed pytaniem; serwisy mają dokładne odwrotności, więc „Cofnij” przywraca tę samą definicję albo ten sam wpis z czasem; domyślnie najnowszy wpis do wypłaty). XP: `/usun-aktywnosc [ostatnia|<tekst>]` (wśród 50 ostatnich z Statystyk, dopasowanie po rodzaju i opisie; `removeActivity` odejmuje punkty z dnia i sumy dokładnie; bez cofania, bo nic nie zapisuje aktywności z jej punktami). `log-gaming` pominięty: PLAN mówi, że v2 nie ma sesji grania. `/blad <tytuł> | <obszar> | <opis>` (moduł: zawsze; slot `raw` w parserze oddaje tekst po komendzie bez zmian, `splitBugReport` tnie po pierwszych dwóch „|”, obszar po polskiej nazwie albo id; `sendReport` z limitem 1 dziennie + bonus i filtrem spamu, odpowiedź jak ekran Zgłoszeń; bez cofania, bo nic nie usuwa zgłoszenia; `ExusPage` słucha własnych zgłoszeń). `/nowy` (czyści rozmowę i stos cofania, odpowiedź jest pierwszą wiadomością nowej; bez pytania). Dopasowanie encji (`matchEntity`) zna teraz także „każde słowo gdzieś w nazwie” (`nauka rozdział` znajduje `Nauka (JS) rozdział 3`). Testy tabelaryczne: rejestr (zbiór `aiExposed`, komplet komend, moduły), parser (flagi, `raw`), `findLoan`, `splitBugReport`/`findArea`, `findChoreEntry`, `findActivity`, `matchEntity`, stos cofania, teksty pl/en każdej komendy; e2e na emulatorach z saldami i dokumentami jak na ekranach, także pod `setCPUThrottlingRate` 6 z zimnego startu | scalone (#64) |
| 5a-10 | Karta-formularz dla komendy z brakującymi slotami (6.6, wiersz 2), zamiast odpowiedzi tekstem: polityka (`whatToDo`) zwraca `form` dla `write` i `destructive`, a `read` zostaje przy tekście. `domain/exus/form.ts` (czysta): kontrolka z typu slotu (`fieldsFor`: tekst i encja = pole tekstu, `raw` = pole wielolinijkowe, data, kwota w zł = pole kwoty, kwota z jednostką zł/pkt = tekst z podpowiedzią, czas/liczba = pole liczbowe, enum z `SlotDef.choices` = lista, flaga `--x` = pole wyboru), `initialValues` (to, co zrozumiał parser) i `readForm`, które czyta każde pole **rozpoznawaczem tego slotu**, więc karta przyjmuje dokładnie to, co wpisana komenda. Komenda ze slotem bez sensownej kontrolki (enum bez `choices`: język, moduł) zostaje przy odpowiedzi tekstem. `features/exus/FormCard.tsx` (tylko komponenty `@/ui`): pola z oznaczonymi brakami i powodem pod polem, „Wykonaj” nieaktywne do czasu, aż wymagane pola są poprawne, „Pomiń” zwija kartę do „Pominięto.”; wysłana karta jest tylko do odczytu (podsumowanie wartości) i nie uruchomi się drugi raz; „Wykonaj” idzie tym samym `runCommand` (ten sam handler, cofnięcie, toast), a komenda destrukcyjna nadal przez dialog. Wejście karty to istniejący `ui-rise-in` z tokenami. Testy: tabelaryczne `form.test.ts` (kontrolki, wartości początkowe, czytanie i błędy) i `policy.test.ts`; e2e: karta `/zadanie` bez terminu i wykonanie z cofnięciem, Pomiń, zła kwota blokuje „Wykonaj”, pole kwoty i osoba, dialog dla komendy destrukcyjnej, lista wyboru, flaga i pole `/blad`, telefon 412 px bez przewijania poziomego; dotychczasowe testy brakujących slotów sprawdzają teraz kartę | scalone (#65) |
| 5a-11a | Z 6.10: historia, Ctrl/Cmd+K i offline. Historia rozmowy na urządzeniu: IndexedDB, jeden rekord na konto (`offline/chatHistory.ts`, bez zależności; brak lub blokada IndexedDB = brak historii, nic nie rzuca), ostatnie 200 wiadomości, tylko tekst (`domain/exus/history.ts`: `trimHistory`, `serializeHistory`, `parseHistory` odrzuca śmieci ze storage); karta-formularz jest trzymana jako to, czym się stała: wykonana jako podsumowanie tylko do odczytu (`DoneCard`), pominięta jako „Pominięto.”, nieużyta wcale, więc żywa karta nigdy nie wraca; stos cofania nie jest zapisywany; powitanie i odpowiedź na `/nowy` są chwilowe (nie zapisują się); wczytanie przy otwarciu Ex-us, zapis dopiero po wczytaniu, `/nowy` czyści historię, wylogowanie (`app/sign-out.ts`) czyści historię wszystkich kont na urządzeniu przed wylogowaniem. Ctrl/Cmd+K: nasłuch w `AppShell` (nie na `window` jako globalu, sprzątany przy odmontowaniu), tylko gdy moduł Ex-us jest włączony i nie ma otwartego okna; otwiera `#/exus` (albo tylko ustawia fokus, gdy już tam jesteś) przez sygnał `stores/exusFocus` czytany przez ekran. Offline: komendy, których serwisy są transakcjami serwera (cele, ukończenie zadania, transakcje, pożyczki, rozliczenie, aktywności i ich usuwanie; `NEEDS_SERVER` w `domain/exus/policy.ts`) odpowiadają „To polecenie wymaga internetu” zanim pojawi się karta; pojedyncze zapisy, które Firestore kolejkuje (zadanie, notatka, obowiązek, ustawienia, limit wydatków, zgłoszenie), działają jak na ekranach. Decyzja o szkicach 3f: ekrany Dziś i Pieniądze zapisują offline szkice w kolejce `lifexp-offline-queue` (aktywność, transakcja), ale Ex-us szkiców nie tworzy, więc te komendy proszą o połączenie zamiast zapisywać po cichu; zwykły tekst offline dostaje jasny komunikat. Testy: tabelaryczne `history.test.ts` i `needsInternet`; e2e: historia po przeładowaniu, `/nowy`, wylogowanie, karta wykonana tylko do odczytu / pominięta / nieużyta, Ctrl+K i Cmd+K, wyłączony Ex-us, offline przez `context.setOffline` | scalone (#66) |
| 5b-1 | Backend `exusTurn` (6.9, 6.12), bez UI v2: `onCall` w codebase `lifexp-v2` (`functions/src/exus/`: `turn.ts`, `input.ts`, `quota.ts`, `prompt.ts`, `output.ts`, `commands.ts`, `gemini.ts`, `fake.ts`, `select.ts`, `config.ts`), region `europe-west1` (baza `eur3`), 256 MiB, `maxInstances: 5`, sekret `GEMINI_API_KEY` tylko przez `defineSecret` (istniejący, używany przez v1; nic nie jest tworzone ani nadpisywane). Kolejność: logowanie → allowlista `aiTestAccess/{uid}` → wejście (zod: wiadomość 1-2000 znaków, historia ≤ 8 tur `user`/`model` ucinanych do 1000 znaków, kontekst jako obiekt ≤ 16 KB, `lang` pl/en, `clientVersion`; błąd = `invalid-argument` z nazwami pól, bez wartości) → budżet → jedno wywołanie modelu → walidacja → zapis zużycia. Budżet w transakcjach: `aiUsage/{uid}_{dzień}` i bezpiecznik `aiUsageGlobalV2/{dzień}` (`{tokens, calls, updatedAt}`, dzień z Europe/Warsaw), na start nisko: 20 tys. tokenów na konto i 200 tys. na całą aplikację dziennie (stałe w `config.ts`); po wyczerpaniu `resource-exhausted` z jasnym komunikatem i `details.usage`; reguły: obie kolekcje `read, write: if false` (pasek limitu dostaje `usage` z odpowiedzi, więc klient nie potrzebuje nawet odczytu). Model `gemini-2.5-flash` (jedna stała, bez myślenia, max 1024 tokenów odpowiedzi) przez `@google/genai` za interfejsem `ModelClient`, odpowiedź JSON wymuszona `responseSchema`; argumenty jako pary nazwa/tekst (dialekt schematu nie ma dowolnego obiektu), czytane potem tymi samymi rozpoznawaczami slotów co wpisana komenda. Walidacja wyjścia: zła odpowiedź = bezpieczny ogólny tekst bez akcji (nigdy 500 ani tekst modelu), nieznane komendy i złe argumenty odrzucone, max 3 akcje. Lista komend to na razie ręczna kopia `aiExposed` (`commands.ts`, szew na `schema.gen.json` z 5b-2). Prompt `PROMPT_VERSION` wg 6.8, kontekst jako DANE w `<lifexp_data>` (znak `<` w JSON escapowany). Fałszywy model (deterministyczne reguły: `zadanie`, `saldo`, `zepsuj`, `nieznana`, `wiele`; 100 tokenów na wywołanie) tylko przy `FUNCTIONS_EMULATOR=true`, poza emulatorem nie da się go zbudować (test). Emulator Functions dodany do `firebase.emulators.json` (port 5001; `test:v2` i `test:emulator` dalej uruchamiają tylko auth i firestore). Testy `npm test --prefix functions` (node:test, Firestore w pamięci, w jobie „Cloud Functions build”): brak logowania, brak na allowliście, złe wejście, limit konta i globalny, sumowanie zużycia, dzień warszawski, zła odpowiedź, więcej niż 3 akcje, nieznana komenda, błąd modelu, dokładnie jedno wywołanie modelu na turę, fałszywy model niemożliwy poza emulatorem; ręcznie: wywołanie przez emulator Functions z kontem z emulatora Auth. Bez wdrożenia | scalone (#67) |
| 5b-2 | Schemat komend generowany z rejestru (6.8 pkt 5) i zmiana modelu. `v2/tools/exus-schema.ts` czyta `COMMANDS` (tylko `aiExposed: true`) i dla każdej komendy zapisuje id, ryzyko, polski opis z i18n `exus.commands.<id>` oraz sloty (nazwa, typ, wymagany, `choices` enumu, klucze `klucz=wartość` i flagi, `raw`); na końcu specjalny przypadek `edit-pending` (tylko AI: `ref` p1..p3 z `context.pendingActions` plus pola komendy tej karty). Wynik w repo: `functions/src/exus/schema.gen.json`, generowany przez `npm run gen:exus-schema --prefix v2` (moduł TS ładowany przez `runnerImport` z Vite, bez nowych zależności); `tools/exus-schema.test.ts` w `npm run check --prefix v2` zgłasza nieaktualny plik. Funkcja bierze z niego enum komend, enum nazw argumentów w `responseSchema` i listę komend w prompcie (`PROMPT_VERSION` .2, z zasadą `edit-pending`); ręczna lista z 5b-1 usunięta. Walidacja argumentów per komenda (`functions/src/exus/args.ts`): nazwy spoza slotów komendy odrzucone, puste i za długie wartości odrzucone (500 znaków, 2000 dla `raw`), enum tylko z `choices` (bez względu na wielkość liter i polskie znaki, zwracany w pisowni wyboru; enum bez `choices` przechodzi jako tekst), flaga tylko true/false, brak wymaganego slotu dozwolony (pokaże go karta-formularz); wartości zostają tekstem dla rozpoznawaczy klienta; `edit-pending` bez istniejącej karty albo bez pola do zmiany odrzucone. Model: `gemini-2.5-flash` wyłączony 2026-10-16, więc `gemini-3.5-flash` z `thinkingLevel: MINIMAL` (zamiast `thinkingBudget: 0`) i domyślną temperaturą. Fałszywy model zna `zmien` (`edit-pending` karty p1). Testy: generator (create-task, klucze, flaga, `raw`, brak komend bez `aiExposed`, `edit-pending`, wykrycie nieaktualnego pliku), argumenty i `edit-pending` w `functions` (40 testów), kształt zapytania do Gemini 3 | scalone (#68) |
| 5b-3 | Kontekst dla AI po stronie v2 (6.7), bez wywołania sieci (to 5b-4). Czysta domena `domain/exus/context.ts`: `buildContext(input)` → `{ context, refs }` z danych, które stores już mają (profil, dailyLog, saldo, transakcje i limit miesiąca, kategorie, pożyczki, zadania, definicje i wpisy obowiązków, rodzaje aktywności, notatki, ostatnie akcje, karty czekające). Kształt 6.7: `now` (czas lokalny do minuty w strefie urządzenia, `lib/dates` `zonedIsoMinutes`), `tz`, `lang`, punkty (suma, dziś, limit, poziom), Money (saldo, wydane w miesiącu, limit), cele, zadania (otwarte, zaległe i najbliższe najpierw, `overdue`), obowiązki (definicje, nierozliczone punkty), rodzaje aktywności, kategorie, otwarte pożyczki, tytuły notatek, `recentActions`, `pendingActions`; sekcje wyłączonych modułów i niewczytanych danych pominięte. Kwoty w zł jako liczby (312.5), wewnątrz v2 dalej grosze. Krótkie refy (g, t, c, a, l, n + numer), `refs` mapuje ref na id Firestore i nazwę; w kontekście nie ma id, uid ani e-maili (test z zasianymi id i adresami). Budżet: teksty ucięte do 80 znaków, limity list (3 cele, 30 zadań, 20 obowiązków, 20 kategorii, 20 rodzajów, 10 pożyczek, 10 notatek, 5 akcji, 3 karty) i twardy limit 12 KB: po przekroczeniu elementy list odpadają w stałej kolejności (notatki, pożyczki, kategorie, obowiązki, rodzaje, akcje, zadania, cele). `domain/exus/aiAction.ts` `resolveAction`: ref z kontekstu → nazwa, którą handler dopasuje (`matchEntity`), ref spoza mapy albo innego rodzaju odrzuca akcję; inne wartości czytane rozpoznawaczem slotu jak `klucz=wartość` (z tokenizerem, więc „20 zł” działa); brakujące i nieczytelne sloty zostają brakujące dla karty-formularza. `features/exus/context.ts`: zbiera wartości stores (tylko `waitFor`, 1,5 s, bez nowych odczytów) i `aiActionArgs` z tekstem `exus.ai.unknownRef`. Jeden builder zamiast `FeatureDef.exusContext`: stores nie są podzielone na moduły, `FeatureDef` jest w warstwie app, a limit rozmiaru tnie wszystkie sekcje razem. Fixture kontekstu typowego konta (`v2/tools/exus-context-fixture.ts` → `functions/src/test/fixtures/exus-context.json`, ta sama komenda co schemat, check v2 pilnuje aktualności); test w `functions` sprawdza, że przechodzi walidację zod `exusTurn`. Testy: kształt, moduły wyłączone, niewczytane dane, ucinanie, limity i kolejność, limit bajtów i kolejność cięcia, brak id i e-maili, ~1-2 tys. tokenów, `resolveAction` (dobry ref, nieznany, zły rodzaj, nazwa zamiast refu, rozpoznawacze, brakujące sloty), `zonedIsoMinutes` | scalone (#69) |
| 5b-4 | Zwykły tekst w Ex-us idzie do `exusTurn` (6.9, 6.10), bez kart akcji (5b-5). `data/functions.ts`: Functions SDK 10.12 leniwie na jedynej aplikacji, `getFunctions(app, 'europe-west1')`, emulator 127.0.0.1:5001 przy `?emulator=1` (`lib/emulator` ma `functionsPort`), `callExusTurn` zamienia kody `HttpsError` na błędy domeny (`domain/exus/ai.ts`: brak dostępu, budżet z `details.usage`, złe wejście, niedostępny, brak połączenia — SDK zgłasza go jako `internal` — i inny), odpowiedź czytana kształtem. `services/exus-ai.ts` `askExus` zapisuje w `stores/exusAi` zużycie (pasek) i brak dostępu na sesję. `ExusPage`: tekst → dymek „Ex-us pisze…” w logu (`role=log`), który w miejscu zamienia się w odpowiedź renderowaną przez `Markdown` (jedyna ścieżka HTML) albo w jasny komunikat błędu; zapytanie: wiadomość, historia (ostatnie ≤ 8 tur rozmowy z AI, ucięte do 1000 znaków; komendy, ich odpowiedzi i karty się nie liczą — wiadomości AI mają w historii na urządzeniu addytywną flagę `ai`), kontekst z `exusContext()` (5b-3), język i `clientVersion` z builda (`__LIFEXP_CLIENT_VERSION__`: skrót commita w CI, inaczej `dev`); `refs` ostatniego kontekstu trzymane w pamięci dla 5b-5. Konto bez dostępu: po pierwszej odmowie odpowiedź „Ex-us AI jest na razie w testach” bez kolejnych wywołań do końca sesji. Pasek limitu (`ProgressBar` z `--progress`) pod polem z tekstem „Limit AI na dziś: N%”, ukryty do pierwszej odpowiedzi AI w sesji, aktualizowany z każdej odpowiedzi i z `details.usage` odmowy budżetu; komunikat budżetu mówi, że limit odnawia się o północy. Offline bez wywołania (5a-11a). `test:v2` buduje `functions` i startuje emulator Functions (job CI „v2” instaluje `functions`). E2E `tests/v2/exus-ai.spec.js` (fałszywy model, allowlista przez admina): odpowiedź i historia po przeładowaniu, dokładnie jedno wywołanie na wiadomość z historią poprzednich tur, pasek 99%/50%/49%, konto bez dostępu (jedno wywołanie na dwie wiadomości), wyczerpany budżet (pasek 0 z odpowiedzi i z odmowy), `zepsuj` → bezpieczna odpowiedź, Markdown sanityzowany, offline bez wywołania, treść zapytania bez id dokumentów, uid i e-maila (zasiane id zadania, obowiązku i kategorii) | scalone (#70) |
| 5b-5 | Akcje zaproponowane przez AI jako karty (6.6 wiersz 3, 6.7, 6.10). Każda akcja odpowiedzi (max 3) pod dymkiem odpowiedzi, rozwiązana przez `resolveAction` (5b-3): `read` wykonuje się od razu tym samym `runCommand` (odpowiedź handlera w czacie), `write` to karta „Propozycja: <opis komendy>” — ta sama `FormCard` z 5a-10, pola wypełnione i edytowalne, „Wykonaj” / „Pomiń”, także gdy niczego nie brakuje; `destructive` to karta, której „Wykonaj” otwiera `ConfirmDialog` ze skutkami. Ref spoza mapy, zły rodzaj refu, komenda wyłączonego modułu albo bez sensownego formularza → krótka linia tekstu zamiast karty. Karta działa raz i staje się podsumowaniem tylko do odczytu (ten sam handler, stos cofania, toast); tekst odpowiedzi AI pokazany bez zmian, wynik handlera dopiero po jego powrocie. Następna tura dostaje `pendingActions` (czekające karty, max 3, p1..p3 w kolejności czatu, pola jako tekst, jak je widać: kwota „12,50 zł”, bez id; `domain/exus/proposals.ts`) i `recentActions` (ostatnie 5: executed / skipped / failed, także anulowanie w dialogu = skipped). `edit-pending` pN zmienia pola tej karty w miejscu (wartości czytane rozpoznawaczami slotów, reszta wpisana ręcznie zostaje; `FormCard` dostała `title` i `onChange`) z linią „Zaktualizowano propozycję.”; nieznane pN → linia. Historia: wykonana i pominięta jak w 5a-10, nieużyta propozycja zapisuje się jako „Propozycja wygasła: <opis>.” (nigdy jako żywa karta). Fałszywy model: `usun` → `delete-task` t1, `zgubiony` → `complete-task` t9. E2E: karta zadania, Wykonaj zapisuje kształt v1, podsumowanie, `/cofnij`; Pomiń i `recentActions` skipped oraz `pendingActions` p1 w treści zapytania; `wiele` → 3 karty; nieznany ref → linia; `zmien` zmienia termin istniejącej karty bez nowej; saldo wykonuje się od razu; usunięcie przez dialog; po przeładowaniu podsumowanie, „Pominięto.” i wygasła propozycja; telefon 360 px bez przewijania w bok | scalone (#71) |
| 5a-11b | Ostatni element 6.10: pole „Napisz do Ex-us albo wpisz /” na ekranie Dziś (`features/today/ExusField.tsx`, karta pod powitaniem — od 2026-10-25 pod kartą punktów, a przy wyłączonych „Statystykach XP” na jej miejscu (decyzja właściciela; e2e sprawdza kolejność i położenie na 360 px), tylko gdy moduł Ex-us jest włączony; tylko komponenty `ui`, jedna linia podpowiedzi zamiast palety `/`). Wysłanie przechodzi do `#/exus` i przekazuje tekst w pamięci (`stores/exusFocus` `exusHandoff`, jak sygnał fokusu z 5a-11a), więc nie trafia do adresu ani historii przeglądarki; ekran Ex-us wysyła go raz, po wczytaniu zapisanej rozmowy, tym samym silnikiem co własne pole (`send(text)`). E2E: `/dzis` z Dziś → `#/exus` z odpowiedzią, tekst poza URL, powrót i ponowne wejście nie wysyła drugi raz; zwykły tekst → odpowiedź AI (fałszywy model); moduł wyłączony → brak pola; 360 px bez przewijania w bok | scalone (#72) |

**Etap 5b: kod gotowy (2026-10-25), czeka na deploy.** DoD z tabeli 9 w testach: dokładnie 1 wywołanie `exusTurn` na wiadomość (e2e liczy żądania, test funkcji liczy wywołania modelu), akcje z AI przechodzą ten sam pipeline (karty, dialog, cofanie). Część DoD wymaga prawdziwego deployu i konta — etap zamyka właściciel po liście niżej.

**Do sprawdzenia po deployu (5b)** — przeniesione do wspólnej listy właściciela dla 5b i 6 (niżej, po etapie 6).

**Etap 6 (plan, 2026-10-25)** — rodzic, raport, push. Stan v1, na którym opiera się podział: `parent.html` (panel tylko
do odczytu, zapytanie `users where parentEmail == e-mail rodzica`; twarde 10 pkt = 1 zł i lista pięciu rodzajów aktywności — B10;
cel pieniężny liczony od salda zamiast `saved`; czas grania z `dailyLog.gamingMinutes`; zakupy z martwego sklepu — B14; tylko PL — B21),
`scripts/send-weekly-report.js` + `email-templates/weekly-report.html` (EmailJS REST z kluczem prywatnym; czyta `moneyGoals`
zamiast `users.goals`, pola transakcji i kursy nie z profilu, saldo punktów po stałym kursie, `purchases`; w logach imię i adres
rodzica — w publicznym repo niedopuszczalne; workflow usunięty 19.08 — R10, D2), push: `settings.js` zapisuje `fcmTokens/{token}`
i `notifHours`, `sw.js` v1 pokazuje powiadomienie i obsługuje kliknięcie, `scripts/send-notifications.js` wysyła co godzinę
(link do `app.html`; workflow też usunięty). 4g-1 dał w v2 weryfikację e-maila rodzica jak v1 (kod w kliencie, B12/R17) i przełącznik
`autoReport`, którego nic jeszcze nie czyta. R7: push tylko w v1 do cutover.

| PR | Zakres | Stan |
|---|---|---|
| 6-1 | Domena widoku rodzica i raportu (`domain/parent.ts`, czysta, testy `domain/parent.test.ts`; razem z domeną 6-3). `parentSummary(input, now)` dla widoku rodzica: punkty (saldo, dziś, wydane łącznie) z wartością w zł po kursie ogólnym z profilu, poziom (`levelOf`), seria (`streakOf`, G3), punkty i granie z ostatnich 7 dni UTC jak v1 (`statsWeeks`, dane do `BarChart`), granie dziś i w 7 dni, 10 ostatnich zakupów, 10 ostatnich aktywności z nazwami (`activityName`), 3 najczęstsze aktywności z 7 dni (`topActivities`), cele z `users.goals` (`goalProgress`), nierozliczone obowiązki po `rateChores` (`unpaidChores`) i 12 ostatnich wypłat, saldo Money. Transakcji Money widok rodzica nie dostaje: v1 `parent.html` ich nie pokazuje, a reguły dają je tylko właścicielowi. `weeklyReport(input, weekStart)` dla e-maila: tydzień pon.–niedz. w Europe/Warsaw (`reportWeekStart(now)`, nowe `lib/dates` `zonedDayKey`), te same sekcje co szablon v1 (punkty tygodnia i po dniach, saldo punktów w zł, czas grania, zakupy, Money: saldo, wpływy i wydatki miesiąca, limit, 3 największe kategorie, cele) jako liczby w groszach; `reportRecipient(profile)` — adres tylko przy `autoReport` i potwierdzonym e-mailu rodzica. Kwoty w groszach, daty przez `lib/dates`, bez nowych pól Firestore (`Purchase` to typ domeny; konwerter `purchases` dojdzie w 6-2). **Różnice wobec v1** (każda ma test „Różnica n”): (1) punkty w zł po kursie ogólnym z profilu, nie stałe 10 pkt = 1 zł (B10; saldo, wydane, raport); (2) obowiązki do wypłaty po `rateChores` z profilu, nie stałe 0,45 zł/pkt; (3) cel pieniężny u rodzica liczony z `saved`, nie z salda Money (B10); (4) cele w raporcie z `users.goals` (pieniężne z `saved`, punktowe w punktach), nie z legacy `moneyGoals`; (5) raport za tydzień kalendarzowy pon.–niedz. w Europe/Warsaw, nie 7 dni wstecz od chwili wysyłki: `dailyLog` pod kluczami dni tego tygodnia (klucze nadal UTC, G13), zakupy po dniu w Warszawie i wszystkie, nie tylko spośród 20 najnowszych; Money za miesiąc niedzieli tygodnia do tej niedzieli, nie za miesiąc UTC chwili wysyłki; (6) raport tylko na potwierdzony adres rodzica (v1 wysyła na każdy `parentEmail`); (7) nazwy aktywności z `activityDefs` (najpierw zapisana nazwa, na końcu surowe id), nie stała lista pięciu rodzajów z `parent.html` (B10). Nowe u rodzica (addytywnie): punkty dziś, poziom, seria, granie dziś, najczęstsze aktywności tygodnia. Właściciel: nie | scalone (#75) |
| 6-2 | Route `#/parent` w v2 na domenie 6-1 (`features/parent/ParentPage.tsx`, `stores/parent.ts`, `data/repos/parent.ts`, nowy konwerter `data/converters/purchases.ts`). **Kto jest rodzicem:** jak w v1 i w regułach — nie ma roli ani flagi na koncie rodzica; rodzicem jest zalogowany adres, który dziecko wpisało jako `parentEmail` (reguła `isParentOfDoc`: `parentEmail == request.auth.token.email`). Po zalogowaniu v2 raz pyta `users where parentEmail == e-mail z Auth` (zapytanie musi mieć ten filtr, bo reguła sprawdza każdy zwrócony dokument); „Rodzic” jest w menu (druga grupa) tylko przy co najmniej jednym dziecku, konto dziecka i zwykłe konto go nie widzą. Bezpośredni `#/parent` bez dzieci pokazuje to, co v1: „Brak powiązanych kont” z adresem i instrukcją (Ustawienia → E-mail rodzica). Rodzic bez własnego profilu LifeXP (v1 `parent.html` wpuszcza każde konto Auth) dostaje `#/parent` przed bramkami profilu, na prostej stronie z „Wyloguj”. **Dane:** jednorazowe odczyty jak v1 (bez nasłuchu, bez zapisu), tylko to, co reguły dają rodzicowi: profil dziecka z zapytania, cały `dailyLog`, 10 najnowszych aktywności i wszystkie z 7 dni, `activityDefs`, `chores`, 12 wypłat, 10 zakupów, `money/balance`; bez `moneyTransactions`, `moneyCategories`, `moneyLoans`, `money/settings`. **Widok:** wybór dziecka (`SegmentedControl`, ponad 4 — `Select`), karta punktów (saldo, dziś, wydane, zł po kursie dziecka, poziom, seria), punkty 7 dni i granie 7 dni jako dwa osobne `BarChart` (granie dziś i w 7 dni nad wykresem), cele z postępem (pieniężne z `saved`), obowiązki do wypłaty po `rateChores` i historia wypłat, saldo Money, ostatnie zakupy, 3 najczęstsze aktywności z 7 dni, ostatnie aktywności; i18n PL/EN. `parent.html` v1 bez zmian (przekierowanie przy cutover, etap 7). E2E `tests/v2/parent.spec.js` z regułami produkcyjnymi: rodzic z dwójką dzieci widzi liczby domeny (kurs z profilu, cele z `saved`, obowiązki po kursie dziecka), oba wykresy, brak transakcji, przełączenie dziecka, żadnego zapisu (czasy aktualizacji dokumentów rodzica i dzieci bez zmian), 360 px bez przewijania w bok; konto bez dzieci i konto dziecka bez „Rodzic” w menu, `#/parent` z instrukcją; rodzic bez profilu; v1 `parent.html` pokazuje to samo saldo punktów. Bezpieczeństwo: reguły ufały adresowi z Auth także bez potwierdzenia (jak v1) — naprawione w regułach w 6-8 (`email_verified`), wymaga publikacji reguł. Właściciel: opcjonalnie wejście prawdziwym kontem rodzica | scalone (#76) |
| 6-3 | Czas grania i zakupy (sklep) u rodzica i w raporcie (decyzja właściciela 2026-10-25, pkt 1). Domena gotowa razem z 6-1 w `domain/parent.ts`: granie z `dailyLog.gamingMinutes` (dziś, 7 dni i po dniach u rodzica; suma tygodnia w raporcie), zakupy z `purchases` jako typ `Purchase` (opis, kwota w groszach, koszt w punktach, czas): 10 najnowszych u rodzica, w raporcie liczba, suma zł i punktów zakupów z tygodnia. Tylko odczyt istniejących pól v1; v2 nadal nie ma sesji grania (decyzja przy 5a-9), więc dane pochodzą z v1. Domena scalona w #75; konwerter `purchases` (`data/converters/purchases.ts`) i pokazanie u rodzica (granie dziś i w 7 dni, wykres grania, ostatnie zakupy, e2e na zasianych danych) idą z 6-2; zostaje pokazanie w e-mailu (6-5). Właściciel: nie | częściowo: domena scalona (#75), widok w 6-2, e-mail w 6-5 |
| 6-3b | Powiadomienie rodzica (decyzja właściciela 2026-10-25, pkt 1, doprecyzowana: kanał e-mail przez ten sam mailer EmailJS, próg grania 60 min dziennie, zakup zawsze, najwyżej 1 e-mail dziennie na rodzaj). **Wyzwalacz:** Firestore 2. generacji w `lifexp-v2`, bo jest najtańszy i natychmiastowy: `parentAlertOnGaming` = `onDocumentWritten` na `users/{uid}/dailyLog/{day}` (e-mail tylko, gdy `gamingMinutes` przechodzi z < 60 na ≥ 60; dzień = klucz `dailyLog`, czyli dzień UTC jak G10), `parentAlertOnPurchase` = `onDocumentCreated` na `users/{uid}/purchases/{id}` (dzień warszawski). Region `europe-west1`: baza jest w `eur3`, a firebase-tools dla wyzwalaczy Firestore mapuje `eur3` → `europe-west1` (`FIRESTORE_DUAL_REGION_TO_REGION_MAPPING`; region zdarzenia CLI ustawia sam na lokalizację bazy). Uwaga: `purchases` zapisuje tylko martwy sklep v1 (B14), więc e-mail o zakupie w praktyce przyjdzie rzadko; „wydatek” w Money to inna rzecz i nie wyzwala powiadomienia. **Komu:** czysta funkcja domeny `alertRecipient` (`domain/parent.ts`, wspólna przez `gen:shared-domain`): potwierdzony adres rodzica, konto nie `solo`, nowe pole `parentAlerts` (addytywne, brak = włączone; konwerter v2 z domyślnym `true`; przełącznik „Powiadomienia dla rodzica” w Ustawieniach → Konto, tylko konto nadzorowane); `autoReport` nie jest potrzebny. **Raz dziennie na rodzaj:** `parentAlertLog/{uid}_{dzień}` (reguła `if false`) zajmowane w transakcji przed wysyłką, zwalniane po błędzie poczty. W logach tylko rodzaj i wynik. Fałszywa poczta w emulatorze (`emulatorMail/{uid}_alert_{rodzaj}`). **Szablon:** nowy (szablony kodu i raportu mają inne pola) — gotowa treść w `email-templates/parent-alert.html` (zmienne `to_email`, `user_name`, `alert_subject`, `alert_body`, `alert_day`; temat `{{alert_subject}}`), id w stałej `PARENT_ALERT_TEMPLATE_ID` (`functions/src/alerts/config.ts`, na razie `null`: funkcja niczego nie wysyła i loguje `templateMissing`). Przy okazji naprawiony błąd, który dotknąłby produkcję: `firebase-functions` tworzy dla zdarzeń Firestore własną nazwaną aplikację Admin, a `shared/admin.ts` sprawdzał tylko „czy jest jakakolwiek aplikacja”, więc domyślna nie powstawała — teraz sprawdza aplikację `[DEFAULT]` po nazwie (test). Testy: jednostkowe (przekroczenie progu raz, bez ponownego powyżej progu, następny dzień znowu, zakup raz dziennie, rodzaje osobno, solo/niepotwierdzony/wyłączone bez e-maila, brak szablonu, błąd poczty, brak danych osobowych w logach, parametry = zmienne z pliku szablonu), domena (`alertRecipient`, `gamingCrossed`), konwerter (`parentAlerts` domyślnie włączone), e2e `tests/v2/parent-alerts.spec.js` (wyzwalacze w emulatorze Functions: 61 min i zakup dają po jednym e-mailu, przełącznik wyłącza). Lokalnie w piaskownicy z proxy emulator musi startować bez `https_proxy` (firebase-tools rejestruje wyzwalacze Firestore przez proxy, ignorując `NO_PROXY`); na CI bez zmian. **Do zrobienia przez właściciela:** (1) w EmailJS utworzyć szablon z `email-templates/parent-alert.html` (instrukcja w pliku) i wpisać jego id do `PARENT_ALERT_TEMPLATE_ID` (mały PR); (2) deploy `npm run deploy` w `functions/` i reguły; (3) sprawdzić prawdziwy e-mail: na koncie dziecka z potwierdzonym adresem zapisać godzinę grania w v1 | scalone (#80) |
| 6-4 | Kod e-maila rodzica na serwerze (B12, R17): `sendParentEmailCode` i `verifyParentEmailCode` (`onCall`, codebase `lifexp-v2`, `europe-west1`, `maxInstances` 2; `functions/src/parent/`). Wysyłka: logowanie wymagane, adres przez zod (regex v1, maks. 254 znaki; v1 nie zabrania własnego adresu, więc i serwer nie), limity na konto 3 kody na 15 min i 10 na 24 h (lista czasów wysyłek w dokumencie kodu), kod 6 cyfr z `crypto.randomInt`, w nowej kolekcji `parentEmailCodes/{uid}` tylko skrót scrypt z solą, termin 10 min, liczba prób i oczekujący adres (reguła `allow read, write: if false`); poczta przez REST API EmailJS z szablonem v1 (`service_417sg11`/`template_f2b4jeo`, klucz publiczny) i kluczem prywatnym `accessToken` z sekretu `EMAILJS_PRIVATE_KEY`; po wysyłce w `users/{uid}` tylko `pendingParentEmail` (a kod v1 z profilu jest usuwany); odpowiedź `{ sentTo: zamaskowany, expiresAt }`; nieudana wysyłka liczy się do limitu, nie zostawia kodu ani oczekiwania. Sprawdzenie: logowanie, maks. 5 prób (piąta zła kończy kod i oczekujący adres), termin, porównanie w stałym czasie, kod liczy się tylko dla adresu, który nadal czeka w profilu (anulowanie albo nowy adres w v1 go unieważnia); sukces w transakcji zapisuje dokładnie pola v1 (`parentEmail`, `parentEmailVerifiedAt` ISO, usuwa `pendingParentEmail`, `parentEmailCode`, `parentEmailCodeExpiry`) i kasuje dokument kodu. Błędy to `HttpsError` z `details.reason` i komunikatem PL/EN; w logach nigdy adres ani kod. Fałszywa poczta tylko w emulatorze Functions (`FUNCTIONS_EMULATOR`), zapisuje ostatni kod w `emulatorMail/{uid}` (reguła `if false`); test dowodzi, że poza emulatorem nie powstanie. Klient v2: Ustawienia wołają funkcje (leniwe `data/functions.ts`), przepływ 4g-1 w kliencie zostaje jako zapasowy za stałą `PARENT_CODE_SERVER` w `services/parent-email.ts`: w buildzie produkcyjnym `false` (działa bez wdrożonych funkcji), na emulatorach serwer, a testy 4g-1 włączają klienta kluczem w sessionStorage. Dziura B12 zostaje dla v1 do etapu 7/8: v1 nadal zapisuje `parentEmail` i kod w profilu po stronie klienta, a reguły na to pozwalają; kod wysłany przez serwer v1 uzna za brak kodu. Testy: jednostkowe funkcji (bez logowania, zły adres, limity, tylko skrót w bazie i w logach, termin, 5 prób, zły kod, nowy kod zastępuje stary, dobry kod zapisuje pola v1, fałszywa poczta niemożliwa w produkcji, żądanie EmailJS z `accessToken`), e2e `tests/v2/parent-email-server.spec.js` na emulatorze Functions (kod z fałszywej poczty, weryfikacja, 5 złych kodów, odrzucona wysyłka, limit, v1 pokazuje adres jako potwierdzony), testy 4g-1 bez zmian dla zapasowego przepływu. **Do zrobienia przez właściciela:** (1) dodać sekret `EMAILJS_PRIVATE_KEY` w Secret Manager (`firebase functions:secrets:set EMAILJS_PRIVATE_KEY`; to ten sam klucz prywatny EmailJS, który był sekretem GitHub dla raportu); (2) wdrożyć `npm run deploy` w `functions/` (tylko `functions:lifexp-v2`) i wgrać reguły; (3) po deployu przełączyć `PARENT_CODE_SERVER` na `true` (osobny mały PR) i sprawdzić prawdziwy e-mail z kodem | scalone (#77) |
| 6-5 | Raport tygodniowy od nowa na wspólnej domenie (6-1) w funkcjach `lifexp-v2` (`functions/src/report/`). **Wspólna domena:** funkcje liczą raport tym samym `weeklyReport` co testy v2 — `npm run gen:shared-domain --prefix v2` kopiuje `v2/src/domain/parent.ts`, `lib/money.ts` i wszystko, co importują (razem 12 plików: 10 z `domain`, `lib/dates`, `lib/money`), dosłownie do `functions/src/v2/` z importami `@/` zamienionymi na względne i nagłówkiem „GENERATED”; test v2 (`tools/shared-domain.test.ts`) pada, gdy kopia jest nieaktualna, a ścisły `tsc` funkcji ją typuje (jak `schema.gen.json`; funkcje wdrażają tylko swój katalog, więc wspólna ścieżka poza nim odpada). Dane z Admin SDK tylko do tego, co czyta szablon: profil (konwersja jak konwertery v2), `dailyLog` siedmiu dni, zakupy od dnia przed poniedziałkiem, transakcje miesiąca niedzieli do niedzieli, `money/balance`, `money/settings`; parametry szablonu EmailJS v1 (`template_jztwowz`, `email-templates/weekly-report.html` bez zmian) w formatach v1 („12.50 zł”, „1h 5m”), cele z `users.goals` (pieniężne z `saved`, punktowe w pkt), wysyłka przez mailer z 6-4 (fałszywy w emulatorze, `emulatorMail/{uid}_report`). Tylko konta z `autoReport` i potwierdzonym adresem (`reportRecipient`); raz na tydzień warszawski: `lastReportSent` (pole v1, dzień `YYYY-MM-DD`) zajmowane w transakcji przed wysyłką i oddawane, gdy poczta zawiedzie; po 5 kont naraz; błąd jednego konta nie zatrzymuje reszty; w logach tylko liczby (wysłane, pominięte, już wysłane, błędy). **Ręczny test właściciela:** callable `sendMyReportNow` (logowanie; raport własnego konta na własny potwierdzony adres rodzica, `dryRun` zwraca same parametry; maks. 3 wysyłki na 24 h w `weeklyReportRuns/{uid}`, reguła `if false`; nie rusza `lastReportSent`), bo harmonogram to tylko niedziela. Testy: jednostkowe (tylko uprawnione konta, liczby zasianego konta = `weeklyReport` wywołany wprost, zmienne szablonu z pliku HTML, raz na tydzień i znowu w następnym, błąd jednego konta, brak danych osobowych w logach, `sendMyReportNow` z limitem i dry-run), e2e `tests/v2/weekly-report.spec.js` (bez przeglądarki: `sendMyReportNow` przez HTTP na emulatorze Functions, poczta w fałszywej skrzynce). Stary `scripts/send-weekly-report.js` zostaje do sprzątania w etapie 8 (niczym nie jest uruchamiany). **Do zrobienia przez właściciela:** (1) sekret `EMAILJS_PRIVATE_KEY` (jak w 6-4), deploy `npm run deploy` w `functions/` i reguły; (2) na koncie z `autoReport` i potwierdzonym adresem rodzica wywołać `sendMyReportNow` (najpierw `{ dryRun: true }`, potem bez) i sprawdzić prawdziwy e-mail; (3) w poniedziałek po pierwszej niedzieli sprawdzić w logach `weeklyParentReport` liczby | scalone (#78) |
| 6-6 | Harmonogram raportu: `weeklyParentReport` (`onSchedule`, `europe-west1`, strefa Europe/Warsaw, niedziela 9:00 — workflow v1 chodził w niedzielę o 8:00 UTC, czyli 9:00 zimą i 10:00 latem; raport obejmuje pon.–niedz. do chwili wysyłki jak w v1; `maxInstances` 1, sekret `EMAILJS_PRIVATE_KEY`). Bez GitHub Actions: workflow `weekly-report.yml` nie istnieje w repo od 19.08 (commit d841f58 skasował cały `.github/workflows`, przywrócone zostały tylko deploy, fps, inventory i test), więc nie ma czego usuwać. Emulator Functions nie uruchamia harmonogramów (brak pubsub), dlatego kod przebiegu jest testowany jednostkowo, a ścieżka Firestore → domena → poczta przez `sendMyReportNow` na emulatorze. Właściciel: deploy (6-5) | scalone (#78) |
| 6-7 | Przypomnienia push od teraz (decyzja właściciela 2026-10-25, pkt 4). **Reguły** w czystej domenie v2 `domain/reminders.ts` (testy tabelaryczne; funkcje dostają ją przez `gen:shared-domain`): (a) **passa w niebezpieczeństwie** — seria (G3, dni UTC jak `dailyLog`) ma co najmniej `STREAK_REMINDER_MIN` = 2 dni licząc do wczoraj, dziś 0 punktów, a zamrożenie nie jest dostępne (gdy jest, przykryłoby dziś i seria i tak przetrwa), moduł „Statystyki XP” włączony; (b) **obowiązki pod koniec miesiąca** — w ostatnich `CHORES_REMINDER_LAST_DAYS` = 7 dniach miesiąca (dzień warszawski), są definicje obowiązków, przez `CHORES_QUIET_DAYS` = 3 dni (z dziś) nie zapisano żadnego, najwyżej co `CHORES_REMINDER_EVERY_DAYS` = 2 dni, moduł obowiązków włączony (porównanie z poprzednim miesiącem odpada: v1 kasuje wpisy przy wypłacie, więc punktów zeszłego miesiąca zwykle już nie ma). Tylko o godzinach z `notifHours` (zegar warszawski, jak stary skrypt), najwyżej jedno na godzinę i `REMINDERS_PER_DAY` = 2 na dzień, każdy rodzaj raz dziennie, passa przed obowiązkami. **Wysyłka:** `pushReminders` (`onSchedule` co godzinę o pełnej, Europe/Warsaw, `europe-west1`, bez sekretu — FCM przez domyślne poświadczenia Admin SDK) pyta `users where notifHours array-contains <godzina>` (włączone powiadomienia w v1 = tokeny w podkolekcji `users/{uid}/fcmTokens/{token}` `{token, createdAt, ua}` plus wybrane godziny; pola `notifEnabled` nie ma), zajmuje godzinę i rodzaj w `pushLog/{uid}_{dzień warszawski}` (transakcja; po błędzie FCM zwalnia), wysyła `sendEachForMulticast` w kształcie, który czyta `sw.js` v1 (`notification.title/body`, `webpush.fcmOptions.link`), teksty PL/EN z `lang` profilu, bez grywalizacji. Link: `…/lifexp-app/app.html` jak w starym skrypcie — adres jest poprawny (Pages), więc nie było czego poprawiać poza tym, że stoi teraz w jednej stałej `APP_URL`; przy cutover zmieni się na v2. Martwe tokeny (`registration-token-not-registered`, `invalid-registration-token`) są kasowane jak w v1 — to dokumenty podkolekcji, nie tablica, więc `arrayRemove` nie dotyczy. Po 5 kont naraz, błąd jednego nie zatrzymuje reszty, w logach tylko liczby. Fałszywe FCM tylko w emulatorze (`emulatorPush/{uid}`, „dead…” = martwy token), test dowodzi, że poza emulatorem nie powstanie. Reguły: `pushLog` i `emulatorPush` zamknięte. **Test właściciela:** callable `sendMyPushNow` (logowanie, powiadomienie testowe na własne urządzenia, `dryRun` zwraca payload i liczbę urządzeń, najwyżej 3 na dzień w `pushLog`, nie zużywa dziennych przypomnień). Testy: jednostkowe (reguły z granicą dnia UTC i godzinami w Warszawie, obowiązki, limity godzina/dzień/co drugi dzień, ponowny przebieg godziny, sprzątanie tokenów, kształt payloadu sprawdzony z `sw.js`, brak danych osobowych w logach, błąd jednego konta, fałszywe FCM niemożliwe w produkcji) i `tests/v2/push.spec.js` (HTTP na emulatorze Functions: `dryRun`, wysyłka, martwy token, brak tokenów). Przy okazji: puste stany na `#/parent` sprawdzone pomiarem — wszystkie, z „Brak wypłat.”, mają ten sam `EmptyState` (20 px, 600) w tej samej karcie; test e2e pilnuje, by tak zostało. **Do zrobienia przez właściciela:** (1) deploy `npm run deploy` w `functions/` i reguły; (2) na telefonie z włączonymi powiadomieniami w v1 (Ustawienia → powiadomienia i godzina) wywołać `sendMyPushNow` (`{ dryRun: true }`, potem bez) i sprawdzić, że przychodzi i otwiera aplikację; (3) po pierwszym dniu sprawdzić w logach `pushReminders` liczby | scalone (#79) |
| 6-8 | **A. Push w SW v2** (`src/sw.ts`, scope `/v2/`): obsługa `push` i `notificationclick`, bez subskrypcji, `getToken` i zapisu tokenów do cutover (R7), więc do tego czasu handlery czekają bezczynnie. Czysty moduł `src/swPush.ts` (testy jednostkowe): czyta payload, który wysyła `pushReminders` (`notification.title/body`, link z `fcmOptions`/`webpush.fcmOptions`, a dla wiadomości z samym `data` — `data.title/body/link`; bez tytułu „LifeXP”, tekst zamiast JSON jako treść), pokazuje powiadomienie z ikoną z manifestu v2, a adres kliknięcia liczy z payloadu: link względny względem scope, bezwzględny tylko z naszego origin i http(s), wszystko inne (obca domena, `javascript:`, `data:`) → start v2. Klik: okno v2 jest używane ponownie tylko dla adresu w scope v2 (fokus i przejście), link poza nim (np. v1 `app.html` do cutover) otwiera nowe okno. E2E w `tests/v2/sw-push.spec.js` (SW dozwolony, `channel: 'chromium'`, bo domyślny na CI headless shell zawsze odmawia zgody na powiadomienia): wiadomość przez CDP `ServiceWorker.deliverPushMessage`, powiadomienie z tytułem, treścią, ikoną i adresem; obcy link zamieniony na start. **B. Reguły (poprawka bezpieczeństwa):** rodzic (`isParentOfDoc`, `isParentOf`) i admin zgłoszeń (`isBugAdmin`) wymagają `request.auth.token.email_verified == true` (`hasVerifiedEmail`). Google jest zawsze potwierdzony; konta e-mail + hasło potwierdzane kodem v1 mają tylko flagę w profilu, nie w Auth, więc rodzic z takim kontem musi raz otworzyć link Firebase: v2 `#/parent` dla niepotwierdzonego adresu nie pyta o dzieci, tylko pokazuje „Najpierw potwierdź swój adres e-mail” z przyciskami „Wyślij link” (`sendEmailVerification`) i „Sprawdź ponownie” (przeładowanie konta i tokenu). Testy: reguły przez REST emulatora (potwierdzony rodzic czyta dziecko i jego `dailyLog`, to samo konto bez potwierdzenia dostaje 403), przepływ z linkiem z emulatora Auth, v1 `parent.html` dla potwierdzonego rodzica bez zmian. **Do zrobienia przez właściciela:** (1) opublikować reguły (`firestore.rules`) i wdrożyć v2; (2) rodzicowi z kontem e-mail + hasło (bez Google) przekazać: wejść w v2 `#/parent`, „Wyślij link”, otworzyć link z e-maila, „Sprawdź ponownie” — do tego czasu `parent.html` v1 pokaże mu błąd wczytania; (3) konto admina zgłoszeń musi mieć potwierdzony adres (logowanie Google albo ten sam link) | scalone (#81) |
| beta-1 | Beta v2 dla wszystkich kont (prośba właściciela 2026-10-25). **v1:** pasek u dołu `app.html` (`beta-banner.js`, pokazuje go `core.js` po starcie każdemu zalogowanemu kontu; bez listy dostępu, bez odczytu i zapisu w Firestore, bez analityki): „Nowa wersja LifeXP (beta) jest gotowa do testów.”, „Wypróbuj” → `v2/`, „Nie teraz” chowa na 7 dni (`localStorage` `lifexp-beta-banner-dismissed-until`). Siedzi nad dolnym paskiem nawigacji (na desktopie obok bocznej kolumny), `.main` i FAB-y przesuwają się o jego wysokość; język z ustawień v1, motywy LifeXP/Apple/Gold, 360 px. Nie ma go na `parent.html`, `verify.html`, logowaniu ani `fps.html`. `sw.js`: plik w `STATIC`, `CACHE` v57. **v2:** w menu znaczek „Beta” przy nazwie i „Wróć do starej wersji” (`../app.html`, ikona + tekst) nad kontem. Testy: `tests/beta-banner.spec.js` (hermetyczne), `tests/emulator/beta-banner.spec.js` (prawdziwy start v1), `tests/v2/shell.spec.js` | w toku |

**Pytania do właściciela przed etapem 6:**
1. Czas grania i zakupy u rodzica i w raporcie (6-3, dotyczy gier): (a) pokazywać jak v1 z `dailyLog.gamingMinutes` i `purchases`, (b) usunąć z widoku i raportu, (c) zostawić do rozmowy o grach — przy Tobie.
2. Raport tygodniowy: (a) skrypt Node + GitHub Actions jak v1 (sekrety w repozytorium, bez deployu), (b) funkcja harmonogramowana w `lifexp-v2` (sekret w Secret Manager, wymaga deployu, koniec zależności od Actions).
3. Wysyłka kodu e-maila rodzica z serwera (6-4): (a) EmailJS REST z kluczem prywatnym jako sekret (czy klucz istnieje — ten sam, którego używał raport?), (b) inny dostawca poczty, (c) zostawić 4g-1 jak v1 do cutover i przenieść dopiero w etapie 7.
4. Przypomnienia push przed cutoverem (6-7): (a) przywrócić teraz wysyłkę dla v1, (b) wrócić do push dopiero w v2 przy cutover (etap 7), (c) wcale — przypomnienia niepotrzebne.

**Decyzje właściciela (2026-10-25):**
1. Czas grania i zakupy w sklepie są pokazywane u rodzica i w raporcie (6-3). Nowe: rodzic dostaje też powiadomienie, gdy
   dziecko zagra określony czas albo coś kupi (6-3b); próg i kanał ustalamy w tym kroku.
2. Raport tygodniowy to funkcja harmonogramowana w codebase `lifexp-v2` (`onSchedule`, Europe/Warsaw), nie GitHub Actions (6-5, 6-6).
3. Dostawca poczty: zostaje EmailJS; właściciel ma już klucz EmailJS. Dlaczego to nadal najlepszy wybór: aplikacja nie ma
   własnej domeny (Pages na github.io), więc Resend, SendGrid czy Postmark wymagałyby weryfikacji domeny, żeby wysyłać do
   dowolnych rodziców; szablony już istnieją; REST API EmailJS przyjmuje klucz prywatny po stronie serwera. Odrzucona
   alternatywa: SMTP przez nodemailer z hasłem aplikacji — wysyłka z prywatnej skrzynki i słaba dostarczalność. Wysyłka
   z serwera (6-4, 6-5, 6-3b) idzie przez REST API EmailJS z kluczem prywatnym jako sekret Secret Manager
   (np. `EMAILJS_PRIVATE_KEY`), nigdy w repo.
4. Przypomnienia push wracają teraz, z nową treścią: passa, która dziś przepadnie, i obowiązki, gdy do końca miesiąca
   zostało mało czasu, a osoba może jeszcze coś zrobić. Wysyła je funkcja harmonogramowana w `lifexp-v2` na istniejące
   tokeny v1 (`fcmTokens`) w godzinach z `notifHours`, więc działają w v1 od razu i przechodzą do v2 przy cutover (6-7).
   Dawne godzinne przypomnienia v1 nie wracają w starej postaci.

**Etap 6: kod gotowy (2026-10-25), czeka na deploy i sprawdzenie przez właściciela.** W repo: widok rodzica `#/parent` (6-1, 6-2, 6-3),
kod e-maila rodzica na serwerze (6-4), raport tygodniowy jako funkcja harmonogramowana (6-5, 6-6), przypomnienia push (6-7),
powiadomienia dla rodzica (6-3b), push w SW v2 i reguły z potwierdzonym e-mailem (6-8). Wszystko przetestowane na emulatorach
(funkcje z fałszywą pocztą i fałszywym FCM). Przy okazji naprawiona niestabilność `/rozlicz` (test `exus.spec.js`): pytanie czytało
nasłuch, który tuż po wypłacie jeszcze miał skasowane wpisy (usunięcia z transakcji docierają do nasłuchu kolejnymi migawkami), więc
Ex-us pytał o ponowną wypłatę zamiast powiedzieć „Nie ma nic do rozliczenia.”; teraz pytanie i wypłata czytają nierozliczone wpisy z
serwera (test regresyjny `features/exus/choreHandlers.test.ts`). Etap zamyka właściciel po liście niżej.

**Lista właściciela po deployu (5b + 6)** — wymaga prawdziwych kont, sekretów, poczty i telefonu:
1. **Sekret:** `firebase functions:secrets:set EMAILJS_PRIVATE_KEY` — klucz prywatny EmailJS (ten sam, który był sekretem GitHub
   dla starego raportu). `GEMINI_API_KEY` już istnieje (używa go v1).
2. **Szablon EmailJS powiadomień:** utworzyć szablon z `email-templates/parent-alert.html` (instrukcja w pliku) i wpisać jego id do
   `PARENT_ALERT_TEMPLATE_ID` w `functions/src/alerts/config.ts` (mały PR). Do tego czasu powiadomienia dla rodzica nic nie wysyłają.
3. **Deploy funkcji:** `npm run deploy` w `functions/` (tylko `functions:lifexp-v2`: `exusTurn`, `sendParentEmailCode`,
   `verifyParentEmailCode`, `weeklyParentReport`, `sendMyReportNow`, `pushReminders`, `sendMyPushNow`, `parentAlertOnGaming`,
   `parentAlertOnPurchase`). Sprawdzić, że stare funkcje v1 dalej są na liście i Ex-us w v1 działa.
4. **Reguły:** opublikować `firestore.rules`. **Uwaga:** od tej chwili rodzic i admin zgłoszeń muszą mieć adres potwierdzony w
   Firebase Auth. Google jest zawsze potwierdzony; konto e-mail + hasło (potwierdzone tylko kodem v1) traci dostęp, dopóki rodzic nie
   wejdzie w v2 `#/parent`, nie naciśnie „Wyślij link”, nie otworzy linku z e-maila i nie naciśnie „Sprawdź ponownie” — uprzedzić
   takich rodziców przed publikacją (v1 `parent.html` pokaże im do tego czasu błąd wczytania).
5. **Kod e-maila rodzica na serwerze:** po deployu przełączyć `PARENT_CODE_SERVER` na `true` w `v2/src/services/parent-email.ts`
   (mały PR) i sprawdzić prawdziwy e-mail z kodem na koncie nadzorowanym.
6. **Ex-us AI (5b):** dodać własne konto do `aiTestAccess/{uid}` i sprawdzić prawdziwą odpowiedź `gemini-3.5-flash` (jeśli model albo
   `thinkingLevel: MINIMAL` zostanie odrzucony, poprawka to dwie stałe w `functions/src/exus/config.ts`); w logach jedno wywołanie
   Gemini na wiadomość i sensowna liczba tokenów; konto spoza `aiTestAccess` dostaje „Ex-us AI jest na razie w testach”; wyczerpany
   budżet daje komunikat i pasek na 0.
7. **Telefon (Ex-us):** „dodaj zadanie na jutro” daje kartę, „Wykonaj” zapisuje zadanie widoczne w v1; usunięcie idzie przez dialog;
   „zmień termin na piątek” zmienia kartę w miejscu; pole na „Dziś” otwiera Ex-us z odpowiedzią.
8. **Raport tygodniowy:** na koncie z `autoReport` i potwierdzonym adresem rodzica wywołać `sendMyReportNow` (`{ dryRun: true }`, potem
   bez) i obejrzeć prawdziwy e-mail; po pierwszej niedzieli sprawdzić w logach `weeklyParentReport` liczby.
9. **Push:** na telefonie z włączonymi powiadomieniami w v1 (Ustawienia, wybrana godzina) wywołać `sendMyPushNow` (`{ dryRun: true }`,
   potem bez): powiadomienie przychodzi i otwiera aplikację; po pierwszym dniu sprawdzić w logach `pushReminders` liczby.
10. **Powiadomienia dla rodzica:** po punkcie 2 zapisać w v1 godzinę grania na koncie dziecka z potwierdzonym adresem rodzica i
    obejrzeć e-mail; przełącznik „Powiadomienia dla rodzica” w Ustawieniach je wyłącza.
11. **Panel rodzica:** wejść na v2 `#/parent` prawdziwym kontem rodzica (opcjonalnie).



**Etap gier (decyzje właściciela 2026-10-26)**

1. v2 ma dokładnie 4 gry: Flappy Bird (piszemy sami), Wartime i Gridlock właściciela oraz „Szybkie liczenie”
   (liczenie w pamięci na czas, poziomy trudności, rekordy). Stare gry v1 (Coins, Snake, 2048, Redstone, FPS) nie
   przechodzą do v2; działają w v1 do cutover (D5).
2. Czas grania liczy się sam i nie kosztuje punktów. Zapis jak w v1 (`activities.js` `persistGamingSession`):
   `dailyLog/{dzień UTC}.gamingMinutes` w górę i dokument `gamingSessions` `{game, duration, date, timestamp}` tego
   samego kształtu i typów. (Kod v1 przy ręcznym logowaniu grania też nie odejmuje punktów — zapisuje tylko te dwie
   rzeczy.) Dzięki temu widok rodzica, raport tygodniowy i powiadomienie rodzica o 60 min (6-3b) widzą granie z v2.
   Komenda `/granie` zostaje poza Ex-us (5a-9): czas jest teraz automatyczny.
3. Wartime i Gridlock są kopiami w tym repo (`v2/public/games/<id>/`, publikowane pod `/v2/games/<id>/`). Nowa wersja
   gry = ponowne uruchomienie jednego skryptu `scripts/vendor-game.mjs <id> <katalog-źródła>` i commit wyniku.

| PR | Zakres | Stan |
|---|---|---|
| g-1 | Moduł `#/games` (rejestr: ścieżki `/games` i `/games/:id`, menu „Gry” z ikoną; id modułu `games` z v1 — ten sam przełącznik `enabledModules`, schemat bez zmian; `/idz gry` w Ex-us): karty 4 gier (nazwa, jedno zdanie, ikona, czas grania dziś z `gamingSessions` dnia UTC, „Graj” albo „Wkrótce”), każda gra pod własnym adresem, gra bez plików pokazuje „Wkrótce”. **Host gry** (`features/games/GameHost.tsx`): cały ekran nad powłoką (portal do `body`, obszary bezpieczne, przycisk „Zakończ”, prośba o obrót telefonu dla gier poziomych, np. Wartime), gra w `<iframe sandbox="allow-scripts allow-same-origin">` z pustym `allow`: gry trzymają zapisy i rekordy w `localStorage`, którego ramka z nieprzezroczystym originem nie ma, więc ramka jest same-origin; zaufanie opiera się na tym, co jest w ramce — wyłącznie kopie z repozytoriów właściciela z przypiętym commitem, bez skryptów zewnętrznych i z CSP tylko na ten origin (niżej). **Czas grania** (`domain/gaming.ts`, `services/gaming.ts`, `data/repos/gaming.ts`, `features/games/usePlayTime.ts`): liczy się tylko, gdy karta jest widoczna (`visibilitychange`); sesja krótsza niż 30 s nie jest zapisywana; minuty zaokrąglane do najbliższej pełnej (30 s = 1 min, jak całkowite minuty v1), najwyżej 1440 na sesję jak w v1; **północ UTC: cała sesja idzie na dzień UTC, w którym się kończy** (v1 zapisuje jeden dokument z jedną datą, a formularz podpowiada dzień zapisu, czyli po graniu), bez dzielenia. Zapis przy wyjściu („Zakończ”, „Wstecz”, zmiana ekranu) jednym atomowym batchem, nie transakcją (nic nie trzeba czytać, a batch Firestore kolejkuje offline): dokument sesji pod id nadanym na starcie + `dailyLog` przez `set` z `merge` i `increment` (`pointsEarned: increment(0)` daje dzień v1 `{pointsEarned: 0, gamingMinutes}` bez ruszania punktów); punkty profilu bez zmian. Karta ukryta: zegar staje, a kopia sesji czeka w `localStorage` (`lifexp-v2-gaming-pending`), bo telefon może zabić ukrytą kartę bez `pagehide`; `pagehide` zapisuje sesję „na próbę” i zostawia kopię; następne wejście w Gry zapisuje kopie innych wczytań strony transakcją tylko wtedy, gdy serwer nie ma dokumentu o tym id (po `waitForPendingWrites`), więc sesja trafia do bazy raz. **Skrypt kopiowania** `scripts/vendor-game.mjs` (użyty w g-2): tylko pliki gry z listy, łatki per gra, które muszą trafić dokładnie raz (Gridlock: bez skryptu CrazyGames SDK, kontrola `ADS_ENABLED = false`), CSP w każdej stronie gry (`default-src 'self'`, `connect-src 'self'`…), odmowa przy adresie zewnętrznego hosta albo niezapisanych zmianach w źródle, `VENDORED.json` (repozytorium, commit, data, łatki); `scripts/build-site.js` sprawdza, że każda gra w `/v2/games/` ma `index.html` i `VENDORED.json`. **SW v2:** gry poza precache (`globIgnores`, Wartime ma ok. 4,5 MB), cache `lifexp-v2-games` przy pierwszym graniu (stale-while-revalidate), trasa przed trasą nawigacji, więc strona gry w ramce nie dostaje powłoki aplikacji. Testy: domena (widoczność, minimum, zaokrąglenie, północ UTC, kopie), konwerter, skrypt kopiowania (`tests/vendor-game.spec.js`), e2e `tests/v2/games.spec.js` (lista na 360 px, gra testowa tylko na emulatorach z zegarem Playwright, przerwa w widoczności, krótka sesja, dzień z punktami, zamknięcie karty, kopia z zabitej karty zapisana raz, parytet: v1 zapisuje ten sam kształt i pokazuje sesję z v2 w historii) | scalone (#84) |
| g-2 | Wartime (commit 8713c35) i Gridlock (876da06) skopiowane skryptem z g-1 do `v2/public/games/<id>/` z `VENDORED.json`, w katalogu z „Graj”. **Aktualizacja gry**, gdy właściciel powie „jest nowa wersja X”: `git -C <klon> pull`, potem jedno polecenie — `node scripts/vendor-game.mjs wartime <klon-Wartime>` albo `node scripts/vendor-game.mjs gridlock <klon-gridlock>` — i `npm run test:v2` przed commitem (opis też w nagłówku skryptu). Bazowa CSP wystarcza obu grom bez wyjątków (żadnych skryptów inline, `eval`, workerów ani `fetch`; dane Wartime to pliki `.js`); każda strona gry dostaje `<link rel="icon" href="data:,">`, więc nie ma 404 favicony. Nowe w skrypcie: lista FORBIDDEN (gra działa na originie LifeXP, więc nie wolno jej czyścić całego `localStorage`/`sessionStorage`, kasować IndexedDB ani cache, rejestrować Service Workera ani czytać ciasteczek) i łatka Gridlocka: „Reset” kasuje tylko klucze `cm_*` zamiast `localStorage.clear()`, które skasowałoby motyw, szkice offline i kopie sesji grania. Ramka Wartime ma dodatkowo `allow-downloads` (eksport zapisu do JSON); Gridlock bez. Host na telefonie trzymanym poziomo (wysokość ≤ 500 px): pasek z „Zakończ” staje się wąską szyną po lewej, więc gra ma całą wysokość (menu Wartime potrzebuje ok. 350 px). ESLint v2 pomija `public/games`. E2E w `tests/v2/games.spec.js` (każde żądanie poza origin, naruszenie CSP, błąd konsoli i wyjątek = porażka): Wartime 800×360 — nowa gra, mapa, koniec tury, zapis w slocie, eksport pliku, przeładowanie i wczytanie, „Zakończ” zapisuje sesję; Wartime 360×800 dotykiem — prośba o obrót, stuknięcie w mapę wybiera państwo; Gridlock 360×800 dotykiem — start, dash, ukończona runda, monety po przeładowaniu, „Zakończ” zapisuje sesję. Do sprawdzenia przez właściciela na prawdziwym telefonie: przeciąganie i szczypanie mapy Wartime w ramce (Playwright nie umie gestów wielopalcowych) | scalone (#85) |
| g-3 | Flappy Bird — własna gra LifeXP, nie kopia: `v2/public/games/flappy/` (`index.html`, `style.css`, moduły ES w `js/`), w tej samej ramce `GameHost` i z tą samą CSP co kopie, tylko ostrzejszą (`style-src 'self'` bez `unsafe-inline`; żadnych skryptów inline, `eval` ani żądań). Zamiast `VENDORED.json` (który mówiłby nieprawdę o źródle) ma `GAME.json` z `"source": "lifexp"`; `scripts/build-site.js` przyjmuje jedno albo drugie i sprawdza CSP w `index.html` każdej gry, a `tests/vendor-game.spec.js` sprawdza pliki Flappy tymi samymi regułami co skrypt kopiowania (zewnętrzne hosty, FORBIDDEN, `eval`, jedyny klucz `localStorage`: `lifexp-flappy-best`). Kod według podziału na małe funkcje: czyste zasady w `logic.js` (fizyka, rury i granice szczeliny, kolizja okrąg–prostokąt z lekką tolerancją, punkty, stały krok 1/120 s z akumulatorem i interpolacją, bufor wejścia 130 ms), stany w `game.js` (gotowy → gra → spadanie po uderzeniu → koniec; po śmierci 0,55 s blokady, „Jeszcze raz” wyłączone do tego czasu), efekty w `effects.js` (squash przy machnięciu, krótki wstrząs i błysk przy śmierci, kilka iskier za punkt z puli; przy `prefers-reduced-motion` bez nich), rysowanie warstwami w `render.js` (własna grafika z kształtów canvas w kolorach LifeXP: fioletowe rury akcentu, żółty ptak, zielony brzeg ziemi, niebo z gwiazdami i paralaksą wzgórz), DOM i pętla w `main.js`. Ptak przechyla się z prędkością; trudność rośnie łagodnie (szczelina 176 → 138, prędkość 150 → 205 do 40 pkt); obraz ostry na ekranach high-DPI (`devicePixelRatio`, do 3); pionowo wypełnia ramkę, poziomo i na komputerze świat ma stałą wysokość i jest wyśrodkowany (szerokość 270–600 jednostek); ukryta karta zatrzymuje pętlę, a przerwana gra czeka na stuknięcie („Pauza”). Bez dźwięku. Teksty PL/EN: `GameHost` dodaje do adresu każdej gry `?lang=pl|en` (`frameSrc` w `catalog.ts`), gra ma własny mały słownik. `?seed=` (tylko testy): powtarzalne rury i pozycje ptaka i szczeliny w `data-debug-*`. ESLint v2 lintuje `public/games/flappy` (bez `eval`, HTML-a, globali i `localStorage.clear`), `tsconfig` (`allowJs`) sprawdza moduły z `// @ts-check`. Testy: `v2/tests/flappy.test.ts` (fizyka, granice szczelin, ziarno, odstępy rur, rampa, kolizje, punkty, krok stały przy 60/120/144 Hz, bufor, stany, efekty, język); e2e w `tests/v2/games.spec.js`: 360×800 dotykiem — start stuknięciem, punkt za rurę (autopilot w ramce), koniec gry, rekord po przeładowaniu, „Zakończ” zapisuje sesję „Flappy Bird”; 800×360 — świat na całą wysokość, spacja machnięciem, punkt; bez żądań poza origin, naruszeń CSP i błędów konsoli. Do sprawdzenia przez właściciela na prawdziwym telefonie: płynność przy 120 Hz i wyczucie sterowania | scalone (#86) |
| g-4 | Szybkie liczenie — druga własna gra LifeXP, tak jak Flappy: `v2/public/games/quick-math/` (`index.html`, `style.css`, moduły ES w `js/`), `GAME.json` z `"source": "lifexp"`, ta sama CSP (`style-src 'self'`), bez dźwięku, ekrany w DOM (bez canvas). **Pytania** (`questions.js`, czyste): Łatwy — + i − do 20, wynik nigdy poniżej zera; Średni — + i − do 100 (bez wyników ujemnych) i tabliczka mnożenia 2–10; Trudny — + i − liczb dwucyfrowych, × do 12, ÷ zawsze dokładne (dzielna budowana z iloczynu) i działania dwukrokowe z kolejnością działań (`7 × 8 − 9`, `20 − 3 × 4`); wynik ujemny tylko na Trudnym i rzadko, więc tylko tam jest klawisz minus; nigdy to samo pytanie dwa razy z rzędu; ziarno `?seed=`. **Runda** (`round.js`, czysta): 60 s, zegar idzie tylko, gdy pytanie czeka na odpowiedź; dobra odpowiedź = punkty poziomu (10/15/25) × mnożnik serii (×2 od 3 z rzędu, ×3 od 6, ×4 od 10); zła łamie serię, zabiera 3 s (nie poniżej zera) i przez 1,1 s pokazuje przekreśloną odpowiedź gracza i poprawną (`Poprawnie: 7 × 8 = 56 · −3 s`). Decyzja o wysyłaniu: odpowiedź jest przyjmowana sama w chwili, gdy wpisana liczba równa się wynikowi (dobra nie czeka na OK); zła tylko przez OK/Enter, więc gracz nigdy nie zostaje ucięty w połowie liczby. Klawisze wciśnięte w czasie krótkiej informacji zwrotnej czekają (do 4) i trafiają do następnego pytania. Tryb „Trening” bez zegara i bez rekordów, kończony przyciskiem. Ekran końca: punkty, trafność (z liczbą), odpowiedzi na minutę, najdłuższa seria, „Nowy rekord!” i rekordy wszystkich poziomów. **Rekordy** (`records.js`): `lifexp-quickmath-best-<poziom>`, wybór trybu w `lifexp-quickmath-mode`; nic poza tymi kluczami. **Sterowanie:** duża klawiatura numeryczna na ekranie (prawdziwe przyciski ≥ 48 px, wciśnięcie na `pointerdown`, więc szybkie stukanie nie gubi cyfr), „Usuń”, OK, minus tylko na Trudnym; klawiatura komputera: cyfry, Enter, Backspace, `-`, a na ekranie wyboru 1/2/3 = poziom. **Wygląd:** kolory LifeXP, zielony/czerwony błysk karty (tylko `opacity`), „+30” i puls serii (WAAPI), pasek czasu przez `transform: scaleX`, przy ≤ 10 s ostrzegawczy; przy `prefers-reduced-motion` bez animacji. Pytanie w regionie `aria-live` z wersją słowną dla czytnika („7 razy 8 minus 9”), wynik informacji zwrotnej w `role=status`. Poziomo (wysokość ≤ 520 px): pytanie obok klawiatury, ekran końca w dwóch kolumnach. Ukryta karta zatrzymuje zegar. `?round=<s>` skraca rundę tylko razem z `?seed=` (test). **Lista gier:** wszystkie cztery mają „Graj”; ścieżka „Wkrótce” usunięta (`SoonPage`, `games.soon`/`soonBody`, `src` w katalogu jest teraz wymagane), nieznany adres gry pokazuje „Nie ma takiej gry.”. ESLint i `tsconfig` obejmują `public/games/quick-math`; `tests/vendor-game.spec.js` sprawdza obie własne gry regułami skryptu kopiowania (CSP, hosty, FORBIDDEN, `eval`, tylko własne klucze `localStorage`). Testy: `v2/tests/quick-math.test.ts` (generator na 60 ziarnach × 120 pytań na poziom: całkowite wyniki zgodne z wyrażeniem, granice, dokładne dzielenie, brak powtórzeń; punkty i seria; kara czasowa i zegar; automatyczne wysyłanie i bufor; statystyki; rekordy, także przy zablokowanym magazynie; język i przełączniki testowe); e2e w `tests/v2/games.spec.js`: 360×800 dotykiem — poziom, odpowiedzi z klawiatury ekranowej, seria ×2, zła odpowiedź z poprawką i zerwaniem serii, koniec rundy ze statystykami, rekord po przeładowaniu, „Zakończ” zapisuje sesję „Szybkie liczenie”; komputer — klawiatura (1, cyfry, Backspace, Enter); 800×360 — Trudny z minusem, trening bez zegara i bez rekordu. Przy okazji: test „leaving by Back…” czekał tylko na widoczny host, a zegar grania startuje w efekcie po malowaniu, więc `fastForward` mógł go wyprzedzić; testy czekają teraz na fokus ramki (efekt w tym samym przebiegu). W tym PR także dwie poprawki z CI: (1) `ui/components/useModal` otwiera i zamyka `<dialog>` w efekcie układu (`useLayoutEffect`), nie po malowaniu — wcześniej po „Anuluj” odpowiedź „Anulowano…” była już na ekranie, a strona wciąż bezczynna (inert) pod zamykanym dialogiem, więc wiadomość wpisana od razu ginęła, a „Wyślij” wysyłało puste pole (test regresji w `tests/v2/exus.spec.js`); (2) alerty dla rodzica liczą „jeden e-mail na rodzaj dziennie” w dniu warszawskim dla obu rodzajów (granie liczyło się w dniu UTC dokumentu `dailyLog`, zakup w dniu warszawskim, więc od 22:00/23:00 UTC trafiały do różnych `parentAlertLog/{uid}_{dzień}`); próg grania nadal czyta `dailyLog` (dzień UTC, dane v1); test jednostkowy na 23:30 UTC | scalone (#87) |
| w-1 | Wave Rush — trzecia własna gra LifeXP (decyzja właściciela 2026-10-29), w stylu trybu „wave” z Geometry Dash, ale **oryginalna**: bez nazw, grafiki, ikon, dźwięków i układów poziomów GD. `v2/public/games/wave-rush/` (`index.html`, `style.css`, moduły ES w `js/`), `GAME.json` z `"source": "lifexp"`, ta sama CSP co Flappy (`style-src 'self'`), bez dźwięku i zewnętrznych plików; w katalogu „Wave Rush” (ikona `Activity`, `landscape`: host prosi o obrót telefonu, ale pionowo też się gra). **Ruch:** fala nigdy nie leci poziomo — trzymanie = w górę dokładnie pod 45°, puszczenie = w dół pod 45°, mini (od w-2) 2:1 (≈63,4°); fizyka nie ma stanu poziomego (`physics.js`: x, y, kierunek, grawitacja, rozmiar). **Bez ślizgu po podłodze i suficie:** każdy korytarz jest zamknięty terenem, wyjście poza pole gry to rozbicie. **Kolizja:** każdy dotyk bryły = rozbicie, z jednym wyjątkiem: zbocze 45° biegnące dokładnie w kierunku lotu można musnąć (liczy się tylko środek fali), razem ze wspólnym narożnikiem i powierzchnią tuż za nim, gdy fala od niej odlatuje; fala mini nie muska zboczy 45°. Kolce i półkolce mają trójkąt trafienia mniejszy od rysunku, piły i kule kolczaste koło trafienia 0,8 / 0,72 promienia (obrót tylko wizualny). **Prędkość:** mnożnik × 10,4 kratki/s (1,0 = „normalna”). **Sektory** (run = wszystkie po kolei; sekcje ręcznie zapisane w `js/sections/sector<n>.js`): 1 Łatwy — 10 sekcji, wszystkie tasowane, 0,5, korytarze ≥ 7 średnic fali; 2 Normalny — 15 sekcji, najpierw 1–5 tasowane, potem 6–15 tasowane, 0,5, więcej kolców i pił, ≥ 6 średnic; 3 Trudny — 15 sekcji jak w 2, 1,0, ≥ 4,5 średnicy (wąskie są tylko korytarze ukośne), dokładnie jeden portal grawitacji na granicy sekcji (losowany z ziarna, nigdy na starcie sektora) i portal z powrotem po dokładnie 2 sekcjach; portal stoi w otwartym wejściu sekcji (`PORTAL_OFFSET`), więc nigdy w przeszkodzie; nowy sektor zaczyna się w normalnej grawitacji. **Format sekcji** (`geometry.js`): sufit i podłoga jako profile tekstowe (`'2 r4 d3 u3 +1 -1'`: wysokość startowa, potem płasko, zbocze 45° w dół / w górę, schodek), przeszkody (`spike`, `halfSpike` na płaskim albo na bloku, `block`, `pillar`, `saw`, `orb`) i deko bez kolizji (`chain` z ornamentem, `star`, `diamond`, `gear`, `sawtooth`); każda sekcja zaczyna i kończy się złączem (sufit 2, podłoga 10, 2 kratki płasko, nic groźnego bliżej niż 2,5 kratki), więc pasuje do każdej kolejności. **Walidator** (`solver.js`, `prove.js`, test CI): czas pocięty na decyzje (n kroków fizyki), fala porusza się tylko ±nachylenie, więc stany to siatka; przebieg wstecz liczy najmniej zmian wejścia do końca sekcji przy ruchu otoczonym „pasem tolerancji” ±2·v·tolerancja i zmianach nie częściej niż minimalny odstęp; ścieżka jest potem odtwarzana fizyką gry (dokładne koło trafienia) — nominalnie i z każdym stuknięciem przesuniętym o ±tolerancję (naciśnięcie i puszczenie razem) — i sprawdzana na limit zmian na sekundę; dowód z każdej wysokości wejścia w złączu (co 0,5 kratki, poza pasem przy ścianach) i w każdym stanie sektora (obie grawitacje w 3). **Limity człowieka na próg** (`TIERS` w `config.js`; prędkość / min. odstęp zmian / tolerancja ± / korytarz w średnicach fali / maks. zmian na s): Łatwy 0,8 / 240 ms / 45 ms / 7 / 3,5; Normalny 0,8 / 210 / 40 / 6 / 4 (od w-3; w w-1 było 0,5 / 220 / 40 / 7 / 4 i 0,5 / 200 / 36 / 6 / 4,5); Trudny 1,0 / 170 / 30 / 4,5 / 5; Trudniejszy 1,1 / 160 / 28 / 4 / 5,5; Insane 1,3 / 150 / 25 / 3,5 / 6; Easy Demon 1,3 / 150 / 25 / 3,5 / 6; Hard Demon 1,5 / 140 / 23 / 3,2 / 6,5; Insane Demon 1,7 / 125 / 20 / 3 / 7; Extreme Demon 1,9 / 115 / 18 / 3 / 7,5 (Extreme nie ciaśniejszy niż Insane Demon — trudność z gęstości i pamięci). Płaski korytarz musi mieć co najmniej 2 · v · min. odstęp · nachylenie + średnica fali (`flatCorridorMinHeight`); test sprawdza wszystkie płaskie odcinki sekcji i dowodzi solverem, że taki korytarz (z pasem tolerancji) jest przelotny na każdym progu, a o 0,7 kratki niższy już nie. **Tryby:** Normalny — rozbicie = nowy run od sektora 1, sekcji 1 z nowym tasowaniem; wynik: sektor, sekcja i % całej trasy; rekord `lifexp-waverush-best` (tylko lepszy i od 1%); Praktyka — powrót do punktu kontrolnego tego samego runu: co sektor (domyślnie) albo co sekcję (przełącznik w menu), bez rekordów; szybki restart stuknięciem po 0,45 s blokady (stuknięcie tuż przed końcem blokady czeka 130 ms); licznik prób w HUD i łącznie w menu. Ukończenie sektora 3: „Ciąg dalszy wkrótce” i 100% (run kończy się na zbudowanych sektorach). **Skórki:** 10 własnych ikon fali z kolorami śladu, wszystkie od początku oprócz ostatniej („Korona Demona”, odblokowuje `demonComplete` w `lifexp-waverush-progress` — hak na w-2); ekran wyboru. Klucze wyłącznie `lifexp-waverush-*`. **Wygląd** (nie neon): każdy sektor ma własny motyw (laguna o zmierzchu, mesa o zachodzie, cytadela nocą) — niebo, daleki motyw (siatka kwadratów, słońce w pasy, księżyc z gwiazdami), sylwetki (wzgórza, mesy, wieże z oknami), kolumny z paralaksą, bloki z gradientem, wzorem (płytki, cegły, panele z nitami), oświetlonym brzegiem, wpuszczoną listwą, emblematami w grubych ścianach i jasnym obrysem z lekką poświatą; zagrożenia mają jeden jasny kolor krawędzi na sektor. Tło pulsuje lekko w rytmie 128 BPM; każda sekcja malowana raz do własnego canvasu (w pamięci tylko widoczne); stały krok 1/240 s z akumulatorem i interpolacją, `devicePixelRatio` do 2, pauza przy ukrytej karcie; `prefers-reduced-motion`: bez wstrząsu, pulsu, iskier i obrotów. Pionowo świat ma co najmniej 18 kratek szerokości (pasek gry na środku, teren wypełnia resztę ekranu); poziomo wypełnia wysokość. **Test-only** (tylko z `?seed=`): `?sector=&section=` skok, `?autopilot=<k>` — ścieżka solvera leci k sekcji i puszcza; stan w `data-debug-*`. ESLint i `tsconfig` obejmują `public/games/wave-rush`; `tests/vendor-game.spec.js` sprawdza grę regułami skryptu kopiowania. Testy: `v2/tests/wave-rush.test.ts` (tasowanie w grupach, portale i ich liczby, rozpiętość odwrócenia = 2 sekcje, fizyka bez ruchu poziomego, kolizja każdego typu i musnięcie zbocza, krok stały 60/120/144 Hz, dowód każdej sekcji, rekordy, skórki, `?lang`, przełączniki); e2e w `tests/v2/games.spec.js`: 360×800 dotykiem — skórki (zablokowanej nie da się wybrać, wybór po przeładowaniu), run z autopilotem przez 2 sekcje, rozbicie i restart od sektora 1, „Zakończ” zapisuje sesję „Wave Rush”; 800×360 — pełna wysokość, skok do sektora 2 i restart od sektora 1, Praktyka wraca do punktu kontrolnego sektora. Do sprawdzenia przez właściciela na telefonie: wyczucie sterowania (przytrzymanie/puszczenie) przy 60 i 120 Hz, czy sektory 1–3 są przyjemnie trudne, wygląd | scalone (#90) |
| w-2 | Wave Rush, dalej: sektory 4–6, finał i osiągnięcia. **Sektor 4 „Trudniejszy”**: 10 sekcji, wszystkie tasowane, prędkość 1,1, korytarze ≥ 4 średnice fali; 3 odwrócenia grawitacji na granicach sekcji (każde z własnym portalem powrotu sekcję później; pary się nie nakładają i wracają przed końcem sektora, więc sektor zawsze kończy się w normalnej grawitacji) i 1 odcinek mini. **Sektor 5 „Insane”**: 10 sekcji, 1–5 potem 6–10 (tasowane w grupach), 1,3, ≥ 3,5 średnicy, 2 odwrócenia i 1 mini. **Mini** (decyzja): portal mini i powrót stoją we własnym otwartym wejściu i wyjściu sekcji oznaczonej `mini` (wejście 1,3 kratki, powrót 0,7 kratki przed końcem), gdziekolwiek tasowanie ją postawi — mini latane jest tylko tam, gdzie je zaprojektowano i udowodniono (fala 2:1, mniejsze koło trafienia, bez muskania zboczy 45°); sekcje mini to wysokie sale (0,5–11,5), bo płaski korytarz dla mini musi mieć 2·v·odstęp·2 + średnicę. **Sektor 6 „Demon”**: 30 sekcji w czterech progach tasowanych w obrębie progu, progi po kolei; każdy próg ma własną prędkość, limity, wygląd i punkt kontrolny w praktyce: Easy Demon 1–10 (1,3; 150 ms / ±25 ms / ≥ 3,5 średnicy / ≤ 6 zmian na s; 1 odwrócenie na 2 sekcje), Hard Demon 11–15 (1,5; 140 / ±23 / 3,2 / 6,5; 1 mini), Insane Demon 16–25 (1,7; 125 / ±20 / 3 / 7; 2 odwrócenia, 1 mini), Extreme Demon 26–30 (1,9; 115 / ±18 / 3 / 7,5; 1 odwrócenie, 1 mini) — korytarze Extreme nie są ciaśniejsze niż w Insane (2,6–3 kratki), trudność daje gęstość i rytm (nogi zygzaka różnej długości, sale z kulami kolczastymi, także na łańcuchach). Walidator dowodzi każdej sekcji 4–6 (stany: obie grawitacje, mini dla sekcji mini), z zapasowym odstępem zmian 1/⌊maxRate⌋, gdy gęsty fragment przekracza limit na sekundę. **Wygląd** rośnie z sektorem: od 4 świecące obrysy i szewrony w ścianach (kuźnia: stal i żar), w 5 zęby na krawędziach, romby w tle i zorza; Demon wg zrzutów referencyjnych właściciela (tylko styl): ukośne ściany 45° ze świecącym obrysem i szewronami, kule kolczaste (też na łańcuchach), trójkąty na łańcuchach, „oczy” (czteroramienne gwiazdy), ząbkowane krawędzie, geometria w tle (trójkąty, romby, promienie, odłamki), unoszące się iskry (stała liczba, bez stanu), świecąca podłoga; palety: Easy niebieska, Hard fioletowa, Insane czerwona, Extreme czerń z czerwienią i bielą (z zaćmieniem w tle); zagrożenia mają jasną poświatę, żeby były czytelne wśród deko; statyczne deko malowane raz per sekcja; `prefers-reduced-motion` wyłącza iskry, puls i obroty. **Osiągnięcie „Pogromca Demona”**: ukończenie całej trasy (sektory 1–6) zapisuje `demonComplete` w `lifexp-waverush-progress`, pokazuje ekran świętowania, odblokowuje ostatnią skórkę i finał (trasa skoczona przełącznikiem testowym liczy się tylko z `?seed=`). **Finał „Ostatnia Fala”** (oryginalny poziom, nie odtworzenie żadnego istniejącego): stała sekwencja 9 odcinków (bez tasowania), fala i statek na zmianę, z portalem przy każdej zmianie pojazdu; odcinki fali na progu Extreme Demon, odcinki statku na progu „finale” (prędkość 1,5; 120 ms / ±20 ms / ≥ 3,5 średnicy / ≤ 7 zmian na s). **Statek**: przytrzymanie = ciąg w górę (34 kratki/s²), puszczenie = grawitacja w dół (30), prędkość pionowa płynna i ograniczona do 8,5 kratki/s, ikona przechyla się z lotem; te same zasady kolizji, bez muskania zboczy. **Walidator statku** (`ship.js`): przeszukiwanie wiązką po decyzjach (trzymaj/puść co 1/60 s) z zachowanym rozrzutem wysokości i prędkości, min. odstępem zmian i zapasem miejsca, potem odtworzenie fizyką gry — nominalnie i z każdym stuknięciem przesuniętym o ±tolerancję (statek nie wraca na starą ścieżkę, więc każde odtworzenie biegnie do końca) — i limit zmian na sekundę; dowód z 5 wysokości wejścia od portalu statku. Finał: własny rekord (`lifexp-waverush-finale-best`), praktyka z punktem kontrolnym co odcinek, drugie osiągnięcie „Władca Ostatniej Fali” (`finaleComplete`); w menu sekcja finału (zablokowana do ukończenia Demona). % trasy liczy sektory 1–6; finał ma własny %. **Test-only** (z `?seed=`): `?finale=<n>` start finału od odcinka n, autopilot obsługuje mini, zmiany prędkości i statek. Testy: vitest — liczby i parowanie portali w sektorach 4–6, mini dokładnie wokół sekcji mini, tasowanie w grupach i progach, prędkość i wygląd progów, punkty kontrolne per próg, dowód każdej sekcji 4–6 i całego finału (fala i statek), fizyka statku i krok stały 60/120/144 Hz, walidator statku (przelot i ściana), osiągnięcia i odblokowanie skórki, pilot przelatuje ostatnią sekcję trasy i cały finał; e2e — skoki do granic progów Demona (prędkość/wygląd/HUD), sektor 4 z odwróceniem grawitacji i mini, odcinek statku finału z autopilotem i restart finału, ukończenie Demona → osiągnięcie, skórka i finał (telefon pionowo i poziomo). Do sprawdzenia przez właściciela na telefonie: wyczucie statku, trudność Extreme i finału, wygląd Demona | scalone (#91) |
| w-3 | Wave Rush po pierwszym graniu właściciela: (1) **sektory 1 i 2 szybsze**: prędkość 0,5 → 0,8 (8,3 kratki/s); limity człowieka dalej łagodniejsze niż w sektorze 3 (1,0 / 170 ms / ±30 ms / 4,5 / 5): **Łatwy** 0,8 / 240 ms / ±45 ms / korytarz ≥ 7 średnic fali / ≤ 3,5 zmiany na s, **Normalny** 0,8 / 210 ms / ±40 ms / ≥ 6 / ≤ 4; płaski korytarz musi mieć teraz ≥ 4,6 (Łatwy) i ≥ 4,1 kratki (Normalny). Wszystkie sekcje 1–2 udowodnione od nowa walidatorem; zmieniona geometria jednej: s1-09 (schodki podłogi po 0,75 zamiast 1, korytarz pod półkolcami 5,25 zamiast 4,5 — przy 0,8 płaski odcinek był za niski na odstęp 240 ms). (2) **Obrót ikony bez skoku**: kierunek lotu zmienia się od razu (ślad ma ostre narożniki, koło trafienia leci ściśle ±45°/±63,4°), ale rysowana ikona obraca się do nowego kąta płynnie — wygładzanie wykładnicze po czasie klatki, kąt += najkrótszy łuk · (1 − e^(−dt/τ)), τ = 40 ms (obrót o 90° wizualnie kończy się w ok. 100 ms, jednakowo przy 60/120/144 Hz); cel: kierunek lotu (mini stromiej, po odwróceniu grawitacji według rzeczywistego kierunku), statek według prędkości pionowej (zmiana pojazdu też bez skoku); nowa próba zaczyna od kąta lotu. Tylko rysowanie: fizyka, ślad i dowody bez zmian. Przy `prefers-reduced-motion` wygładzanie zostaje (to szybki, subtelny obrót, nie dekoracja). Testy: łagodzenie (niezależność od 60/120/144 Hz, najkrótszy łuk, czas zbiegania, cel w mini/odwróceniu/statku) i to, że lot zmienia kierunek od razu | scalone (#92) |
| s-1 | **Ship Rush** — czwarta własna gra LifeXP (decyzja właściciela po w-3): siostra Wave Rush dla trybu statku, z **nowymi** układami sekcji i **nowym** wyglądem sektorów (niebo i kosmos), oryginalna (bez nazw, grafiki i poziomów GD). **Wspólny silnik** `v2/public/games/_engine/` (bez własnej strony; CSP `'self'` pozwala go importować): świat i stałe (`world.js`), opis sektorów (`sectors.js`), budowa poziomu i pytania o miejsce (`level.js`), stany gry z regułami gry (`game.js`: `GameRules` = poziomy + lot pojazdu), zegar stałego kroku, rekordy pod prefiksem gry (`records.js`: `createRecords`), skórki, teksty, limity człowieka (`limits.js`), walidator wiązkowy (`beam.js`), geometria i kolizje Wave Rush, renderer z „wyglądem” gry (`render/frame.js`, `section.js`, `sprites.js`, `backdrop.js`, `turn.js`, `view.js`) i cała strona (`app.js`: ekrany, wejście, pętla, HUD; `shell.css`). Wave Rush przeniesiony na silnik bez zmiany zachowania (jego testy, dowody i e2e przechodzą); `build-site` przyjmuje katalog `_*` bez `index.html`, `tests/vendor-game.spec.js` sprawdza silnik regułami gry (żadnych kluczy własnych, magazyn tylko przez `records.js`). **Statek** (`ship-rush/js/physics.js`): przytrzymanie = ciąg w górę 34 kratki/s², puszczenie = grawitacja 30, prędkość pionowa płynna, ograniczona do 8,5; mini mniejszy (połowa boku 0,18 zamiast 0,3) i lżejszy (50 / 44). **Zasada kolizji** (dokładnie): ciało statku to kwadrat; po każdym kroku każda bryła, na którą zachodzi, oceniana jest według pozycji sprzed kroku — był nad jej wierzchem (najwyżej `SNAP` = 0,15 kratki poniżej): ląduje, wraca na wierzch, prędkość w dół zerowana, może leżeć i się ślizgać; był pod jej spodem (najwyżej 0,15 powyżej): odbija, wraca pod spód, prędkość w górę zerowana — jazda pod sufitem przy przytrzymaniu; inaczej wszedł z boku: pionowy bok bloku, filaru albo schodka podłogi/sufitu = rozbicie; ściśnięcie między wierzchem a spodem albo nakładanie po poprawce = rozbicie; wyjście z pola gry = rozbicie. Zagrożenia (kolce, półkolce, piły, kule, miny) — koło w ciele statku, każdy dotyk = rozbicie. Bryły: płaskie odcinki podłogi i sufitu (połączone, bez szwu na złączach), bloki, filary. Teren statku nie ma zboczy (tylko poziome odcinki i schodki; walidator odrzuca zbocze). Nowe zagrożenie silnika: mina z kolcami (`mine`, koło trafienia 0,66 promienia, migające światło). **Prędkości i limity** (prędkość / min. odstęp / tolerancja ± / otwór w wysokościach ciała statku / maks. zmian na s): Łatwy 0,8 / 240 ms / 45 ms / 6 / 3,5; Normalny 0,85 / 210 / 40 / 5 / 4; Trudny 1,0 / 170 / 30 / 4 / 5; dalej (s-2) Trudniejszy 1,1 / 160 / 28 / 3,6 / 5,5, Insane i Easy Demon 1,25 / 150 / 25 / 3,3 / 6, Hard Demon 1,4 / 140 / 23 / 3,1 / 6,5, Insane Demon 1,55 / 125 / 20 / 2,9 / 7, Extreme Demon 1,7 / 115 / 18 / 2,8 / 7,5. **Sektory** jak w Wave Rush: 1 Łatwy — 10 sekcji tasowanych (dzień w chmurach); 2 Normalny — 15, 1–5 potem 6–15 (burza); 3 Trudny — 15 jak w 2, jedno odwrócenie grawitacji na 2 sekcje (nocna zorza wysoko w atmosferze). Sekcje pod statek (nie przerobione korytarze fali): przeskoki nad kolcami, platformy nad łożami kolców, niskie sufity, bramy z filarów, slalomy, jazda pod sufitem i potem po podłodze, schody (każdy stopień to ściana), pola min, miny na łańcuchach, stosy pił, okna w ścianach, „las filarów”, tunel z piłami, przewężenie. Otwór sprawdzany też dokładnie na każdym schodku (gdzie stopień w górę i w dół w jednym x zostawiają tylko część wspólną). **Walidator** (`beam.js` + `ship-rush/js/prove.js`): wiązka po decyzjach 1/60 s z fizyką gry (lądowanie i leżenie to zwykłe stany — oparcie się o powierzchnię jest strategią), zapas miejsca od zagrożeń i od lewych boków brył przed statkiem, potem odtworzenie z każdym stuknięciem przesuniętym o ±tolerancję i limit zmian na sekundę; z dwóch podobnych stanów zostaje swobodniejszy (dłużej od zmiany), a gdy gruba wiązka nie znajdzie odpornej ścieżki, szuka drobniejsza. Dowód każdej sekcji z 14 wejść: leżąc na podłodze złącza, pod sufitem i w powietrzu na 4 wysokościach × (wznosi się, poziomo, opada), w każdym stanie (obie grawitacje w 3). **Tryby, rekordy, skórki** jak w Wave Rush (Normalny, Praktyka co sektor/sekcję, próby); klucze `lifexp-shiprush-*`; 10 kadłubów (Jaskółka, Sokół, Manta, Rakieta, Szybowiec, Spodek, Szerszeń, Bliźniak, Kometa, Korona Pustki — ostatnia po Demonie, s-2); osiągnięcie Demona i pole finału włączy s-2. Katalog: „Ship Rush”, ikona `Rocket`, `landscape`, opisy pl/en. **Wygląd**: dzień — błękit, słońce z promieniami, trzy warstwy chmur z paralaksą, ptaki, ściany z nitowanych płyt z kratkami wentylacji; burza — ciemne chmury, deszcz, rzadkie błyskawice z delikatnym rozbłyskiem (nigdy przy `prefers-reduced-motion`), płyty z żółtą krawędzią i piorunami; noc — gwiazdy, sierp księżyca, kurtyny zorzy, poświata horyzontu, lodowe ściany ze świecącym obrysem, szewronami i świecącą podłogą, iskry. Statek: 10 oryginalnych kadłubów, kabina z odblaskiem, płomień przy ciągu, przechył z prędkością pionową (wygładzony jak w w-3, tylko rysowanie). Testy: `v2/tests/ship-rush.test.ts` (struktura i tasowanie, prędkości i progi, format sekcji bez zboczy, trudność rośnie, fizyka i mini, krok stały 60/120/144 Hz, kolizja każdego typu bryły i zagrożenia, `SNAP`, ściśnięcie, odwrócona grawitacja, złącza bez szwu, walidator: otwarta sala, leżenie bez stuknięć, ściana, ścieżka tylko dla bota odrzucona; pilot przelatuje całą trasę 1–3 dla kilku ziaren; rekordy, skórki, teksty, przełączniki), `v2/tests/ship-rush-sections.test.ts` (dowód każdej sekcji 1–3); e2e w `tests/v2/games.spec.js`: 360×800 dotykiem — skórki, autopilot przez 2 sekcje, rozbicie, restart, „Zakończ” zapisuje sesję „Ship Rush”; 800×360 — sektor 3 z odwróceniem grawitacji, Praktyka wraca do punktu kontrolnego. Do sprawdzenia przez właściciela na telefonie: wyczucie statku i leżenia na powierzchniach, trudność sektorów 1–3, wygląd | scalone (#93) |
| s-2 | Ship Rush, dalej: sektory 4–6 jak w Wave Rush (4: 10 tasowanych, 3 odwrócenia + 1 mini; 5: 1–5 / 6–10, 2 odwrócenia + 1 mini; 6 Demon: 30 sekcji, progi Easy 1–10 / Hard 11–15 / Insane 16–25 / Extreme 26–30), wygląd: orbita (krzywizna Ziemi, satelity), głęboki kosmos, Demon — mgławica niebieska, fioletowa, karmazynowa z płonącymi asteroidami, Extreme czerń z czerwienią i bielą (najbogatszy: świecące konstrukcje, miny, gruz na łańcuchach, gwiazdy-oczy, wraki, gwiazdy z cząstek); po Demonie osiągnięcie, ostatnia skórka i oryginalny finał (głównie statek z odcinkami fali, portale, własny rekord, praktyka, drugie osiągnięcie) | w toku |

**Etap gier: kod gotowy (2026-10-26), do sprawdzenia przez właściciela na telefonie.** Na prawdziwym telefonie:
1. Wartime: przeciąganie i szczypanie mapy w ramce (Playwright nie umie gestów wielopalcowych).
2. Flappy Bird: płynność na ekranie 120 Hz i wyczucie machnięć (stuknięcie → lot).
3. Szybkie liczenie: wyczucie klawiatury ekranowej (szybkie stukanie, duże klawisze, brak przybliżania przy podwójnym stuknięciu).
4. Czas grania widoczny dla rodzica: po kilku minutach gry na koncie dziecka sesja jest w historii v1 i w widoku rodzica (oraz w raporcie tygodniowym).


Kolejność od 2026-09-29: 1g → 2a (ekran „Dziś” tylko do odczytu, pierwszy ekran z danymi) → 1f. Właściciel
nie widział dotąd zmian w aplikacji, a 1f (offline, manifest) też jest niewidoczne, więc ekran z danymi idzie przed nim.

Zakres 1e (2026-09-29): v2 w etapie 1 niczego nie zapisuje. W v1 każdy krok po zalogowaniu coś zapisuje
(rejestracja tworzy profil, `verify.html` ustawia `emailVerified`, wybór trybu konta i ankieta modułów zapisują
ustawienia), więc v2 sprawdza te same bramy tylko do odczytu i przy brakach odsyła do v1: brak profilu, trybu
konta albo modułów → `app.html`, niepotwierdzony e-mail → `verify.html`, rejestracja → `index.html`. Konto jest
potwierdzone, gdy mówi to profil albo Firebase Auth (Google), jak w v1. Te ekrany przejdą do v2 przed cutoverem.

Źródło Pages przełączone na „GitHub Actions” 2026-09-29 (D3). Do czasu SW v2 (1f)
stronami `/v2/` zarządza SW v1 (scope `./`): online bez wpływu; offline `/v2/` otworzy się tylko z wcześniejszej
wizyty online, inaczej SW v1 pokaże `app.html`.

---

## 10. Ryzyka

| # | Ryzyko | Prawd. | Skutek | Mitygacja |
|---|---|---|---|---|
| R1 | Zapis v2 w kształcie nieczytelnym dla v1 / rodzica / raportu | Średnie | Awaria v1, złe dane u rodzica | Schemat addytywny, konwertery, kontrakt odwrotny w 8.3 |
| R2 | Równoległe użycie v1 i v2 na saldzie (v1 bez transakcji) | Średnie | Dryf salda/punktów | Zasada „jedna wersja naraz” w okresie próbnym, „Sprawdź spójność”, krótkie okno równoległe na moduł |
| R3 | Migracja uruchomiona dwa razy albo przerwana | Niskie | Podwójne wartości | Idempotencja + marker w tym samym batchu, dry-run na kopii |
| R4 | Utrata szkiców offline przy przejściu | Średnie | Utracone wpisy użytkownika | Ten sam klucz i format kolejki, test na szkicach z v1 |
| R5 | Konflikt Service Workerów / stary cache po cutover | Średnie | Mieszane wersje, biały ekran | Scope `/v2/` w okresie równoległym; przy cutover ten sam URL `sw.js`, czyszczenie starych cache, test na zainstalowanej PWA |
| R6 | Konflikt cache IndexedDB między wersjami SDK; v1 i v2 otwarte w dwóch kartach naraz | Niskie przy pinie | Błędy persistence; druga karta działa bez cache offline (single-tab manager) | SDK 10.12.x w v2 do etapu 8; jedna karta naraz |
| R7 | Podwójne powiadomienia push | Średnie | Irytacja | Push tylko w v1 do cutover |
| R8 | Zmiana klucza dni (UTC → lokalny) | Niskie | Wpisy z 0:00-2:00 w dniu przełączenia liczone inaczej | Tylko przy cutover, flaga w profilu, jawna notka w changelogu |
| R9 | Brak kodu Cloud Functions → odtwarzanie backendu | Pewne | Nieznany stary prompt/limity; ryzyko przypadkowego skasowania starych funkcji przy deployu | Odtwarzamy tylko `exusTurn` i funkcje rodzica; osobny codebase + celowany deploy (6.12); 5a nie zależy od backendu |
| R10 | Push/raport/CI nie działają już dziś | Pewne | Brak przypomnień i raportów od 25.07 (klucz), brak CI od 19.08 | Etap 0: `test.yml` przywrócony, klucz odnowiony; notify/weekly po poprawie danych (etap 6) |
| R11 | Zmiana sposobu deployu (Pages ze źródła „branch” na „GitHub Actions”) | Średnie | Wymaga zmiany w ustawieniach repo; upload przez przeglądarkę przestaje wystarczać | Jednorazowa zmiana w Settings → Pages; opis w `CLAUDE.md` |
| R12 | Legacy kształty danych, których nie przewidziano | Niskie | Crash albo złe liczby | Inwentaryzacja produkcji zrobiona (5.3); ponowne uruchomienie przed etapem 2 i cutover |
| R13 | Regresja UX: nawigacja drawerem wymaga dodatkowego tapnięcia | Średnie | Wolniejszy dostęp do modułów | Metadane w drawerze, szybkie akcje na „Dziś”, komendy Ex-us, gest krawędziowy |
| R14 | Niespójność kodu pisanego przez AI między sesjami | Średnie | Erozja architektury | `CLAUDE.md`, lint warstw, typy, małe PR-y, testy wymagane w DoD |
| R15 | Rozrost zakresu (nowe funkcje w trakcie rewrite) | Wysokie | Opóźnienie cutover | Parytet najpierw; nowe funkcje (np. usuwanie zadań) tylko jeśli trywialne i opisane |
| R16 | Limity/koszty Gemini po zmianie promptu i kontekstu | Niskie | Wyższy koszt tury | Budżet kontekstu, pomiar tokenów w `usage`, i tak 1 zamiast 2-3 wywołań |
| R17 | Weryfikacja emaila i reguły pozwalają userowi pisać dowolne pola (punkty, `emailVerified`, `parentEmail`) | Istnieje dziś | Nadzór rodzica do obejścia | Świadomie poza zakresem parytetu; etap 6 (kod rodzica w funkcji) i 8 (reguły) |

---

## 11. Rekomendacja i uzasadnienie

**Rekomendacja:** zachować backend Firebase i model danych, przebudować frontend jako
**Vite + TypeScript + Preact/signals, feature-folders z warstwami domain → services → data**, wdrażane
strategią strangler pod `/v2/` z testami parytetu na emulatorze; Ex-us jako **lokalny silnik komend
z jednym wywołaniem AI** zwracającym akcje w formacie komend; UI na design tokens bez ikon, z drawerem
mobilnym zamiast dolnego paska.

Uzasadnienie techniczne:

1. **Ryzyko danych jest największym ryzykiem projektu, nie UI.** Dlatego dane i reguły zostają, schemat jest
   addytywny, a każdy moduł przechodzi parytet v1↔v2 na tym samym emulatorze przed cutover. Big-bang
   rewrite nie daje żadnego punktu kontrolnego — strangler daje ich jedenaście.
2. **Większość obecnych bugów to jedna klasa: brak granic** (DOM + logika + zapisy w jednej funkcji,
   globalny mutowalny stan, zapisy bez transakcji). Warstwy z regułą zależności usuwają przyczynę, nie objawy:
   domena jest czysta i testowalna, serwis jest jedynym miejscem zapisu i zawsze atomowy.
3. **TypeScript i zod są dźwignią dla rozwoju z AI.** Model popełnia najczęściej błędy w nazwach pól,
   kształtach danych i nieobsłużonych brakach — dokładnie to łapie kompilator i schemat. Jeden schemat zod
   obsługuje walidację formularza, komendy Ex-us i kontrakt z Gemini.
4. **Preact zamiast vanilla**: deklaratywny render ze stanu eliminuje ręczne „co przerysować” (dziś ręczne
   listy w `refreshDynamicI18n` i reload po każdym zapisie). Rozmiar ~4 KB utrzymuje szybkość na telefonie,
   a zgodność z API Reacta daje modelom AI najlepiej znany wzorzec.
5. **Build step się opłaca**: przypięty SDK w lockfile, Firebase w bundlu (offline cold start), precache
   hashowanych plików (koniec B1), testy jednostkowe na prawdziwym kodzie (koniec harnessów-kopii).
6. **Ex-us „intencja przez AI, wykonanie lokalnie”** jest spełnione konstrukcyjnie: AI zwraca dane
   (`ParsedCommand`), a nie wykonuje; slash-komendy i akcje AI trafiają do tego samego pipeline i tych samych
   serwisów co formularze. Jedno wywołanie na wiadomość zamiast 2-3, a logika biznesowa przestaje żyć
   w Cloud Functions.
7. **Rejestr modułów jako jedno źródło** (nawigacja, route'y, ustawienia, komendy, kontekst AI) sprawia,
   że dodanie modułu to jeden katalog — dokładnie ta skala zmian, którą AI wykonuje najpewniej.
8. **UI na tokenach i jednym shellu** odpowiada na historię poprawek „coś wystaje / coś zasłania”: przepełnienia
   i warstwy są zasadą systemu sprawdzaną testem, a nie wyjątkiem łatanym per ekran.

---

## 12. Otwarte decyzje

| # | Decyzja | Rekomendacja | Blokuje |
|---|---|---|---|
| D1 | ~~Gdzie jest kod Cloud Functions?~~ **Rozstrzygnięte**: nieodnaleziony → odtwarzamy nowy backend (6.12) | — | — |
| D2 | ~~Czy usunięcie workflowów 19.08 było celowe?~~ **Rozstrzygnięte w etapie 0**: `test.yml` przywrócony; `notify`/`weekly-report` wracają w etapie 6 (skrypt raportu czyta nieaktualne dane) | — | — |
| D3 | ~~Build i deploy przez GitHub Actions?~~ **Rozstrzygnięte 2026-09-29: tak.** Źródło Pages przełączane dopiero w etapie 1, po scaleniu `deploy.yml` (wcześniejsze przełączenie zatrzymałoby publikację zmian) | — | — |
| D4 | ~~Które motywy zostają?~~ **Rozstrzygnięte 2026-09-29**: LifeXP ciemny (obecny) + jasny, nowy motyw iOS zamiast „Apple”, Gold bez zmian, wybór fontu zostaje (4.9) | — | — |
| D5 | ~~Gry i FPS w v2~~ **Rozstrzygnięte 2026-10-26** (właściciel): v2 ma 4 gry (Flappy Bird, Wartime, Gridlock, Szybkie liczenie); gry v1 i FPS nie przechodzą do v2 (etap gier w 9.1) | — | — |
| D6 | `plannerTasks` (zadania dodane przez Ex-us, dziś niewidoczne) | Jednorazowy import niezrobionych do `todos` (M5) | Etap 3a |
| D7 | Czy rodzic ma widzieć notatki, zadania i rozmowy z Ex-us (`aiConversations`) | Notatki i rozmowy: nie (prywatne); zadania: tak | Etap 8 |
| D8 | ~~Czy dodać usuwanie zadań (v1 go nie ma)~~ **Zrobione w 3a-2**: usuwanie z „Cofnij”, budowa PC bez zmian | Tak, trywialne i oczekiwane | Etap 3a |
| D9 | ~~Ikony?~~ **Rozstrzygnięte 2026-09-29** (styl referencyjny właściciela): ikony tak, **zawsze obok tekstu** — nigdy jedynym nośnikiem znaczenia. Jeden zestaw SVG (`lucide-preact`, ISC) w bundlu, bez fontu ikon. Bez podpisu tylko znaki uniwersalne (×, ›, ✓, „+” z nazwą dostępną). Zmienia 7.1 | — | — |
| D10 | ~~Nawigacja na telefonie?~~ **Rozstrzygnięte 2026-09-29**: dolny pasek (Dziś, Obowiązki, „+”, Pieniądze, Menu) + dotychczasowy drawer z pełną listą modułów, otwierany przyciskiem „Menu” z paska. Desktop bez zmian (sidebar). Zmienia 7.3 i 7.4 | — | — |
| D11 | ~~Ikony notatek?~~ **Rozstrzygnięte 2026-09-30** (właściciel): w edytorze notatki da się wybrać ikonę, jak w v1. Dane bez zmian: 12 klas Tabler v1, rysowane odpowiednikami `lucide-preact`; ikona na kafelku w kolorze notatki, zawsze obok tytułu. Zmienia 7.1 | — | — |
