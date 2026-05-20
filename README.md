# UNO Chess — Royal Edition

Chess + UNO hybrid with a **chess.js** board (via **react-chessboard**), letter cards **A–G**, and online / AI modes.

## Run

```bash
npm install
npm run dev
```

This starts **Vite** (http://localhost:5173) and the **Socket.io** server (port 3001).

- Web only: `npm run dev:web`
- Server only: `npm run server`

## Modes

| Mode | Description |
|------|-------------|
| **Local** | Two players on one screen |
| **vs AI** | Play White or Black against a simple AI |
| **Online** | Host creates a room code; friend joins |

## Card rules

- **Draw 1** random card at the start of each turn (no large starting hand).
- **A–G** unlock that rank and file (A = rank 1 & a-file … G = rank 7 & g-file).
- **Wild**, **Reverse**, **Skip** — no +2 or +4 cards.
- Standard win/lose: king capture (Reverse veto), UNO call, six idle turns = draw.

## API

```ts
import { UnoChess } from './game/api';

let state = UnoChess.newGame();
state = UnoChess.apply(state, { type: 'playCard', cardId: '...' }).state;
```

## Stack

- React + Vite + TypeScript
- chess.js + react-chessboard
- Socket.io (multiplayer)
- Zustand + Framer Motion
