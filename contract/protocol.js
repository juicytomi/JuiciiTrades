/**
 * MemoryMatch — Contract Protocol
 *
 * Handles deterministic on-chain state for:
 *   - Global leaderboard (wins, matches, best move count)
 *   - Game result recording (immutable history)
 *   - Peer registration (optional display names)
 *
 * Operations (submitted via /tx --command '{ "op": "..." }'):
 *   record_result  — record the outcome of a completed game
 *   get_leaderboard — query the top players
 *   register_name  — set a display name for your address
 *   get_stats      — get stats for a specific address
 */

'use strict'

export default class MemoryMatchProtocol {
  constructor (db) {
    this.db = db  // trac-peer's key-value store
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  async _get (key, fallback = null) {
    try {
      const raw = await this.db.get(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  async _set (key, value) {
    await this.db.put(key, JSON.stringify(value))
  }

  // ─── Operations ──────────────────────────────────────────────────────────────

  /**
   * Record a completed game result.
   * tx.params: { gameId, winner, loser, moves, winnerScore, loserScore, duration }
   */
  async record_result (tx) {
    const { gameId, winner, loser, moves, winnerScore, loserScore, duration } = tx.params || {}
    if (!gameId || !winner || moves == null) {
      return { error: 'Missing required fields: gameId, winner, moves' }
    }

    // Prevent duplicate recording
    const existing = await this._get(`game:${gameId}`)
    if (existing) return { error: `Game ${gameId} already recorded.` }

    const ts = Date.now()
    const record = { gameId, winner, loser: loser || null, moves, winnerScore, loserScore, duration: duration || 0, ts }
    await this._set(`game:${gameId}`, record)

    // Update winner stats
    const wStats = await this._get(`stats:${winner}`, { wins: 0, losses: 0, totalMoves: 0, bestMoves: Infinity, gamesPlayed: 0 })
    wStats.wins++
    wStats.gamesPlayed++
    wStats.totalMoves += moves
    if (moves < wStats.bestMoves) wStats.bestMoves = moves
    await this._set(`stats:${winner}`, wStats)

    // Update loser stats (if not solo)
    if (loser && loser !== 'self') {
      const lStats = await this._get(`stats:${loser}`, { wins: 0, losses: 0, totalMoves: 0, bestMoves: Infinity, gamesPlayed: 0 })
      lStats.losses++
      lStats.gamesPlayed++
      await this._set(`stats:${loser}`, lStats)
    }

    // Append to leaderboard index (store top 100 by wins)
    const lb = await this._get('leaderboard:index', [])
    if (!lb.includes(winner)) lb.push(winner)
    await this._set('leaderboard:index', lb)

    return { ok: true, record }
  }

  /**
   * Get top players on the leaderboard.
   * tx.params: { limit } — default 10
   */
  async get_leaderboard (tx) {
    const limit = Math.min(tx.params?.limit || 10, 100)
    const index = await this._get('leaderboard:index', [])
    const entries = []

    for (const addr of index) {
      const stats = await this._get(`stats:${addr}`, null)
      const name  = await this._get(`name:${addr}`, null)
      if (stats) entries.push({ address: addr, name, ...stats })
    }

    // Sort by wins desc, then bestMoves asc
    entries.sort((a, b) => b.wins - a.wins || a.bestMoves - b.bestMoves)

    return { ok: true, leaderboard: entries.slice(0, limit) }
  }

  /**
   * Register an optional display name.
   * tx.params: { name } (max 32 chars, alphanumeric + spaces)
   */
  async register_name (tx) {
    const { name } = tx.params || {}
    if (!name || typeof name !== 'string' || name.length > 32) {
      return { error: 'Name must be a string up to 32 characters.' }
    }
    if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
      return { error: 'Name may only contain letters, digits, spaces, underscores, and hyphens.' }
    }
    await this._set(`name:${tx.address}`, name.trim())
    return { ok: true, name: name.trim() }
  }

  /**
   * Get stats for a specific address.
   * tx.params: { address }
   */
  async get_stats (tx) {
    const addr = tx.params?.address || tx.address
    const stats = await this._get(`stats:${addr}`, null)
    const name  = await this._get(`name:${addr}`, null)
    if (!stats) return { ok: false, msg: 'No stats found for this address.' }
    return { ok: true, address: addr, name, ...stats }
  }

  // ─── Router ──────────────────────────────────────────────────────────────────
  async execute (tx) {
    const op = tx?.op || tx?.params?.op
    if (typeof this[op] === 'function') {
      return await this[op](tx)
    }
    return { error: `Unknown operation: ${op}` }
  }
}
