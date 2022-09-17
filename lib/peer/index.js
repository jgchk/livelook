// a direct connection to another user

import fromPeer from '../message/from-peer'
import * as toPeer from '../message/to-peer'
import SoulSock from '../soul-sock'
import attachHandlers from './handlers'

class Peer extends SoulSock {
  constructor(args) {
    super(args)
    this.encoder = toPeer
    this.decoder = fromPeer

    this.username = args.username
    this.token = args.token
  }

  attachHandlers(livelook) {
    attachHandlers(livelook, this)
  }

  pierceFirewall() {
    this.send('pierceFirewall', this.token)
  }
}

export default Peer
