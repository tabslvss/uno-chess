# Art assets — image prompts

Every image below has a fixed **file name**. Generate it in ChatGPT, name it exactly as shown and send it over
(or drop it at the path yourself) — the site picks each file up automatically and falls back to plain
placeholders until then.

**Sizes.** ChatGPT's image model outputs 1024×1024, 1536×1024 or 1024×1536, so each prompt asks for one of those;
the "final" column is what the file gets resized to when it's added. Always ask for **PNG with a transparent
background** where the prompt says so.

**Tip.** Generate each group (icons, bots, pieces) in **one ChatGPT conversation** and send the group's style
message first, so every image comes out in the same style.

---

## 1. Interface icons (15)

| File | Generate | Final | Where it shows |
|---|---|---|---|
| `icons/play.png` | 1024×1024, transparent | 128×128 | Sidebar "Play", home "Play Online" button, Play page title |
| `icons/bots.png` | 1024×1024, transparent | 128×128 | Sidebar "Bots", "Play a Bot" button, Bots tab |
| `icons/friends.png` | 1024×1024, transparent | 128×128 | Sidebar "Friends", Friend tab |
| `icons/leaderboard.png` | 1024×1024, transparent | 128×128 | Sidebar "Leaderboard", leaderboard title |
| `icons/learn.png` | 1024×1024, transparent | 128×128 | Sidebar "Learn", rules title |
| `icons/settings.png` | 1024×1024, transparent | 128×128 | Sidebar "Settings", settings title |
| `icons/sun.png` | 1024×1024, transparent | 128×128 | "Light mode" toggle |
| `icons/moon.png` | 1024×1024, transparent | 128×128 | "Dark mode" toggle |
| `icons/online.png` | 1024×1024, transparent | 128×128 | Online tab, Casual mode |
| `icons/ranked.png` | 1024×1024, transparent | 128×128 | Ranked mode |
| `icons/local.png` | 1024×1024, transparent | 128×128 | Pass & play tab |
| `icons/bullet.png` | 1024×1024, transparent | 128×128 | Bullet time controls / leaderboard tab |
| `icons/blitz.png` | 1024×1024, transparent | 128×128 | Blitz time controls / leaderboard tab |
| `icons/rapid.png` | 1024×1024, transparent | 128×128 | Rapid time controls / leaderboard tab |
| `icons/untimed.png` | 1024×1024, transparent | 128×128 | "Untimed" option for bot and local games |

**Style message (send first):**
> I'm making a set of 15 navigation icons for an online chess-and-card game website with a dark charcoal background (#302E2B), in the style of chess.com's left-sidebar icons. Style for every icon: a single bold, chunky object, slightly three-quarter view, smooth glossy 3D-ish illustration with soft shading, a subtle highlight on the top-left and a gentle darker shade at the bottom, clean shapes with no thin details (it must read clearly at 24×24 pixels), bright saturated colours from this palette: red #E5483B, yellow #F2C22C, green #3AA65A, blue #2F74D6, warm white #F7F3EA, charcoal #3A3734. Object centred and filling about 80% of the canvas. No text, no letters, no outline frame, no background shape or circle behind it, no drop shadow. Not an emoji. PNG with transparent background, 1024×1024. Keep exactly the same style, lighting and level of detail for all 15 icons. I'll describe them one at a time.

Then send these one by one:

- **play** — "Icon 1 (play): a hand holding a fan of three playing cards — red, yellow and blue — with a small white chess pawn printed in the middle of the front card."
- **bots** — "Icon 2 (bots): a friendly rounded robot head with a white faceplate, two glowing blue eyes, a small antenna with a red ball on top, and short grey ear bolts."
- **friends** — "Icon 3 (friends): two chess pawns side by side, one white and one red, leaning toward each other like friends."
- **leaderboard** — "Icon 4 (leaderboard): a shiny golden trophy cup with two handles on a short dark base, a small red ribbon tied around the stem."
- **learn** — "Icon 5 (learn): a closed thick hardcover book in green with a gold bookmark ribbon, and a single playing card sticking out of the pages."
- **settings** — "Icon 6 (settings): a chunky grey metal cog wheel with rounded teeth and a red centre."
- **sun** — "Icon 7 (sun): a bright yellow-orange sun disc with short rounded rays."
- **moon** — "Icon 8 (moon): a pale yellow crescent moon with two tiny stars beside it."
- **online** — "Icon 9 (online): a blue globe with green continents and a small red location pin on top."
- **ranked** — "Icon 10 (ranked): a golden royal crown with three points, each tipped with a small red gem."
- **local** — "Icon 11 (local): a smartphone lying slightly tilted, its screen showing a tiny green-and-cream chessboard, with two small hands reaching toward it from either side."
- **bullet** — "Icon 12 (bullet): a bright yellow lightning bolt."
- **blitz** — "Icon 13 (blitz): an orange-red flame."
- **rapid** — "Icon 14 (rapid): a classic hourglass with a wooden frame and golden sand."
- **untimed** — "Icon 15 (untimed): a warm red coffee mug with a little curl of steam."

---

## 2. Bot portraits (4)

| File | Generate | Final | Where it shows |
|---|---|---|---|
| `bots/pebble.png` | 1024×1024 | 512×512 | Home bot grid, Play → Bots, in-game player bar |
| `bots/biscuit.png` | 1024×1024 | 512×512 | same |
| `bots/sage.png` | 1024×1024 | 512×512 | same |
| `bots/dealer.png` | 1024×1024 | 512×512 | same |

**Style message (send first):**
> I'm making character portraits for four computer opponents in an online chess-and-card game, in the style of the bot characters on chess.com: friendly, polished 2D digital illustration, semi-realistic cartoon proportions, clean shapes, soft cel shading with gentle gradients, subtle rim light, warm and approachable expressions. Head-and-shoulders bust, character centred and facing slightly toward the viewer, filling about 75% of the frame, eyes on the upper third. Solid flat background colour (I'll give one per character), no text, no logo, no border, no frame. Square 1024×1024. Keep exactly the same rendering style, lighting and framing for all four.

- **pebble** (beginner, ~400) — "Character 1, Pebble: a small, round, smooth grey river stone with a tiny green sprout with two leaves growing from the top of its head, big shiny dark eyes, rosy cheeks and a shy, happy little smile. Looks a bit sleepy and very gentle. Background solid soft sage green #DCE8D2."
- **biscuit** (casual, ~900) — "Character 2, Biscuit: an energetic, cheerful anthropomorphic chocolate-chip cookie with a golden-brown crumbly texture, chocolate chips on its face, a wide excited open-mouth grin, eyebrows raised, a small bite missing from one edge. Playful and a bit reckless. Background solid warm butter yellow #F6E3B4."
- **sage** (strong, ~1400) — "Character 3, Sage: a wise, calm brown-and-cream owl with soft feathers, wearing round wire-rimmed glasses, a small green leaf tucked behind one ear tuft, a knowing half-smile, holding a single playing card against its chest with one wing. Background solid dusty blue #D5E2F0."
- **dealer** (expert, ~1800) — "Character 4, The Dealer: a confident, charismatic card-table dealer — a man in his 40s with a neatly groomed curled moustache, a black top hat with a red band, a black waistcoat over a white shirt and a red bow tie, one eyebrow raised and a sly smile, fanning three playing cards in one gloved hand near his face. Background solid muted rose #F0D3CD."

---

## 3. Logo

| File | Generate | Final | Where it shows |
|---|---|---|---|
| `brand/logo.png` | 1024×1024, transparent | 512×512 | Sidebar, mobile header, browser tab icon |

> Design a simple, bold app-icon logo mark for "UNO Chess", an online game that mixes chess and UNO cards. Two playing cards slightly fanned and overlapping, the front card bright red (#E5483B) and the back card blue (#2F74D6), each with a thick dark charcoal (#262421) outline and rounded corners, a white tilted oval in the middle of the front card like an UNO card, and a solid black chess king silhouette standing inside the oval. Flat vector style, only a very subtle highlight, no text, centred with generous padding, must stay recognisable at 32×32 pixels. PNG with transparent background, 1024×1024.

---

## 4. Chess pieces (12, optional)

| File | Generate | Final |
|---|---|---|
| `pieces/wK.png` `wQ` `wR` `wB` `wN` `wP` `bK` `bQ` `bR` `bB` `bN` `bP` | 1024×1024 each, transparent | 256×256 each |

Used on every board once **all 12** files exist.

**Style message (send first):**
> I'm making a complete chess piece set for an online game, one piece per image. Style for every piece: modern, clean, slightly chunky 2D game pieces like chess.com's "neo" set — smooth rounded silhouettes, soft vertical gradient shading, a thin darker outline, a subtle highlight on the upper left. White pieces are warm ivory (#F7F3EA) with a light grey outline; black pieces are deep charcoal (#3A3734) with a slightly lighter rim. Piece shown from the front, upright, centred, bottom of the base at 90% of the image height, filling about 80% of the height (pawns a bit smaller, kings the tallest). No board, no ground shadow, no text. PNG with transparent background, 1024×1024. Same style, lighting and scale for all 12.

Then: "white king", "white queen", "white rook", "white bishop", "white knight", "white pawn", "black king", "black queen", "black rook", "black bishop", "black knight", "black pawn" — saved as `wK.png`, `wQ.png`, `wR.png`, `wB.png`, `wN.png`, `wP.png`, `bK.png`, `bQ.png`, `bR.png`, `bB.png`, `bN.png`, `bP.png`.

---

## 5. Extras (optional)

| File | Generate | Final | Where it shows |
|---|---|---|---|
| `brand/empty.png` | 1536×1024 | 1200×800 | 404 page |
| `og-image.png` | 1536×1024 | 1200×630 | Link previews (Discord, iMessage, X…) |

- **empty** — "A cosy flat illustration of a chessboard on a wooden table with a few scattered UNO-style playing cards and one chess pawn tipped over on its side, warm lamp light from the top left, dark charcoal background (#302E2B) fading at the edges, muted colours with red (#E5483B) accents, plenty of empty space on the right half, no text, no logos. 1536×1024."
- **og-image** — "Wide promotional banner for an online game called UNO Chess: on the left a large chessboard seen slightly from above with green and cream squares, on the right a fan of four colourful UNO-style cards (red, yellow, green, blue) overlapping the board's edge, dark charcoal background (#302E2B), soft dramatic lighting, polished game key art, leave the top-left third fairly empty for a title, no text, no logos. 1536×1024."
