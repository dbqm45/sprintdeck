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

## Struktura

- `src/lib/consensus` — Consensus Engine: statystyki, klasyfikacja rozbieżności, dobór pytań (czysty TS, bez zależności).
- `src/lib/deck.ts` — definicja talii.
- `src/app/globals.css` — tokeny design systemu (kolory jasny/ciemny, typografia, promienie, cienie) jako motyw Tailwind; domyślna paleta Tailwind jest wyłączona.
- `src/components/ui` — komponenty bazowe: Button, Panel, Chip/Tag, Badge, Tabs, TextField, SegmentedControl, PokerCard, Wordmark.
- `src/features/consensus` — widoki wyniku Consensus Engine: wykres rozkładu głosów, statystyki, pytania, plakietka stanu.
- `src/messages/en.ts` — wszystkie teksty interfejsu (EN).
- `src/features/simulator` + `src/app/simulator` — symulator silnika do rozmów walidacyjnych.
