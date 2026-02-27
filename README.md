# MemoryMatch 🃏 (Intercom App)

**MemoryMatch** is a peer-to-peer memory card game built on [Intercom](https://github.com/Trac-Systems/intercom) / Trac Network.

Flip pairs of cards to find matches. Play solo against yourself or challenge any peer on the Trac Network sidechannel in real-time. Game results are recorded on-chain for a global leaderboard.

---

## Trac Address (for payouts)

```
trac1r000m89xkn9nlgllnlvqkegzuvnr5u2kfuwk39ts6uurhyrxppqqk5c8w6
```

---

## Features

- 🃏 **Memory match gameplay** — 8 pairs of emoji cards, flip two at a time
- 🧍 **Solo mode** — single-player, race for the lowest move count
- 🌐 **P2P multiplayer** — challenge any peer over Intercom sidechannels
- 🏆 **On-chain leaderboard** — results recorded to Trac Network contract
- 📡 **Hybrid** — both modes work in the same instance

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) v20+
- [Pear runtime](https://github.com/holepunchto/pear): `npm install -g pear`

### Install

```bash
git clone https://github.com/YOUR_USERNAME/intercom memorymatch
cd memorymatch
npm install
npm pkg set overrides.trac-wallet=1.0.1
rm -rf node_modules package-lock.json
npm install
```

### Run (P2P Multiplayer)

```bash
pear run --tmp-store --no-pre . \
  --peer-store-name admin \
  --msb-store-name admin-msb \
  --subnet-channel memorymatch-v1
```

### Run (Solo mode)

```bash
pear run --tmp-store --no-pre . --solo \
  --peer-store-name solo \
  --msb-store-name solo-msb \
  --subnet-channel memorymatch-solo
```

---

## In-Game Commands

| Command | Description |
|---|---|
| `/solo` | Start a solo single-player game |
| `/challenge <peerKey>` | Challenge a peer to a P2P match |
| `/flip solo <i1> <i2>` | Flip two cards in your solo game (0–15) |
| `/flip <gameId> <i1> <i2>` | Flip two cards in a P2P game |
| `/board <gameId\|solo>` | Print the current board |
| `/scores` | Show all active games and scores |
| `/quit` | Exit |

### Example session

```
/solo
🎮 Solo game started!
[ 0] [ 1] [ 2] [ 3]
[ 4] [ 5] [ 6] [ 7]
[ 8] [ 9] [10] [11]
[12] [13] [14] [15]

/flip solo 3 11
✨ Match! You scored!

/flip solo 0 7
❌ No match. Flipping back…
```

---

## Contract Commands (On-Chain)

Record a game result (executed on-chain):

```bash
/tx --command '{ "op": "record_result", "gameId": "abc-123", "winner": "trac1...", "loser": "trac1...", "moves": 24 }'
```

View the leaderboard:

```bash
/tx --command '{ "op": "get_leaderboard", "limit": 10 }'
```

Register a display name:

```bash
/tx --command '{ "op": "register_name", "name": "PuzzleMaster" }'
```

Get stats for an address:

```bash
/tx --command '{ "op": "get_stats", "address": "trac1..." }'
```

---

## How it works

### Sidechannel (P2P)

When you `/challenge <peerKey>`, a `mm_challenge` message is broadcast over the Intercom sidechannel on `memorymatch-v1`. The opponent receives it, auto-accepts, and the game board is shared between both peers in real-time. Each `/flip` is a `mm_flip` sidechannel message — no central server, fully P2P.

### Contract (On-Chain)

At the end of a game, either player can call `record_result` to permanently store the result in the Trac Network contract state. This feeds the global leaderboard, persisted via the Trac hypercore replication layer.

---

## Proof

See [`screenshots/`](./screenshots/) for proof screenshots of the app running.

---

## Competition Links

- **This fork:** https://github.com/YOUR_USERNAME/intercom
- **Upstream Intercom:** https://github.com/Trac-Systems/intercom
- **Awesome Intercom:** https://github.com/Trac-Systems/awesome-intercom

---

## Notes

- Always use the **Pear runtime** (`pear run …`), not plain `node`.
- Full setup and agent instructions are in [`SKILL.md`](./SKILL.md).
- The `memorymatch-v1` subnet channel is the canonical production channel for this app.
- To avoid path issues, run from a directory without spaces.

---

_Built for the Intercom Vibe Competition — 50,000 TNK prize pool._
