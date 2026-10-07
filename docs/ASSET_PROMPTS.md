# Art assets — what's needed and how to make it

The site already works with the art that's in the repo. Every item below is an **optional upgrade**:
drop the finished file at the path shown and it's picked up automatically — no code changes.
(Or send the images to Claude and it will resize, slice and commit them.)

Already sourced from the web, nothing to do:

| Asset | Source | Licence |
|---|---|---|
| Sidebar / menu icons (`public/icons/*.svg`) | [Microsoft Fluent Emoji (flat)](https://github.com/microsoft/fluentui-emoji) via Iconify | MIT |
| Player avatars | [DiceBear](https://www.dicebear.com) *Adventurer* style API | free to use — see DiceBear's licence page |
| UNO cards | existing card art in `src/assets/cards` (+ generated Draw Two) | project |

ChatGPT's image model outputs **1024×1024**, **1536×1024** or **1024×1536** — generate at those sizes; final sizes are listed per asset.
Ask for a **transparent background** where noted (say "PNG with transparent background").

---

## 1. Bot portraits × 4 (highest impact)

| | |
|---|---|
| Files | `public/bots/pebble.png`, `public/bots/biscuit.png`, `public/bots/sage.png`, `public/bots/dealer.png` |
| Generate at | 1024×1024 (square) |
| Final | 512×512 PNG, < 200 KB each |
| Used in | Home page bot grid, Play → Bots, player strip in bot games |

Generate all four in **one conversation** so the style stays consistent. Start with this message, then ask for each bot in turn.

**Style message (send first):**
> I'm making character portraits for four computer opponents in an online chess-and-card game, in the style of the bot characters on chess.com: friendly, polished 2D digital illustration, semi-realistic cartoon proportions, clean shapes, soft cel shading with gentle gradients, subtle rim light, warm and approachable expressions. Head-and-shoulders bust, character centred and facing slightly toward the viewer, filling about 75% of the frame, eyes on the upper third. Solid flat background colour (I'll give one per character), no text, no logo, no border, no frame, no drop shadow on the background. Square 1024×1024. Keep exactly the same rendering style, lighting and framing for all four.

**Pebble (beginner, ~400):**
> Character 1 — "Pebble": a small, round, smooth grey river stone with a tiny green sprout with two leaves growing from the top of its head, big shiny dark eyes, rosy cheeks and a shy, happy little smile. Looks a bit sleepy and very gentle. Background solid soft sage green #DCE8D2.

**Biscuit (casual, ~900):**
> Character 2 — "Biscuit": an energetic, cheerful anthropomorphic chocolate-chip cookie with a golden-brown crumbly texture, chocolate chips scattered on its face, a wide excited open-mouth grin, eyebrows raised, a tiny bite missing from one edge, little motion sparkles near its head. Playful and a bit reckless. Background solid warm butter yellow #F6E3B4.

**Sage (strong, ~1400):**
> Character 3 — "Sage": a wise, calm brown-and-cream owl with soft feathers, wearing round wire-rimmed glasses, a small green leaf tucked behind one ear tuft, a knowing half-smile, holding a single playing card fanned against its chest with one wing. Thoughtful and clever. Background solid dusty blue #D5E2F0.

**The Dealer (expert, ~1800):**
> Character 4 — "The Dealer": a confident, charismatic card-table dealer — a man in his 40s with a neatly groomed curled moustache, wearing a black top hat with a red band, a black waistcoat over a white shirt and a red bow tie, one eyebrow raised and a sly smile, fanning three playing cards in one gloved hand near his face. Mysterious but friendly. Background solid muted rose #F0D3CD.

---

## 2. Logo mark

| | |
|---|---|
| File | `public/brand/logo.png` |
| Generate at | 1024×1024, transparent background |
| Final | 512×512 PNG (transparent), also used for the favicon/app icon |
| Used in | Sidebar, mobile header, browser tab |

> Design a simple, bold app-icon logo mark for "UNO Chess", an online game that mixes chess and UNO cards. Two playing cards slightly fanned and overlapping, the front card bright red (#E5483B) and the back card blue (#2F74D6), each with a thick dark charcoal (#262421) outline and rounded corners, a white tilted oval in the middle of the front card like an UNO card, and a solid black chess king silhouette standing inside the oval. Flat vector style, no gradients except a very subtle highlight, no text, centred, generous padding, must stay recognisable at 32×32 pixels. PNG with transparent background, 1024×1024.

---

## 3. Custom chess piece set (optional, big visual upgrade)

| | |
|---|---|
| Files | `public/pieces/wK.png wQ wR wB wN wP bK bQ bR bB bN bP` (12 files) |
| Generate at | 1536×1024, transparent background — one sprite sheet |
| Final | 12 × 256×256 PNG (transparent) — Claude can slice the sheet for you |
| Used in | Every board (game + home page). Only switches on when all 12 files exist. |

> Create a complete chess piece set as a sprite sheet on a transparent background, 1536×1024, laid out as a grid of 6 columns and 2 rows with equal spacing. Top row, left to right: white king, white queen, white rook, white bishop, white knight, white pawn. Bottom row, same order, the black pieces. Style: modern, clean, slightly chunky 2D game pieces like chess.com's "neo" set — smooth rounded silhouettes, soft vertical gradient shading, a thin darker outline, a subtle highlight on the upper left. White pieces are warm ivory (#F7F3EA) with a light grey outline; black pieces are deep charcoal (#3A3734) with a slightly lighter rim. Every piece is shown from the front, upright, centred in its cell, the same baseline and similar visual weight (pawn smallest, king tallest). No board, no shadows on the ground, no text or labels.

---

## 4. Optional extras

**Empty-state / 404 illustration** — `public/brand/empty.png`, generate 1536×1024, final 1200×800:
> A cosy flat illustration of a chessboard on a wooden table with a few scattered UNO-style playing cards and one chess pawn tipped over on its side, warm lamp light from the top left, dark charcoal background (#302E2B) fading at the edges, muted colours with red (#E5483B) accents, plenty of empty space on the right half for text, no text, no logos.

**Social share image** — `public/og-image.png`, final 1200×630 (one is already generated by script; replace only if you want illustrated art):
> Wide banner, 1536×1024, for an online game called UNO Chess: on the left a large chessboard seen slightly from above with green and cream squares, on the right a fan of four colourful UNO-style cards (red, yellow, green, blue) overlapping the board's edge, dark charcoal background (#302E2B), dramatic soft lighting, polished game-store key art, leave the top-left third fairly empty for a title, no text, no logos.
