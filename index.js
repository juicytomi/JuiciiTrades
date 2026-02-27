/**
 * MemoryMatch — P2P Memory Card Game on Intercom / Trac Network
 *
 * Entry point for the Pear runtime.
 * Supports:
 *   - Standalone single-player mode  (solo, no peers needed)
 *   - P2P multiplayer via Intercom sidechannel (challenge friends over Trac Network)
 *
 * Run:
 *   pear run --tmp-store --no-pre . --peer-store-name admin --msb-store-name admin-msb --subnet-channel memorymatch-v1
 */

import Trac from 'trac-peer'
import readline from 'readline'

// ─── Config ──────────────────────────────────────────────────────────────────
const CHANNEL = process.env.MM_CHANNEL || 'memorymatch-v1'
const SOLO_MODE = process.argv.includes('--solo')

// ─── Bootstrap Trac peer ──────────────────────────────────────────────────────
const trac = new Trac({
  subnetChannel: CHANNEL
})

await trac.ready()

const myKey = trac.publicKey
console.log('\n🃏  MemoryMatch — Intercom Edition')
console.log(`   Mode     : ${SOLO_MODE ? 'Solo (single-player)' : 'P2P Multiplayer'}`)
console.log(`   Channel  : ${CHANNEL}`)
console.log(`   My key   : ${myKey}\n`)

// ─── Game state ───────────────────────────────────────────────────────────────
const EMOJIS = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼',
                 '🐨','🐯','🦁','🐮','🐷','🐸','🐙','🦋']

function newDeck (pairs = 8) {
  const pool = EMOJIS.slice(0, pairs)
  const cards = [...pool, ...pool]
    .map((emoji, i) => ({ id: i, emoji, face: false, matched: false }))
  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

const games = new Map()   // gameId → state
let   soloGame = null

function createGame (gameId, challenger, challenged) {
  const deck = newDeck(8)
  const state = {
    gameId,
    challenger,
    challenged,
    deck,
    scores: { [challenger]: 0, [challenged]: 0 },
    turn: challenger,
    flipped: [],
    moves: 0,
    finished: false,
    startedAt: Date.now()
  }
  games.set(gameId, state)
  return state
}

function renderBoard (deck) {
  const cols = 4
  let out = '\n'
  for (let i = 0; i < deck.length; i++) {
    const c = deck[i]
    const cell = c.matched ? '✅' : c.face ? c.emoji : `[${String(i).padStart(2,' ')}]`
    out += cell + ' '
    if ((i + 1) % cols === 0) out += '\n'
  }
  return out
}

function flipCard (state, playerId, cardIndex) {
  const { deck, flipped, turn } = state
  if (state.finished) return { ok: false, msg: 'Game already finished.' }
  if (playerId !== turn)  return { ok: false, msg: `Not your turn. Waiting for ${turn}.` }
  if (cardIndex < 0 || cardIndex >= deck.length)
    return { ok: false, msg: 'Invalid card index.' }
  const card = deck[cardIndex]
  if (card.matched || card.face)
    return { ok: false, msg: 'Card already revealed.' }
  if (flipped.length >= 2)
    return { ok: false, msg: 'Two cards already flipped. Wait for resolution.' }

  card.face = true
  flipped.push(cardIndex)
  state.moves++

  let result = { ok: true, board: renderBoard(deck), flipped: [...flipped], matched: false, finished: false }

  if (flipped.length === 2) {
    const [a, b] = flipped.map(i => deck[i])
    if (a.emoji === b.emoji) {
      a.matched = b.matched = true
      state.scores[playerId] = (state.scores[playerId] || 0) + 1
      result.matched = true
      result.msg = `✨ Match! ${playerId.slice(0,8)}… scores!`
      // Same player goes again
    } else {
      result.msg = `❌ No match. Flipping back…`
      // Switch turn
      const players = [state.challenger, state.challenged]
      state.turn = players.find(p => p !== turn) || turn
    }
    state.flipped = []
    // Hide unmatched after slight delay (client handles UX)
    if (!result.matched) {
      setTimeout(() => { deck[flipped[0]].face = false; deck[flipped[1]].face = false }, 1500)
    }

    const totalPairs = deck.length / 2
    const matched = deck.filter(c => c.matched).length / 2
    if (matched >= totalPairs) {
      state.finished = true
      result.finished = true
      const [p1, p2] = Object.entries(state.scores).sort((a,b) => b[1]-a[1])
      result.winner = p1[1] > (p2?.[1] ?? -1) ? p1[0] : (p1[1] === (p2?.[1] ?? -1) ? 'TIE' : p2[0])
      result.scores = { ...state.scores }
      result.moves = state.moves
    }
  }
  return result
}

// ─── Solo mode ────────────────────────────────────────────────────────────────
function startSolo () {
  soloGame = createGame('solo', myKey, 'self')
  soloGame.turn = myKey
  console.log('🎮 Solo game started! Memorise the cards, then flip pairs.')
  console.log(renderBoard(soloGame.deck))
  console.log('Commands: /flip <index> <index>  |  /quit')
}

// ─── P2P sidechannel handlers ─────────────────────────────────────────────────
if (!SOLO_MODE) {
  trac.on('sidechannel', ({ from, data }) => {
    let msg
    try { msg = JSON.parse(data) } catch { return }

    if (msg.op === 'mm_challenge') {
      const { gameId } = msg
      const state = createGame(gameId, from, myKey)
      console.log(`\n🎯 Challenge received from ${from.slice(0,12)}… — Game ${gameId}`)
      console.log(renderBoard(state.deck))
      // Accept automatically and notify challenger
      trac.sendSidechannel(from, JSON.stringify({ op: 'mm_accepted', gameId, accepted: true }))
      console.log('✅ Challenge accepted. Waiting for challenger to flip first.\n')
    }

    if (msg.op === 'mm_accepted') {
      const { gameId, accepted } = msg
      const state = games.get(gameId)
      if (!state) return
      if (accepted) {
        console.log(`\n✅ ${from.slice(0,12)}… accepted your challenge! Game ${gameId}`)
        console.log(renderBoard(state.deck))
        console.log('Your turn! /flip <i1> <i2>\n')
      }
    }

    if (msg.op === 'mm_flip') {
      const { gameId, cardIndex } = msg
      const state = games.get(gameId)
      if (!state) return
      const result = flipCard(state, from, cardIndex)
      // Broadcast updated board to both players
      const update = JSON.stringify({ op: 'mm_update', gameId, result })
      trac.sendSidechannel(state.challenger, update)
      trac.sendSidechannel(state.challenged, update)
      renderUpdate(gameId, result)
    }

    if (msg.op === 'mm_update') {
      const { gameId, result } = msg
      renderUpdate(gameId, result)
    }
  })
}

function renderUpdate (gameId, result) {
  console.log(`\n[Game ${gameId}]`)
  if (result.board)  console.log(result.board)
  if (result.msg)    console.log(result.msg)
  if (result.finished) {
    console.log(`\n🏆 Game Over! Moves: ${result.moves}`)
    console.log('Scores:', result.scores)
    console.log(result.winner === 'TIE' ? "It's a tie!" : `Winner: ${result.winner.slice(0,12)}…`)
  }
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

console.log('\nCommands:')
console.log('  /solo                           — start a solo game')
console.log('  /challenge <peerKey>            — challenge a peer (P2P)')
console.log('  /flip <gameId|solo> <i1> <i2>  — flip two cards')
console.log('  /board <gameId|solo>            — print board')
console.log('  /scores                         — list active games')
console.log('  /quit                           — exit\n')

rl.on('line', async (line) => {
  const parts = line.trim().split(/\s+/)
  const cmd = parts[0]

  if (cmd === '/solo') {
    startSolo()
    return
  }

  if (cmd === '/challenge') {
    const peer = parts[1]
    if (!peer) { console.log('Usage: /challenge <peerKey>'); return }
    const gameId = `${myKey.slice(0,8)}-${Date.now()}`
    createGame(gameId, myKey, peer)
    trac.sendSidechannel(peer, JSON.stringify({ op: 'mm_challenge', gameId }))
    console.log(`🎯 Challenge sent to ${peer.slice(0,12)}… (game ${gameId})`)
    return
  }

  if (cmd === '/flip') {
    const [, target, i1raw, i2raw] = parts
    const i1 = parseInt(i1raw), i2 = parseInt(i2raw)

    if (target === 'solo' && soloGame) {
      // solo flip: flip first card
      let result = flipCard(soloGame, myKey, i1)
      console.log(result.board || '', result.msg || '')
      if (!result.finished && soloGame.flipped.length === 1) {
        result = flipCard(soloGame, myKey, i2)
        console.log(result.board || '', result.msg || '')
      }
      if (result.finished) {
        console.log(`\n🏆 Finished in ${result.moves} moves!`)
        soloGame = null
      }
    } else {
      const state = games.get(target)
      if (!state) { console.log('Game not found.'); return }
      // Send flip to peer (or process locally if both players on same node)
      if (SOLO_MODE) {
        let result = flipCard(state, myKey, i1)
        console.log(result.board || '', result.msg || '')
        if (state.flipped.length === 1 || result.matched) {
          result = flipCard(state, myKey, i2)
          console.log(result.board || '', result.msg || '')
        }
      } else {
        trac.sendSidechannel(state.challenger === myKey ? state.challenged : state.challenger,
          JSON.stringify({ op: 'mm_flip', gameId: target, cardIndex: i1 }))
        setTimeout(() => {
          trac.sendSidechannel(state.challenger === myKey ? state.challenged : state.challenger,
            JSON.stringify({ op: 'mm_flip', gameId: target, cardIndex: i2 }))
        }, 400)
      }
    }
    return
  }

  if (cmd === '/board') {
    const target = parts[1]
    const state = target === 'solo' ? soloGame : games.get(target)
    if (!state) { console.log('Game not found.'); return }
    console.log(renderBoard(state.deck))
    return
  }

  if (cmd === '/scores') {
    console.log('\nActive games:')
    games.forEach((s, id) => {
      console.log(`  ${id}: ${JSON.stringify(s.scores)} — turn: ${s.turn.slice(0,12)}…`)
    })
    if (soloGame) console.log(`  solo: moves=${soloGame.moves}`)
    return
  }

  if (cmd === '/quit') {
    await trac.close?.()
    process.exit(0)
  }

  console.log('Unknown command. Type /solo, /challenge, /flip, /board, /scores, or /quit')
})
