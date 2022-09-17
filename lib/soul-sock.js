// base class between client and peer

const EventEmitter = require('events').EventEmitter
const MessageEmitter = require('./message/emitter')
const net = require('net')

class SoulSock extends EventEmitter {
  constructor(args) {
    super()

    if (args.constructor && args.constructor.name === 'Socket') {
      this.socket = args
      this.ip = this.socket.remoteAddress.replace('::ffff:', '')
      this.port = this.socket.remotePort
    } else {
      this.ip = args.ip
      this.port = args.port
      this.socket = new net.Socket()
    }

    this.messages = new MessageEmitter()
    this.connected = false
  }

  sendMessage(message) {
    if (this.connected) {
      this.socket.write(message.getBuff())
    }
  }

  send(type, ...args) {
    let factory = this.encoder[type]

    if (!factory) {
      throw new Error(`no message factory for ${type}`)
    }

    console.log(this.constructor.name, 'sending', type, JSON.stringify(args))
    this.sendMessage(factory.apply(null, args))
  }

  init(done) {
    done = done || (() => {})

    this.socket.on('close', () => this.emit('close'))
    this.socket.on('error', (err) => this.emit('error', err))

    this.messages.on('message', (message) => {
      let size = message.int32()

      if (size < 4) {
        return
      }

      let code = message.int32()
      let decoded = this.decoder[code] // fromPeer, fromServer

      try {
        decoded = decoded ? decoded(message) : null
      } catch (e) {
        e.packet = message
        this.emit('error', e)
      }

      if (!decoded) {
        let err = new Error(`unknown message id ${code}`)
        err.packet = message
        this.emit('error', err)
      } else {
        let recvd = JSON.stringify(decoded)

        if (recvd && recvd.length <= 500) {
          console.log(this.constructor.name, 'recevied', recvd)
        } else {
          console.log(
            this.constructor.name,
            'recevied',
            decoded.type,
            "but it's too darn long"
          )
        }

        this.emit(decoded.type, decoded)
      }
    })

    this.socket.pipe(this.messages)

    // we're already connected
    if (this.socket.bytesRead) {
      this.emit('connect')
      done()
      return
    }

    this.socket.connect(
      {
        host: this.ip,
        port: this.port,
      },
      () => {
        this.connected = true
        this.emit('connect')
        done()
      }
    )
  }
}

module.exports = SoulSock
