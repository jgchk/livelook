// connect to a soulseek server

import fromServer from '../message/from-server'
import * as toServer from '../message/to-server'
import SoulSock from '../soul-sock'
import attachHandlers from './handlers'

export default class Client extends SoulSock {
  constructor(address) {
    super(address)
    this.encoder = toServer
    this.decoder = fromServer
  }

  attachHandlers(livelook) {
    attachHandlers(livelook, this)
  }
}
