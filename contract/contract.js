/**
 * MemoryMatch — Contract Entry
 *
 * Wires MemoryMatchProtocol into the Trac contract framework.
 * This file is loaded by trac-peer as the contract handler.
 */

'use strict'

import MemoryMatchProtocol from './protocol.js'

let protocol = null

export async function init (db) {
  protocol = new MemoryMatchProtocol(db)
  return { name: 'memorymatch', version: '1.0.0' }
}

export async function execute (tx) {
  if (!protocol) throw new Error('Contract not initialised.')
  return protocol.execute(tx)
}

export async function query (tx) {
  if (!protocol) throw new Error('Contract not initialised.')
  return protocol.execute(tx)
}
