# SKILL — MemoryMatch on Intercom

**Purpose:** Agent-oriented instructions for deploying, operating, and extending the MemoryMatch P2P memory card game on Trac Network via the Intercom stack.

Read this file **before** writing any code or running any commands.

---

## What this app does

MemoryMatch is a P2P memory card game that runs on the Intercom sidechannel layer of Trac Network.

- **Solo mode:** single-player, flip pairs of cards, race for the lowest move count.
- **P2P multiplayer:** challenge any connected peer over an Intercom sidechannel. Turns alternate; matching a pair lets you go again.
- **On-chain leaderboard:** completed games are recorded to the Trac Network contract state for persistent, verifiable rankings.

---

## Prerequisites & Runtime

| Requirement | Notes |
|---|---|
| Node.js ≥ 20 | Must be installed on the machine |
| Pear runtime | `npm install -g pear` — **always use Pear, never plain node** |
| git | Standard install |
| Network | Outbound UDP/TCP for Hyperswarm hole-punching |

---

## First-time Setup

```bash
git clone https://github.com/YOUR_USERNAME/intercom memorymatch
cd memorymatch
npm install
npm pkg set overrides.trac-wallet=1.0.1
rm -rf node_modules package-lock.json
npm install
```

---

## Running the App

### Admin / Bootstrap peer (first peer on the network)

```bash
pear run --tmp-store --no-pre . \
  --peer-store-name admin \
  --msb-store-name admin-msb \
  --subnet-channel memorymatch-v1
```

On first run:
1. The app prints your **Peer Writer key** — copy it.
2. Type `/exit` and restart.
3. On restart, type `/add_admin --address <YourPeerAddress>` to promote yourself to admin.

### Joining peer (subsequent peers)

Use the **exact same command** on a different machine or in a different terminal with a different `--peer-store-name`:

```bash
pear run --tmp-store --no-pre . \
  --peer-store-name peer1 \
  --msb-store-name peer1-msb \
  --subnet-channel memorymatch-v1
```

### Solo mode (no P2P needed)

```bash
pear run --tmp-store --no-pre . --solo \
  --peer-store-name solo \
  --msb-store-name solo-msb \
  --subnet-channel memorymatch-solo
```

---

## Game Commands (runtime CLI)

```
/solo                           Start a solo single-player game
/challenge <peerKey>            Send a P2P challenge to a peer
/flip <gameId|solo> <i1> <i2>  Flip two cards by index (0–15)
/board <gameId|solo>            Print the current board state
/scores                         List all active games and scores
/quit                           Exit cleanly
```

### Card indices

The board is a 4×4 grid of 16 cards (8 pairs). Cards are indexed 0–15 left-to-right, top-to-bottom:

```
[ 0] [ 1] [ 2] [ 3]
[ 4] [ 5] [ 6] [ 7]
[ 8] [ 9] [10] [11]
[12] [13] [14] [15]
```

---

## Contract Commands (on-chain, via /tx)

**Record a game result:**
```bash
/tx --command '{ "op": "record_result", "gameId": "abc-123", "winner": "trac1...", "loser": "trac1...", "moves": 24, "winnerScore": 8, "loserScore": 3 }'
```

**Get the leaderboard (top 10 by default):**
```bash
/tx --command '{ "op": "get_leaderboard", "limit": 10 }'
```

**Register a display name:**
```bash
/tx --command '{ "op": "register_name", "name": "PuzzleMaster" }'
```

**Get stats for a specific address:**
```bash
/tx --command '{ "op": "get_stats", "address": "trac1..." }'
```

---

## Architecture

```
index.js          — Pear entry point; CLI, game loop, sidechannel I/O
contract/
  contract.js     — Trac contract entry (init, execute, query)
  protocol.js     — MemoryMatchProtocol: leaderboard, result recording
features/         — (reserved for optional feature modules)
```

### Sidechannel message types

| op | Direction | Payload |
|---|---|---|
| `mm_challenge` | challenger → challenged | `{ gameId }` |
| `mm_accepted` | challenged → challenger | `{ gameId, accepted }` |
| `mm_flip` | either → other | `{ gameId, cardIndex }` |
| `mm_update` | either → both | `{ gameId, result }` |

### Contract state keys

| Key | Value |
|---|---|
| `game:<gameId>` | Full game record JSON |
| `stats:<address>` | `{ wins, losses, totalMoves, bestMoves, gamesPlayed }` |
| `name:<address>` | Display name string |
| `leaderboard:index` | Array of addresses (ordered by insertion) |

---

## Extending the app

- **New card themes:** Edit the `EMOJIS` array in `index.js`.
- **Larger boards:** Change `pairs` argument in `newDeck(pairs)` (max 16 pairs with current emoji set).
- **Timed mode:** Add a `startedAt` timer and `timeLimit` enforcement inside `flipCard`.
- **Token rewards:** Integrate the MSB client to pay TNK to the winner post-game via the `record_result` tx.
- **Web UI:** Expose the game state via a local HTTP server and serve an HTML front-end alongside the Pear terminal app.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `not writable` error on start | Restart; you will auto-join as a reader then become writable |
| Peer not found | Ensure both peers use the same `--subnet-channel` value |
| `trac-wallet` version conflict | Run `npm pkg set overrides.trac-wallet=1.0.1 && rm -rf node_modules && npm i` |
| Cards not flipping back | The 1.5 s delay is in-memory only; if the peer crashes mid-turn, call `/board` to refresh |

---

## Channel

Canonical production channel: **`memorymatch-v1`**

Use a different channel name for development/testing to avoid polluting the production game state.

---

## Security notes

- Peer keys are ed25519 public keys generated automatically by Pear on first run.
- All sidechannel messages are authenticated by Hyperswarm's noise protocol.
- The contract state is replicated deterministically across all peers; no single peer controls it.
- `gameId` uniqueness is enforced on-chain — duplicate `record_result` calls are rejected.

---

## Links

- Upstream Intercom: https://github.com/Trac-Systems/intercom
- Pear runtime: https://github.com/holepunchto/pear
- Trac Network: https://github.com/Trac-Systems
- Awesome Intercom (fork index): https://github.com/Trac-Systems/awesome-intercom
