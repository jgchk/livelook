// base class between client and peer

import { EventEmitter } from 'node:events'
import { Socket } from 'node:net'

import MessageEmitter from './message/emitter'
import fromPeer from './message/from-peer'
import fromServer from './message/from-server'
import MessageReader from './message/reader'
import * as toPeer from './message/to-peer'
import * as toServer from './message/to-server'
import MessageWriter from './message/writer'
import { Address, getErrorMessage } from './utils'

type Encoder = typeof toServer & typeof toPeer
type Decoder = typeof fromServer & typeof fromPeer

class SoulSock extends EventEmitter {
  socket: Socket
  ip: string
  port: number
  messages: MessageEmitter
  connected: boolean
  encoder: Encoder
  decoder: Decoder

  constructor(args: Socket | Address) {
    super()

    if (args instanceof Socket) {
      this.socket = args
      this.ip = this.socket.remoteAddress.replace('::ffff:', '')
      this.port = this.socket.remotePort
    } else {
      this.ip = args.ip
      this.port = args.port
      this.socket = new Socket()
    }

    this.messages = new MessageEmitter()
    this.connected = false
  }

  sendMessage(message: MessageWriter) {
    if (this.connected) {
      this.socket.write(message.getBuff())
    }
  }

  send<E extends keyof Encoder, U extends Parameters<Encoder[E]>>(
    type: E,
    ...args: U
  ) {
    const factory = this.encoder[type]

    if (!factory) {
      throw new Error(`no message factory for ${type}`)
    }

    console.log(this.constructor.name, 'sending', type, JSON.stringify(args))
    this.sendMessage(factory(...args))
  }

  init(done?: (err?: Error | null) => void) {
    this.socket.on('close', () => this.emit('close'))
    this.socket.on('error', (err) => this.emit('error', err))

    this.messages.on('message', (message: MessageReader) => {
      const size = message.int32()

      if (size < 4) {
        return
      }

      const code = message.int32()
      const decoder: Decoder[keyof Decoder] | undefined = this.decoder[code]

      let decoded: ReturnType<Decoder[keyof Decoder]> | null
      try {
        decoded = decoder ? decoder(message) : null
      } catch (error) {
        this.emit('error', new DecodeMessageError(error, message))
      }

      if (!decoded) {
        const err = new UnknownMessageError(code, message)
        this.emit('error', err)
      } else {
        const recvd = JSON.stringify(decoded)

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
      done?.()
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
        done?.()
      }
    )
  }
}

export default SoulSock

export class UnknownMessageError extends Error {
  code: number
  packet: MessageReader

  constructor(code: number, packet: MessageReader) {
    super(`unknown message id ${code}`)
    this.code = code
    this.packet = packet
  }
}

export class DecodeMessageError extends Error {
  originalError: unknown
  packet: MessageReader

  constructor(originalError: unknown, packet: MessageReader) {
    super(getErrorMessage(originalError))
    this.originalError = originalError
    this.packet = packet
  }
}
