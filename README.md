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
