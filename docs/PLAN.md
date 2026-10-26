# Sprintdeck — plan realizacji MVP

> Dokument roboczy. Bazuje na „Sprintdeck — Plan produktu i realizacji MVP v1.0”
> i przekłada go na decyzje techniczne, backlog oraz harmonogram.
> Wszystko oznaczone jako **[DECYZJA]** to rekomendacja do potwierdzenia,
> a **[OTWARTE]** to pytanie, które trzeba rozstrzygnąć.

## 0. Rejestr decyzji

| Data | Decyzja |
|---|---|
| 2026-10-25 | Język interfejsu: **angielski** (wszystkie teksty UI, komunikaty silnika i pytania pomocnicze). Dokumentacja wewnętrzna może zostać po polsku. |
| 2026-10-25 | Głosy po odkryciu są **imienne**. |
| 2026-10-25 | Dane w **UE (Supabase Frankfurt, `eu-central-1`)**; pokoje **usuwane trwale po 90 dniach nieaktywności**. |
| 2026-10-25 | MVP realizuje **jedna osoba** → priorytet prostoty, linia cięcia z sekcji 7 obowiązuje. |
| 2026-10-25 | Harmonogram 5 tygodni jest **orientacyjny** (brak deadline'u) — tygodnie traktujemy jako kolejne kamienie milowe, nie daty. |
| 2026-10-25 | Mediana między kartami → **najbliższa karta, remis w górę** (np. 3 i 5 → mediana 4 → rekomendacja 5). |
| 2026-10-25 | Rozwój **lokalnie** (Supabase CLI w Dockerze); konta Vercel/Supabase Cloud i domena dopiero przed pierwszym wdrożeniem (sekcja 8 — „Kiedy potrzebna infrastruktura”). |
| 2026-10-25 | **Zmiana roli:** sprintdeck to narzędzie do **konsensusu co do zrozumienia i ryzyka**, nie do estymacji pracy. W zespołach, w których kod pisze AI, rozmiar i prognozę liczy automat (tf, ShipScope), a ludzie głosują tam, gdzie automat zgłasza wątpliwość. Silnik i mechanika pokoju bez zmian; dochodzi talia „Risk”, Fibonacci zostaje. Decyzja ekosystemu: pdi `docs/decyzje.md`, D-E1. Szczegóły: sekcja 12. |
| 2026-10-25 | Backend pokoi (M2) zrobiony: `supabase/migrations/20261025150000_rooms.sql` + testy pgTAP. Zdarzenia realtime wysyła samo RPC (`private.emit`), a nie triggery — wszystkie zapisy i tak idą przez RPC. Ponowne głosowanie = `start_round` na tym samym zadaniu (osobne `revote` niepotrzebne). Dodatkowo: `get_room_preview` (ekran dołączenia), `set_current_item`, `skip_item`, `close_room`. |
| 2026-10-26 | Talia „Risk” w backendzie i w `src/lib/deck.ts`: wartości `low`, `medium`, `high`, `very_high`, `?`, `break` (karty porządkowe, punkty = ranga 1–4). `create_room` przyjmuje talię (`fibonacci` domyślnie, `risk`); głosy i estymata są walidowane względem talii pokoju. Progi silnika, flaga `high_risk` i bank pytań dla tej talii (reszta S6) — osobno. |
| 2026-10-26 | S6 zrobione w silniku: progi per talia (`configForDeck`; Risk: `maxClusteredSpread` = 1, `minGapSteps` zostaje 2, bo mniejszej luki nie ma), flaga `high_risk` od „High” zamiast `large_item`, bank pytań „risk” (zrozumienie i weryfikacja zamiast wysiłku), tabela przypadków w `analyze.test.ts`, wybór talii w symulatorze. Talia porządkowa (`ordinal`) pokazuje statystyki jako poziomy, bez średniej. |
| 2026-10-26 | Ekrany pokoju podpięte pod backend (`/r/[slug]`, formularz na landingu). Klient po każdym zdarzeniu realtime i po powrocie karty z tła pobiera pełny snapshot (`get_room_state`) — bez łatania stanu lokalnie; przy kilku–kilkunastu osobach to tanie i odporne na zgubione zdarzenia. Presence pokazuje, kto jest online. Link prowadzącego to `/r/<slug>#host=<sekret>` (fragment nie trafia na serwer); po przejęciu roli znika z adresu. |

---

## 1. Podsumowanie i główne wnioski z analizy

1. **Repozytorium jest puste** — budujemy od zera, więc tydzień 2 obejmuje pełny
   scaffolding (Next.js, Supabase, CI, deploy).
2. **Najtrudniejsze technicznie nie jest głosowanie, tylko „sekret do odkrycia”**:
   ukrycie wartości głosów na poziomie backendu przy jednoczesnej synchronizacji
   w czasie rzeczywistym. To determinuje architekturę (sekcja 3).
3. **Model danych wymaga jednej istotnej korekty**: ponowne głosowanie tworzy
   kilka rund dla jednego zadania, więc `final_estimate` i notatka należą do
   **zadania (`items`)**, a nie do rundy. Bez tego historia rund i zatwierdzanie
   się rozjadą (sekcja 4).
4. **`organizations` / `teams` nie są potrzebne w MVP** — żadna funkcja MVP z nich
   nie korzysta. Dodamy je migracją razem z „pamięcią zespołu”. **[DECYZJA]**
5. **Consensus Engine to czysta, deterministyczna biblioteka TS** z testami
   opartymi o tabelę przypadków. Można ją zbudować już w tygodniu 1 i użyć
   jako prototypu w rozmowach ze Scrum Masterami (sekcja 5).
6. **Uczestnicy bez konta = Supabase Anonymous Sign-In.** Każda przeglądarka
   dostaje prawdziwe `auth.uid()`, dzięki czemu RLS działa natywnie, a
   odświeżenie strony zachowuje tożsamość „za darmo”.
7. **Harmonogram 5 tygodni przy jednej osobie jest realny tylko przy twardym
   cięciu zakresu** — backlog jest podzielony na Must / Should / Could (sekcja 7),
   a wywiady z tygodnia 1 prowadzimy równolegle z kodem (sekcja 8).

---

## 2. Zakres MVP — doprecyzowanie

### 2.1. Główny przepływ (happy path)

```
Prowadzący:  [Landing] → „Utwórz pokój” (tytuł + nick) → [Pokój] → kopiuje link
Uczestnik:   link → [Ekran dołączenia: nick] → [Pokój]
Pokój:       dodaj zadanie → start rundy → głosy (ukryte, widać tylko „zagłosował”)
             → prowadzący odkrywa → statystyki + rozbieżność + pytania
             → (opcjonalnie) ponowna runda → prowadzący zatwierdza estymatę + notatka
             → następne zadanie
Koniec:      podsumowanie sesji (lista zadań z estymatami) + eksport
```

### 2.2. Doprecyzowania, których brakuje w specyfikacji

| Temat | Propozycja **[DECYZJA]** |
|---|---|
| Kto zatwierdza wynik | Tylko prowadzący (spec: „zespół lub prowadzący” — głosowanie nad zatwierdzeniem odkładamy). |
| Czy prowadzący głosuje | Tak, domyślnie. Każdy może przełączyć się w tryb **obserwatora** (np. PO, który tylko wyjaśnia). |
| Czy głosy po odkryciu są imienne | **Tak — zatwierdzone.** Potrzebne do pytań typu „What does Anna (21) see?”. Tryb anonimowy → ewentualnie po MVP. |
| Zmiana głosu | Dozwolona do momentu odkrycia. Po odkryciu runda jest zamrożona. |
| Odkrycie przy brakujących głosach | Dozwolone (prowadzący decyduje), UI pokazuje „4/6 zagłosowało”. |
| Zadania | Dodawane ręcznie (tytuł + opcjonalny opis/link). Import z Jiry → poza MVP. |
| Talia | Fibonacci `0, ½, 1, 2, 3, 5, 8, 13, 21, ?, ☕` oraz talia „Risk” (S6, sekcja 12). Prowadzący wybiera talię przy tworzeniu pokoju. Która jest domyślna, rozstrzygają wywiady z tygodnia 1 (pytanie otwarte 2). |
| Utrata prowadzącego | Prowadzący może przekazać rolę. Dodatkowo: **sekretny link prowadzącego** (pokazany raz przy tworzeniu) pozwala odzyskać rolę z innego urządzenia. |
| „Trwały zapis wyniku” | Wyniki zapisane w DB + eksport sesji (kopiuj jako Markdown / CSV). Eksport to też tani test hipotezy „przenoszenia do Jiry”. |
| Retencja | **Zatwierdzone:** pokój bez aktywności przez 90 dni jest trwale usuwany (kaskadowo z uczestnikami, zadaniami, rundami, głosami, notatkami) — szczegóły w sekcji 3.6. |

### 2.3. Poza zakresem MVP (świadomie)

Konta i organizacje, pamięć zespołu / wyszukiwanie podobnych zadań, integracje
Jira/Linear, własne talie, timer, czat, płatności, panel analityczny EM.

---

## 3. Architektura

### 3.1. Stack

- **Next.js (App Router) + React + TypeScript + Tailwind CSS** — aktualne stabilne wersje.
- Komponenty UI: własne + `shadcn/ui` / Radix (dostępność, styl „Linear-like”).
- **Supabase**: Postgres, Auth (anonymous sign-in), Realtime (Broadcast + Presence).
- Testy: **Vitest** (engine, logika), **pgTAP** przez `supabase test db` (RLS i RPC),
  **Playwright** (E2E, wielu uczestników w osobnych kontekstach przeglądarki).
- Hosting: **Supabase Cloud w regionie UE (Frankfurt, `eu-central-1`)** + **Vercel** z funkcjami w regionie `fra1` (zgodnie z bazą — mniejsze opóźnienia i dane przetwarzane w UE).
- i18n: teksty UI w jednym słowniku (`src/messages/en.ts`) od pierwszego dnia — tylko EN w MVP, ale bez twardo wpisanych napisów w komponentach.
- CI: GitHub Actions — lint, typecheck, Vitest, testy DB (Supabase CLI w Dockerze), Playwright.

### 3.2. Kluczowa decyzja: wszystkie zapisy przez funkcje RPC w Postgresie

Klient **nie ma** uprawnień `insert/update/delete` do żadnej tabeli. Każda
operacja to funkcja `SECURITY DEFINER`, która w jednej transakcji:
sprawdza tożsamość (`auth.uid()`), rolę w pokoju, stan maszyny stanów i
poprawność danych.

| RPC | Kto | Uwagi |
|---|---|---|
| `create_room(title, display_name)` | dowolny zalogowany anonimowo | zwraca `slug` + jednorazowy `host_secret`; limit tworzenia pokoi/h |
| `join_room(slug, display_name)` | dowolny | idempotentne (ponowne wejście = ten sam uczestnik); limit prób |
| `claim_host(slug, host_secret)` | dowolny z sekretem | sekret przechowywany jako hash |
| `set_participant_role(participant_id, role)` | host | host / voter / observer, przekazanie roli |
| `add_item(room_id, title, description)` / `update_item` / `reorder_items` | host | |
| `start_round(item_id)` | host | tylko jedna runda `voting` na pokój |
| `cast_vote(round_id, value)` / `clear_vote(round_id)` | voter / host | wartość walidowana względem talii, tylko gdy `voting` |
| `reveal_round(round_id)` | host | `voting → revealed`, ustawia `revealed_at` |
| `revote(item_id)` | host | nowa runda `number + 1`, poprzednia zostaje w historii |
| `finalize_item(item_id, estimate, note)` | host | estymata musi należeć do talii (bez `?`/☕) |
| `get_room_state(slug)` | uczestnik | pełny snapshot JSON; **wartości głosów tylko dla odkrytych rund** (dla bieżącej: `has_voted`) |

Dlaczego RPC, a nie Server Actions z kluczem `service_role`:
atomowość przejść stanów, jedno źródło prawdy o uprawnieniach, RLS jako druga
linia obrony, mniej miejsc, w których można przypadkiem wyciec klucz serwisowy.

### 3.3. Ukrywanie głosów — dwie warstwy

1. **RLS na `votes`**: `SELECT` dozwolony dla własnego głosu **albo** gdy runda
   ma status `revealed` i użytkownik jest uczestnikiem pokoju.
2. **Realtime nie przenosi wartości**: zdarzenia o głosach zawierają wyłącznie
   `{round_id, participant_id, has_voted}`. Wartości klient pobiera dopiero po
   zdarzeniu `round_revealed` przez `get_room_state`.

Test bezpieczeństwa (pgTAP + E2E): uczestnik B nie może w żaden sposób
(SELECT, RPC, kanał realtime) odczytać wartości głosu A przed odkryciem.

### 3.4. Realtime i odporność na rozłączenia

- **Prywatny kanał Broadcast `room:{room_id}`**, autoryzowany przez RLS na
  `realtime.messages` (tylko uczestnicy pokoju).
- Zdarzenia wysyłane **z bazy** (triggery → `realtime.send`) po każdej zmianie
  stanu: `participant_joined/updated`, `item_changed`, `round_started`,
  `vote_status_changed`, `round_revealed`, `item_finalized`.
- **Presence** na tym samym kanale → status online/offline uczestników.
- Wzorzec **„zdarzenie → łatka lub ponowny snapshot”**: klient trzyma stan
  z `get_room_state`; drobne zdarzenia nakłada lokalnie, a przy
  (re)subskrypcji, powrocie karty z tła lub wykryciu luki pobiera pełny snapshot.
  Dzięki temu odświeżenie strony i reconnect to ta sama ścieżka kodu.
- Każde zdarzenie niesie `room_version` (licznik w `rooms`) → klient wykrywa
  pominięte zdarzenia i robi refetch.
- Odświeżenie strony: sesja anonimowa w `localStorage` → ten sam `auth.uid()` →
  `join_room` zwraca istniejącego uczestnika.

### 3.5. Dostęp do pokoju i nadużycia

- `slug`: 12 znaków base62 (~71 bitów entropii) z CSPRNG — zgadywanie nierealne.
- Bez członkostwa nie da się odczytać nic o pokoju (brak listowania, RLS).
- Limity w RPC (tabela zdarzeń / liczniki): np. ≤ 10 pokoi/h i ≤ 30 dołączeń/h na użytkownika.
- **CAPTCHA (Cloudflare Turnstile) przy anonimowym logowaniu** — wspierane natywnie przez Supabase.
- Walidacja nicków (1–32 znaki, trim, bez znaków sterujących), limit długości opisów/notatek.
- Nagłówki bezpieczeństwa (CSP) w Next.js.

### 3.6. Retencja i RODO

- `rooms.last_activity_at` aktualizowane przez każde RPC zmieniające stan pokoju
  (dołączenie, głos, odkrycie, zatwierdzenie, dodanie zadania).
- Codzienne zadanie **`pg_cron`** w bazie: `delete from rooms where last_activity_at < now() - interval '90 days'`
  — usuwanie kaskadowe (FK `on delete cascade`).
- To samo zadanie usuwa **anonimowych użytkowników Auth**, którzy nie należą już do
  żadnego pokoju i są nieaktywni > 90 dni.
- Prowadzący widzi w pokoju informację „Rooms are deleted after 90 days of inactivity”
  i może pobrać eksport przed usunięciem.
- Minimalizacja danych: zbieramy tylko nick i treść zadań/notatek; brak e-maili,
  brak IP w tabelach aplikacji. Analityka produktowa bez cookies śledzących
  (zdarzenia zapisywane we własnej tabeli w tej samej bazie w UE).
- Polityka prywatności (EN) opisująca: administratora, cel, zakres danych, okres
  90 dni, podprzetwarzających (Supabase, Vercel, Cloudflare Turnstile) i region UE.
- Opcjonalnie dla prowadzącego: „Delete room now” (natychmiastowe usunięcie) — Should.
- Test pgTAP: zadanie retencji usuwa wyłącznie pokoje starsze niż 90 dni.

### 3.7. Struktura repozytorium

```
sprintdeck/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                # landing + tworzenie pokoju
│  │  └─ r/[slug]/page.tsx       # pokój (dołączenie + widok sesji)
│  ├─ messages/en.ts             # wszystkie teksty UI (EN)
│  ├─ components/                # UI: karty, lista uczestników, panel wyników…
│  ├─ features/room/             # store stanu pokoju, hooki realtime, akcje RPC
│  └─ lib/
│     ├─ consensus/              # Consensus Engine (czysty TS, bez zależności)
│     ├─ deck.ts                 # definicja talii
│     └─ supabase/               # klienci (browser/server), typy generowane
├─ supabase/
│  ├─ migrations/                # schemat, RLS, RPC, triggery
│  ├─ tests/                     # pgTAP: RLS i RPC
│  └─ seed.sql
├─ e2e/                          # Playwright (multi-uczestnik, offline)
└─ docs/
```

---

## 4. Model danych (MVP)

Zmiany względem specyfikacji: `session_id` → `user_id` (z anonymous auth),
nowa tabela **`items`** (zadanie) między pokojem a rundami, `organizations`/`teams`
odłożone.

```sql
rooms (
  id               uuid pk,
  slug             text unique not null,          -- publiczny identyfikator w linku
  title            text not null check (char_length(title) <= 120),
  status           text not null default 'open',  -- open | closed | archived
  deck             text not null default 'fibonacci',
  owner_id         uuid not null references auth.users,
  host_secret_hash text not null,
  current_item_id  uuid null references items,
  version          bigint not null default 0,     -- do wykrywania pominiętych zdarzeń
  created_at, last_activity_at timestamptz
)

participants (
  id            uuid pk,
  room_id       uuid not null references rooms on delete cascade,
  user_id       uuid not null references auth.users,
  display_name  text not null check (char_length(display_name) between 1 and 32),
  role          text not null,                    -- host | voter | observer
  joined_at, last_seen_at timestamptz,
  unique (room_id, user_id)
)
-- dokładnie jeden host na pokój: unique index (room_id) where role = 'host'

items (                                           -- „zadanie” estymowane w pokoju
  id             uuid pk,
  room_id        uuid not null references rooms on delete cascade,
  title          text not null,
  description    text null,
  position       int not null,
  status         text not null default 'pending', -- pending | estimating | estimated | skipped
  final_estimate text null,                       -- wartość z talii
  finalized_by   uuid null references participants,
  finalized_at   timestamptz null,
  created_at     timestamptz
)

rounds (
  id          uuid pk,
  item_id     uuid not null references items on delete cascade,
  room_id     uuid not null references rooms on delete cascade,  -- denormalizacja pod RLS
  number      int not null,                       -- 1, 2, 3… (ponowne głosowania)
  status      text not null,                      -- voting | revealed
  started_at, revealed_at timestamptz,
  unique (item_id, number)
)
-- maks. jedna aktywna runda na pokój: unique index (room_id) where status = 'voting'

votes (
  id             uuid pk,
  round_id       uuid not null references rounds on delete cascade,
  participant_id uuid not null references participants on delete cascade,
  value          text not null,                   -- walidowane w RPC względem talii
  created_at, updated_at timestamptz,
  unique (round_id, participant_id)
)

decision_notes (
  id             uuid pk,
  item_id        uuid not null references items on delete cascade,
  author_id      uuid not null references participants,
  content        text not null check (char_length(content) <= 2000),
  created_at     timestamptz
)
```

Indeksy: FK (`room_id`, `item_id`, `round_id`), `participants(user_id)`.
Funkcja pomocnicza `is_room_member(room_id)` używana w politykach RLS.

**Statystyk nie zapisujemy** — zawsze wyliczamy je z surowych głosów tym samym
silnikiem. Dzięki temu poprawki progów nie wymagają migracji danych historycznych.

---

## 5. Consensus Engine — specyfikacja implementacyjna

Moduł `src/lib/consensus`, czyste funkcje, zero zależności, 100% pokrycia testami.
**Status: zaimplementowany** (progi w `src/lib/consensus/config.ts`, przypadki w `analyze.test.ts`), symulator pod `/simulator`.

Klasyfikacja liczy odległości w krokach talii, a nie w wartościach, więc działa dla każdej talii porządkowej, także dla talii „Risk” z sekcji 12. Talia o innej liczbie kroków potrzebuje własnych progów i własnego banku pytań.

```ts
analyzeRound(votes: VoteValue[], deck: Deck): RoundAnalysis

type RoundAnalysis = {
  counts: { numeric: number; unknown: number; break: number; total: number };
  stats: { mean; median; modes: number[]; min; max; range } | null;
  distribution: { value: string; count: number }[];   // w kolejności talii
  recommendation: { median: number; nearestDeckValue: string } | null;
  state: 'A_consensus' | 'B_moderate' | 'C_high' | 'D_insufficient';
  pattern: 'unanimous' | 'adjacent' | 'outlier' | 'polarized' | 'wide' | 'insufficient';
  flags: ('high_uncertainty' | 'large_item' | 'break_requested')[];
  questions: QuestionId[];                             // 2–3 pytania dobrane do wzorca
}
```

### 5.1. Statystyki

- Karty `?` i ☕ wyłączone ze statystyk liczbowych (liczone osobno).
- ½ = 0.5. Średnia zaokrąglana do 1 miejsca po przecinku (tylko prezentacja).
- Dominanta: wszystkie wartości z maksymalną liczbą głosów; jeśli każda wartość
  wystąpiła raz → „brak dominanty”.
- **Rekomendacja = mediana.** Jeśli mediana nie należy do talii (np. 3 i 5 → 4),
  pokazujemy „mediana: 4” i osobno „najbliższa karta: 5”.
  Remis odległości → **w górę** (estymaty statystycznie częściej są zaniżone). **Zatwierdzone.**

### 5.2. Klasyfikacja rozbieżności (na indeksach talii, nie na wartościach)

Fibonacci jest skalą ~logarytmiczną, więc odległość mierzymy w **krokach talii**:
`0→0, ½→1, 1→2, 2→3, 3→4, 5→5, 8→6, 13→7, 21→8`.
Dzięki temu „1 vs 2” i „8 vs 13” to ta sama rozbieżność (1 krok) — zgodnie z intuicją zespołów.

Algorytm (progi w jednym obiekcie konfiguracyjnym, do kalibracji):

1. `N` = liczba głosów liczbowych, `Q` = liczba `?`.
   Jeśli `N < 2` **lub** `Q > N` → **D** (`insufficient`).
2. `spread = maxIdx − minIdx`. Jeśli `0` → **A** (`unanimous`).
3. Szukamy **luk**: sąsiednie użyte indeksy oddalone o ≥ 2 kroki (pusta karta pomiędzy).
   - Jeśli po obu stronach luki jest ≥ 25% głosów → **C** (`polarized`) — dwa obozy.
   - Jeśli po jednej stronie jest < 25% głosów **albo pojedynczy głos przy ≥ 3 głosach
     liczbowych** → to **odstające głosy**; wyłączamy je i liczymy spread reszty.
     Reszta ≤ 2 kroki i odstające ≤ ⅓ wszystkich głosów → **B** (`outlier`),
     w przeciwnym razie **C** (`wide`).
4. Spread ≤ 2 bez luk → **B** (`adjacent`).
5. W pozostałych przypadkach (spread ≥ 3) → **C** (`wide`).

Flagi (niezależnie od stanu): `Q ≥ ⅓` aktywnych głosów → `high_uncertainty`;
rekomendacja ≥ 13 → `large_item`; dowolna ☕ → `break_requested`.

Przypadki testowe (zalążek tabeli w Vitest):

| Głosy | Stan | Wzorzec | Komentarz |
|---|---|---|---|
| 5,5,5,5 | A | unanimous | |
| 3,5,5,5 | B | adjacent | spread 1 |
| 3,5,8,5 | B | adjacent | spread 2, bez luk |
| 3,3,8,8 | C | polarized | luka (brak 5), 50/50 |
| 2,3,5,8,13 | C | wide | spread 4, równomiernie |
| 5,5,5,5,21 | B | outlier | 21 = 20% < 25%, reszta zgodna |
| 1,2,3,5,13,21 | C | polarized | luka 5→13, 67/33 |
| 5,?,?,? | D | insufficient | 1 głos liczbowy |
| 3,5,?,? | B | adjacent | + flaga `high_uncertainty` |
| 13,21,21 | B | adjacent | + flaga `large_item` |

### 5.3. Pytania pomocnicze — dobór do wzorca

Bank pytań w pliku z tekstami (łatwa edycja i tłumaczenie). Pokazujemy 2–3,
nie całą listę.

| Wzorzec / flaga | Pytania (przykłady) |
|---|---|
| adjacent | „Co przesądza o tym, że to raczej {niższa} niż {wyższa}?”, „Czy estymata uwzględnia testowanie i wdrożenie?” |
| outlier | „Co widzi {imię} ({wartość}), czego nie widzi reszta?”, „Czy uwzględniliśmy zależności z innymi systemami?”, „Czy widzimy dodatkowe ryzyka lub przypadki brzegowe?” |
| polarized | „Czy wszyscy rozumiemy zakres zadania w ten sam sposób?”, „Czy obie grupy zakładają to samo rozwiązanie techniczne?”, „Czy kryteria akceptacji są wystarczająco precyzyjne?” |
| wide | „Czy wszyscy rozumiemy zakres zadania w ten sam sposób?”, „Czy zadanie nie jest za duże — może warto je podzielić?” |
| high_uncertainty | „Czego brakuje, żeby móc oszacować?”, „Czy potrzebujemy doprecyzowania z PO albo spike'a?” |
| large_item | „Czy da się podzielić to zadanie na mniejsze?” |

Komunikaty stanów (UI po angielsku):

| Stan | Komunikat |
|---|---|
| A | „Full consensus” |
| B | „Worth checking the differences in assumptions” |
| C | „Discuss the differences before you decide” |
| D | „Not enough votes to draw conclusions” |

Bank pytań w UI (EN):

| Wzorzec / flaga | Questions |
|---|---|
| adjacent | “What makes this a {lower} rather than a {higher}?” · “Does the estimate include testing and deployment?” |
| outlier | “What does {name} ({value}) see that the rest of us don't?” · “Have we considered dependencies on other systems?” · “Are there extra risks or edge cases?” |
| polarized | “Do we all understand the scope the same way?” · “Are both groups assuming the same technical approach?” · “Are the acceptance criteria precise enough?” |
| wide | “Do we all understand the scope the same way?” · “Is this item too big — should we split it?” |
| high_uncertainty | “What's missing for us to estimate this?” · “Do we need clarification from the PO or a spike?” |
| large_item | “Can we split this into smaller items?” |

W widoku rundy n+1 pokazujemy porównanie z rundą n (np. „rozrzut: 4 → 1 krok”).

---

## 6. UX — ekrany MVP

1. **Landing** — jedno pole „Nazwa sesji” + „Twój nick” + przycisk. Zero konfiguracji.
2. **Dołączenie** — sam nick (zapamiętany lokalnie na kolejne sesje).
3. **Pokój** (desktop: 3 kolumny, mobile: zakładki):
   - lewa: lista zadań (status, estymata),
   - środek: bieżące zadanie, stół z uczestnikami (zagłosował / nie / offline), talia kart,
   - po odkryciu: panel wyników — rozkład (słupki), mediana/średnia/dominanta,
     stan rozbieżności, 2–3 pytania, przyciski „Głosuj ponownie” / „Zatwierdź”.
   - prawa (lub szuflada): historia rund bieżącego zadania.
4. **Zatwierdzenie** — wybór karty (domyślnie podpowiedź z mediany) + opcjonalna notatka.
5. **Podsumowanie sesji** — tabela zadań, estymat, liczby rund; eksport Markdown/CSV.

Wymagania: mobile-first (duże pola dotyku kart), obsługa klawiatury
(`1–9` wybór karty, `R` odkryj — dla prowadzącego), `aria-pressed` na kartach,
tryb jasny/ciemny.
Język UI: **angielski** (zatwierdzone). Wszystkie teksty w `src/messages/en.ts`.
Wywiady walidacyjne mogą być po polsku — symulator i makiety pokazujemy po angielsku,
żeby od razu sprawdzić zrozumiałość komunikatów.

---

## 7. Backlog MVP (MoSCoW)

**Must** (bez tego nie ma MVP)
- M1 Scaffolding: Next.js + TS + Tailwind, Supabase lokalnie, CI, deploy preview.
- M2 Schemat DB + RLS + RPC + testy pgTAP.
- M3 Anonymous auth, tworzenie pokoju, dołączenie przez link i nick.
- M4 Zadania: dodawanie, wybór bieżącego.
- M5 Runda: start, głosowanie (talia + `?` + ☕), status „zagłosował”, odkrycie przez hosta.
- M6 Realtime (Broadcast + Presence), snapshot przy refresh/reconnect.
- M7 Consensus Engine (lib + testy) i panel wyników.
- M8 Ponowne głosowanie + historia rund.
- M9 Zatwierdzenie estymaty + notatka.
- M10 Testy E2E: 6–10 uczestników, rozłączenie/powrót, próby ataków na ukryte głosy.
- M11 Retencja 90 dni (`pg_cron`) + polityka prywatności (wymóg RODO przed pierwszym pilotażem).

**Should**
- S1 Obserwator, przekazanie roli prowadzącego, sekretny link prowadzącego.
- S2 Podsumowanie sesji + eksport Markdown/CSV.
- S3 Limity nadużyć + Turnstile.
- S4 Porównanie rundy n vs n+1.
- S5 Minimalna analityka produktowa (zdarzenia do metryk z sekcji 9).
- S6 Talia „Risk” z własnymi progami i bankiem pytań (sekcja 12.2).

**Could**
- C1 Skróty klawiszowe, tryb ciemny, animacje odkrycia.
- C2 Usuwanie/edycja zadań, zmiana kolejności drag & drop.
- C3 Podpięcie konta e-mail do sesji anonimowej (zachowanie historii hosta).

**Linia cięcia**: jeśli tydzień 4 się opóźni, S1/S2/S4 przechodzą po MVP;
S3 zostaje przed publicznym udostępnieniem linku.

**Zasady pracy w pojedynkę**
- Jeden branch na funkcję, małe PR-y z CI jako „drugim recenzentem”;
  automatyczny code review (np. Claude) zamiast przeglądu przez współpracownika.
- Najpierw pionowy przekrój (cały przepływ w brzydkiej wersji), potem szlif UI.
- Bez własnych komponentów, gdy jest gotowy (shadcn/ui), bez własnego backendu poza Supabase.
- Zero „infrastruktury na zapas”: brak organizacji/teams, brak kolejek, brak cache.
- Timebox: jeśli zadanie Must przekracza plan o > 50%, upraszczamy je, a nie przesuwamy resztę.

---

## 8. Harmonogram (zmodyfikowany)

Zmiana względem planu bazowego: Consensus Engine (jako biblioteka) i
scaffolding startują równolegle z walidacją w tygodniu 1 — nie zależą od
wyników rozmów, a działający „symulator” silnika podnosi jakość wywiadów.

### Tydzień 1 — walidacja + prototyp silnika
Przy jednej osobie: wywiady to głównie czas kalendarzowy (umawianie), więc
**rekrutację rozmówców startujemy pierwszego dnia**, a rozmowy (5–8 × ~45 min)
przeplatamy z kodowaniem silnika. Część rozmów może spaść na tydzień 2 — to OK.
- Scenariusz wywiadu (problemy z sekcji 2 specyfikacji jako hipotezy do zbicia,
  plus pytania o estymację w zespołach pracujących z AI z sekcji 12.4),
  rekrutacja i 5–8 rozmów ze Scrum Masterami.
- Implementacja `lib/consensus` + tabela przypadków testowych.
- **Symulator**: prosta strona „wpisz głosy → zobacz stan, wzorzec i pytania”.
  W wywiadach: „Oto głosy z waszego ostatniego refinementu — czy ta podpowiedź pomogłaby?”
- Makiety 5 ekranów (sekcja 6), metryki sukcesu (sekcja 9).
- **Wynik**: notatki z rozmów, skalibrowane progi, zatwierdzone makiety, go/no-go na wyróżnik.

### Tydzień 2 — fundamenty
- M1, M2, M3, M4. Testy RLS od pierwszej migracji.
- **Wynik**: można utworzyć pokój, dołączyć z drugiej przeglądarki, dodać zadanie.

### Tydzień 3 — pętla głosowania
- M5, M6, M8 (bez UI statystyk).
- **Wynik**: pełna runda z ukrytymi głosami w czasie rzeczywistym, refresh i reconnect działają.

### Tydzień 4 — Consensus Engine w produkcie
- M7, M9, S1, S2, S4.
- **Wynik**: kompletny przepływ od utworzenia pokoju do zatwierdzonej estymaty i eksportu.

### Tydzień 5 — testy i stabilizacja
- M10, M11, S3, S5. Test obciążeniowy (np. 10 pokoi × 10 uczestników).
- 2–3 sesje użyteczności na prawdziwych refinementach (zespoły z tygodnia 1).
- Poprawki, deploy produkcyjny, polityka prywatności.
- **Wynik**: MVP gotowe do pilotażu z kilkoma zespołami.

### Kiedy potrzebna infrastruktura

| Moment | Potrzebne |
|---|---|
| Tydzień 1–4 | Nic poza lokalnym środowiskiem (Node, Docker, Supabase CLI). |
| Pierwsze sesje użyteczności z zespołami (tydz. 5) | Projekt **Supabase Cloud (Frankfurt)** + **Vercel** — link musi działać poza localhost. Domena opcjonalna (wystarczy `*.vercel.app`). |
| Pilotaż / publiczny link | Domena produkcyjna, klucze Cloudflare Turnstile, polityka prywatności pod stałym adresem. |

### Definition of Done (dla każdego zadania)
Typecheck i lint czyste; testy jednostkowe/DB dla nowej logiki; działa na
mobile (≥ 360 px); żadna wartość głosu nie trafia do klienta przed odkryciem.

---

## 9. Metryki sukcesu (propozycja do potwierdzenia w tyg. 1)

- **Aktywacja**: % pokoi z ≥ 3 uczestnikami i ≥ 1 zatwierdzonym zadaniem.
- **Czas do decyzji**: mediana czasu od startu pierwszej rundy do zatwierdzenia.
- **Skuteczność silnika**: % zadań ze stanem B/C, które po ponownej rundzie przeszły do A/B.
- **Użycie wyróżników**: % zatwierdzeń z notatką; % rund z ponownym głosowaniem.
- **Retencja**: % prowadzących, którzy utworzyli kolejny pokój w ciągu 14 dni.
- **Jakościowo**: „Czy podpowiedzi pomogły w dyskusji?” (1–5) po sesji pilotażowej.
- **Wybór talii**: % pokoi z talią „Risk” w zespołach, które deklarują, że kod pisze głównie AI, i w pozostałych.

---

## 10. Ryzyka

| Ryzyko | Wpływ | Mitigacja |
|---|---|---|
| Consensus Engine nie jest odczuwany jako wartość | wysoki | Walidacja symulatorem w tyg. 1, zanim powstanie reszta produktu. |
| Wyciek głosów przed odkryciem | wysoki (zaufanie) | Dwie warstwy (RLS + payload bez wartości), dedykowane testy pgTAP i E2E. |
| Niespójny stan po rozłączeniu | średni | Wzorzec snapshot + wersjonowanie zdarzeń; testy z `setOffline` w Playwright. |
| Utrata sesji prowadzącego | średni | Przekazanie roli + sekretny link prowadzącego. |
| Nadużycia anonimowego logowania | średni | Turnstile, limity w RPC, czyszczenie nieaktywnych użytkowników anonimowych. |
| Limity planu darmowego Supabase | niski w MVP | Monitorowanie połączeń realtime; przejście na plan Pro przed pilotażem z wieloma zespołami. |
| Harmonogram 5 tyg. przy jednej osobie | średni | Linia cięcia i zasady pracy w pojedynkę z sekcji 7; wywiady równolegle z kodem. |
| Estymacja pracy traci sens w zespołach, w których kod pisze AI | wysoki | Zmiana roli na konsensus co do zrozumienia i ryzyka (sekcja 12); hipoteza sprawdzana w wywiadach z tygodnia 1. |
| Brak drugiej pary oczu przy bezpieczeństwie | średni | Testy pgTAP dla każdej polityki RLS i RPC, automatyczny security review PR-ów. |

---

## 11. Pytania otwarte

Rozstrzygnięte: język (EN), imienne głosy (tak), region i retencja (Frankfurt, 90 dni),
zasoby (jedna osoba), harmonogram (orientacyjny), mediana (remis w górę),
infrastruktura (lokalnie do tyg. 5) — patrz sekcja 0.

1. Czy prowadzący ma móc działać bez konta także w docelowej wersji płatnej?
   Nierozstrzygnięte — nie blokuje MVP. Anonymous auth pozwala później podpiąć
   konto do istniejącej sesji bez utraty danych.
2. Która talia jest domyślna: Fibonacci czy „Risk”? Rozstrzygają wywiady z tygodnia 1
   (sekcja 12.4). Nie blokuje budowy, bo talia jest parametrem pokoju.

---

## 12. Rola w procesie AI-native: konsensus co do zrozumienia i ryzyka

Decyzja ekosystemu: pdi `docs/decyzje.md`, D-E1 (2026-10-25).

### 12.1. Dlaczego

Planning poker łączy cztery funkcje. Gdy kod pisze AI, trzy z nich przejmuje automat, a czwarta staje się
ważniejsza niż dziś:

| Funkcja | Kto ją przejmuje |
|---|---|
| Prognoza („kiedy to będzie?”) | automat: liczba cięć z planu tf × historyczny czas przepływu z ShipScope |
| Rozmiar („czy to nie za duże?”) | automat: reguły kształtu historyjki w ci_for_sdlc (STORY-002), limit kawałków w Talosie |
| Koszt kontra wartość | automat: raport kosztu Talosa (czas, tokeny, $) |
| Wspólne zrozumienie („czy myślimy o tym samym?”) | **ludzie, w sprintdecku** |

Wąskim gardłem przestaje być pisanie kodu, a stają się weryfikacja, decyzje i niepewność. AI zbuduje dokładnie to,
co jest napisane, więc różnica w zrozumieniu, której nikt nie wychwycił, od razu zamienia się w zły kod. Consensus
Engine wykrywa właśnie takie różnice, więc zostaje rdzeniem produktu. Zmienia się tylko to, nad czym zespół głosuje.

### 12.2. Co się zmienia w MVP

Mechanika pokoju (zadania, rundy, ukryte głosy, odkrycie, ponowna runda, zatwierdzenie z notatką) i model danych
zostają bez zmian. Dochodzi jedna pozycja w backlogu (S6). **Status: zrobione** (rejestr decyzji, 2026-10-26):

- **Talia „Risk”** w `src/lib/deck.ts`: `Low`, `Medium`, `High`, `Very high`, `?`, ☕. Pytanie rundy: „How risky is
  it to ship this as specified?”. Głos dotyczy ryzyka niezrozumienia, trudności weryfikacji i zasięgu skutków.
- **Progi per talia** w `src/lib/consensus/config.ts`: talia „Risk” ma 4 kroki zamiast 9, więc
  `maxClusteredSpread` i `minGapSteps` wymagają osobnych wartości. Flaga `large_item` nie dotyczy tej talii; w jej
  miejsce flaga `high_risk` przy rekomendacji `High` i wyżej.
- **Bank pytań per talia** w `src/lib/consensus/questions.ts` i `src/messages/en.ts`. Pytania o wysiłek („Does the
  estimate include testing and deployment?”) zastępują pytania o zrozumienie i weryfikację, np. „What does {name}
  ({value}) know about this that the rest of us don't?”, „How will we know it works?”, „What breaks if this is
  wrong?”, „Are the acceptance criteria precise enough for someone who wasn't here?”.
- **Testy** w `analyze.test.ts`: tabela przypadków dla talii „Risk”, tak jak dla Fibonacciego.
- **Symulator** pozwala wybrać talię, żeby pokazywać ją w wywiadach.

### 12.3. Po MVP (połączenia z ekosystemem)

Wymagają kont, importu z Jiry i integracji, więc są poza zakresem MVP:

| Co | Skąd dane | Po co |
|---|---|---|
| Szacunek automatu przy zadaniu (liczba cięć, koszt, przewidywany czas) | plan tf, raporty Talosa, ShipScope | ludzie widzą prognozę i nie liczą jej sami |
| Głos AI jako uczestnik (oznaczony, nieimienny) | ten sam szacunek przełożony na kartę talii | rozbieżność „AI mówi Low, zespół mówi High” traktujemy jak głos odstający i pytamy o powód |
| Sesja wyzwalana przez ci_for_sdlc | otwarte pytania, nowa domena, historyjka po podziale | ludzie spotykają się tylko tam, gdzie automat zgłasza wątpliwość |
| Stan kształtu historyjki przed głosowaniem, „Zgłoś niejasność” po wyniku „dwa obozy” | ci_for_sdlc (plan G1/G2, krok G2.6) | rozbieżność staje się pytaniem przy historyjce |
| Notatka z zatwierdzenia jako decyzja | rejestr pdi | uzasadnienie nie ginie po spotkaniu |
| Kalibracja szacunku automatu | rzeczywisty czas z ShipScope | luka G3 z mapy ekosystemu |

### 12.4. Pytania do wywiadów (tydzień 1)

- Ile kodu w waszym zespole pisze dziś AI? Czy to się zmienia?
- Czy nadal estymujecie? Jeśli tak, co właściwie oznacza wynik, gdy kod pisze agent?
- Co zastąpiło estymację tam, gdzie ją porzuciliście (liczenie zadań, prognoza z historii, nic)?
- Kiedy ostatnio zespół zbudował coś innego, niż miał na myśli PO? Czy rozmowa przy estymacji by to wychwyciła?
- Pokaz w symulatorze: te same głosy na talii Fibonacciego i na talii „Risk”. Która rozmowa byłaby bardziej
  przydatna?

Wynik wywiadów rozstrzyga pytanie otwarte 2 (domyślna talia) i trafia do rejestru decyzji w sekcji 0.

### 12.5. Czego nie zmieniamy

- Talia Fibonacciego zostaje jako pełnoprawny tryb, m.in. dla zespołów, w których kod piszą ludzie.
- Silnik nadal jest czystą, deterministyczną biblioteką bez zależności.
- Linia cięcia z sekcji 7 obowiązuje: S6 przechodzi po MVP, jeśli tydzień 4 się opóźni.
