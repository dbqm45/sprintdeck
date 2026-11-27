# Sprintdeck

Planning Poker z **Consensus Engine** — aplikacja, która nie tylko zbiera głosy,
ale pomaga zespołowi zrozumieć rozbieżności i szybciej dojść do wspólnej decyzji.

Status: MVP w budowie. Plan realizacji: [docs/PLAN.md](docs/PLAN.md).

## Uruchomienie lokalne

Wymagania: Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:3000 — symulator: /simulator
```

| Skrypt | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm test` | testy jednostkowe (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | generuje typy tras i uruchamia `tsc` |
| `npm run build` | build produkcyjny |
| `npm run db:start` | lokalny Supabase w Dockerze (pierwsze uruchomienie pobiera obrazy) |
| `npm run db:test` | testy bazy (pgTAP): RLS, RPC, ukryte głosy, retencja |
| `npm run db:reset` | odtwarza bazę z migracji |
| `npm run db:types` | regeneruje `src/lib/supabase/database.types.ts` po zmianie migracji |
| `npm run db:env` | zapisuje klucze lokalnego Supabase do `.env.local` |
| `npm run e2e` | testy end-to-end (Playwright): buduje aplikację, uruchamia ją i przechodzi przepływy z kilkoma uczestnikami |

Backend pokoi wymaga Dockera. Po `npm run db:start` uruchom `npm run db:env` — zapisze klucze
lokalnego Supabase do `.env.local` (ręcznie: skopiuj `.env.example` i wpisz `PUBLISHABLE_KEY`
z `npx supabase status`). Testy E2E potrzebują tego samego oraz przeglądarki:
`npx playwright install chromium` (raz).

## Logowanie przez suitę i pokój z DI Decision

Plan: dbqm45/pdi `docs/plan-pokoj-sprintdeck.md`. Bez tych ustawień wszystko działa jak dotąd, z logowaniem
anonimowym.

- **Logowanie przez suitę** („Sign in with the suite”, `/auth/suite/login`): osoba loguje się w DI Identity (Keycloak,
  realm `suite`, klient `sprintdeck`). Serwer sprintdecka prowadzi kod z PKCE, z zakresem tylko `openid`, i przekazuje
  ID token do Supabase Auth (`grant_type=id_token`, dostawca `keycloak`, `email_optional`). Powstaje nieanonimowy
  użytkownik z nazwą z suity, bez e-maila. Wchodzi tylko członek organizacji `SUITE_ORGANIZATION` z rolą
  `sprintdeck:member`; inni widzą powód. Dlaczego nie zwykłe przekierowanie Supabase: prosi zawsze o zakres `email`,
  którego realm tej aplikacji nie daje (DI3).
- **Pokój z agendy „Discuss with team”** (`/from-pdi`): link z DI Decision niesie sprawy w części `#` adresu, podpisane
  HMAC-SHA256 wspólnym sekretem (`PDI_SPRINTDECK_SECRET`) i ważne do godziny. Serwer sprawdza podpis
  (`/api/pdi-agenda`, `src/lib/pdi-agenda.ts`). Osoba zalogowana przez suitę zostaje prowadzącą pokoju z talią
  „Risk”, a każda sprawa staje się zadaniem. Ten sam link otwarty drugi raz w tej przeglądarce wraca do tego samego
  pokoju. Każde zadanie pamięta, z której sprawy w pdi pochodzi (`items.external_ref`, funkcje `set_item_ref` i
  `get_item_refs`). Decyzję zapisuje się dalej w DI Decision.
- **Wyniki z powrotem do DI Decision** (plan: dbqm45/pdi `docs/plan-wyniki-sprintdecka.md`): w podsumowaniu pokoju
  prowadzący ma „Send results to DI Decision”, gdy ustawiono `NEXT_PUBLIC_PDI_URL`. Serwer (`/api/pdi-results`,
  `src/lib/pdi-results.ts`) sam czyta stan pokoju tokenem prowadzącego i dla zadań z pdi zbiera:
  - ocenę końcową;
  - głosy ostatniej odkrytej rundy policzone po kartach, bez nazwisk;
  - stan zgody, liczbę rund i do trzech notatek.

  Podpisuje to tym samym sekretem i odsyła przeglądarkę na `<pdi>/discuss/results`. Tam decydent ogląda wyniki i
  dołącza je do agendy.

Lokalnie:
1. W `/etc/hosts`: `127.0.0.1 host.docker.internal`; w realmie klient `sprintdeck` z
   `REDIRECT_SPRINTDECK=http://127.0.0.1:3000/auth/suite/callback` (di-identity `configure`) i rola `sprintdeck:member`
   dla osoby.
2. `SUPABASE_AUTH_EXTERNAL_KEYCLOAK_URL=http://host.docker.internal:8180/realms/suite` i
   `SUPABASE_AUTH_EXTERNAL_KEYCLOAK_SECRET=<sekret klienta sprintdeck>` w środowisku, potem `npm run db:start`.
3. W `.env.local`: `NEXT_PUBLIC_SUITE_SIGN_IN=1`, `SUITE_ISSUER` (ten sam adres), `SUITE_CLIENT_SECRET`,
   `SUITE_ORGANIZATION`, `PDI_SPRINTDECK_SECRET`; potem `npm run dev`.

## Struktura

- `src/lib/consensus` — Consensus Engine: statystyki, klasyfikacja rozbieżności, dobór pytań (czysty TS, bez zależności).
- `src/lib/deck.ts` — definicja talii.
- `src/app/globals.css` — tokeny design systemu (kolory jasny/ciemny, typografia, promienie, cienie) jako motyw Tailwind; domyślna paleta Tailwind jest wyłączona.
- `src/components/ui` — komponenty bazowe: Button, Panel, Chip/Tag, Badge, Tabs, TextField, SegmentedControl, PokerCard, Wordmark.
- `src/features/consensus` — widoki wyniku Consensus Engine: wykres rozkładu głosów, statystyki, pytania, plakietka stanu.
- `src/messages/en.ts` — wszystkie teksty interfejsu (EN).
- `src/features/simulator` + `src/app/simulator` — symulator silnika do rozmów walidacyjnych.
- `src/features/room` + `src/app/r/[slug]` — pokój: dołączenie, głosowanie, odkrycie z analizą silnika, zatwierdzenie, podsumowanie z eksportem. Formularz tworzenia pokoju jest na stronie głównej.
- `supabase/migrations` — backend pokoi: tabele, RLS (tylko odczyt dla członków pokoju), funkcje RPC dla wszystkich zapisów, zdarzenia realtime na kanale `room:<id>`, retencja 90 dni (`pg_cron`).
- `supabase/tests` — testy pgTAP.
- `src/lib/supabase` — klient przeglądarki (sesja anonimowa), wygenerowane typy bazy i typy odpowiedzi RPC.

## Przed publicznym linkiem: ochrona przed nadużyciami

Limity działają zawsze (w bazie, `supabase/migrations/*_limits.sql`):

- 120 zapisów na minutę na użytkownika (głosy, zadania, rundy, role, dołączenia) — człowiek do tego nie dochodzi, skrypt zalewający pokój tak;
- 10 nowych pokoi i 30 dołączeń na godzinę na użytkownika, maks. 50 osób w pokoju, 200 zadań w pokoju;
- anonimowe logowania: limit Supabase Auth na adres IP (`auth.rate_limit.anonymous_users`).

**Cloudflare Turnstile** sprawdza, czy pierwsze anonimowe logowanie w przeglądarce robi człowiek
(potem sesja zostaje w przeglądarce). Lokalnie jest wyłączony. Na produkcji:

1. Cloudflare → Turnstile → dodaj widget dla domeny aplikacji (tryb *Managed*), zapisz *site key* i *secret key*.
2. Supabase (projekt) → Authentication → Bot and Abuse Protection → włącz CAPTCHA, dostawca Turnstile, wklej *secret key*.
3. Vercel (zmienne środowiskowe) → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = *site key*, potem nowy deploy.

Kolejność ma znaczenie: z włączoną CAPTCHĄ w Supabase, a bez klucza w aplikacji nikt nowy się nie zaloguje.
Testy E2E budują aplikację z testowym kluczem Cloudflare i podstawiają skrypt Turnstile, więc sprawdzają,
że token trafia do Supabase Auth — samą weryfikację u Cloudflare robi Supabase.

**Nagłówki bezpieczeństwa** (`src/lib/security-headers.ts`, podpięte w `next.config.ts`) idą z każdą odpowiedzią:
Content Security Policy (skrypty tylko z tej domeny i Cloudflare Turnstile, połączenia tylko do tej domeny i Supabase,
zakaz osadzania w ramkach), `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`, HSTS.
CSP jest statyczny, bez nonce: nonce wymagałby renderowania każdej strony na żądanie, co wyłącza Partial Prerendering
(`cacheComponents`). Dlatego skrypty i style mają `'unsafe-inline'`. Supabase w CSP bierze się z
`NEXT_PUBLIC_SUPABASE_URL` w czasie budowania — po zmianie projektu Supabase potrzebny jest nowy build.
