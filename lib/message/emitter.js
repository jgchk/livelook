// parse packets out of partial or concatenated streams of data

import { Writable } from 'node:stream'

import Message from './index'

class MessageEmitter extends Writable {
  _write(chunk, enc, next) {
    this.read(this.rest ? Buffer.concat([this.rest, chunk]) : chunk)
    next()
  }

  read(data) {
    if (data.length < 4) {
      this.rest = data.slice(0, data.length)
      return
    }

    let size = data.readUInt32LE()

    if (size + 4 <= data.length) {
      this.emit('message', new Message(data.slice(0, size + 4)))
      this.read(data.slice(size + 4, data.length))
    } else {
      this.rest = data.slice(0, data.length)
    }
  }

  reset() {
    this.rest = undefined
  }
}

export default MessageEmitter
