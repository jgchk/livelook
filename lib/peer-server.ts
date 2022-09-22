// listen for other peer connections

import { EventEmitter } from 'node:events'
import { Server } from 'node:net'

import * as getPort from 'get-port'
import { connect } from 'nat-pmp'
import { get_gateway_ip } from 'network'

import LiveLook from '..'
import checkPort from './check-port'
import DistribPeer from './distrib-peer'
import fromPeer from './message/from-peer'
import Message from './message/reader'
import Peer from './peer'

class PeerServer extends EventEmitter {
  port: number
  maxPeers: number
  livelook: LiveLook
  server: Server
  pmp: any
  listening: boolean
  incomingData: Buffer

  constructor(args, livelook) {
    super()

    this.port = args.port || 2234
    this.maxPeers = args.maxPeers || 100
    this.livelook = livelook // :(

    this.server = new Server()
    this.pmp = {}
    this.listening = false
    //this.peers = {};

    this.server.on('close', () => {
      this.emit('close')
      this.listening = false
    })

    this.server.on('listening', () => {
      console.log(`peer server is listening on port ${this.port}`)
      this.emit('listening')
      this.listening = true
    })

    this.incomingData = Buffer.alloc(0)

    this.server.on('connection', (socket) => {
      // TODO check for banned IPs

      // eslint-disable-next-line unicorn/consistent-function-scoping
      const errorListener = (err: Error) => this.emit('error', err)
      socket.on('error', errorListener)

      let length

      const dataListener = (data) => {
        this.incomingData = Buffer.concat([this.incomingData, data])
        //console.log(this.incomingData);

        if (!length && this.incomingData.length >= 4) {
          length = this.incomingData.readUInt32LE(0)
          this.incomingData = this.incomingData.slice(4)
        }

        if (this.incomingData.length >= length) {
          // remove old event listeners because peer has its own
          socket.removeListener('data', dataListener)
          socket.removeListener('error', errorListener)

          const id = this.incomingData[0]
          console.log('peer server client id', id)
          const message = new Message(this.incomingData.slice(1))

          let decoded

          try {
            decoded = fromPeer[id](message)
          } catch (error) {
            error.packet = message
            this.emit('error', error)
            return
          }

          if (decoded.type === 'pierceFirewall') {
            console.log('peer server client sent us a pierce firewall')
            let cType = livelook.pendingPeers[decoded.token]

            if (!cType) {
              console.log('peer tried to connect to us without us sending req')
              cType = 'P'
            }

            // TODO peer limit

            let peer: Peer | DistribPeer

            if (cType === 'P') {
              peer = new Peer(socket)
            } else if (cType === 'D') {
              peer = new DistribPeer(socket)
            }

            peer.connected = true
            peer.token = decoded.token
            peer.attachHandlers(this.livelook)

            peer.init(() => {
              // this is probably not optional here
              peer.pierceFirewall()

              const nextData = this.incomingData.slice(length)
              peer.socket.emit('data', nextData)
            })
          } else if (decoded.type === 'peerInit') {
            if (decoded.cType === 'F') {
              // TODO TransferPeer
              console.log('TODO bring TransferPeer')
              return
            }

            let peer

            if (decoded.cType === 'P') {
              peer = new Peer(socket)
            } else if (decoded.cType === 'D') {
              peer = new DistribPeer(socket)
              console.log('potentially a child')
            }

            peer.connected = true
            peer.token = decoded.token
            peer.username = decoded.username
            peer.attachHandlers(this.livelook)

            peer.init(() => {
              // this might be optional here
              peer.pierceFirewall()
              // the next message is usually stuck to the initial
              // buffer, so we can re-send it to make sure our
              // message emitter reads it
              const nextData = this.incomingData.slice(length)
              peer.socket.emit('data', nextData)
            })
          }
        }
      }

      socket.on('data', dataListener)
    })

    this.server.on('error', (err) => this.emit('error', err))
  }

  natPmpMap(done: (err: Error | null) => void) {
    get_gateway_ip((err: Error | null, gateway: string) => {
      if (err) {
        this.emit('error', err)
        return done(err)
      }

      const natpmpClient = connect(gateway)
      natpmpClient.on('error', (error) => this.emit('error', err))

      const natpmpTimeout = setTimeout(() => {
        natpmpClient.close()
        const err = new Error(
          'unable to connect to nat-pmp. try enabling ' +
            `upnp or forward port ${this.port} at http://${gateway}`
        )
        this.emit('error', err)
        done(err)
      }, 5000)

      natpmpClient.portMapping(
        {
          private: this.port,
          public: this.port,
          ttl: 3600, // TODO obv increase this
        },
        (err, res) => {
          clearTimeout(natpmpTimeout)
          natpmpClient.close()

          if (!err) {
            this.pmp = res
            this.emit('waitPort', this.pmp.public)
          }

          done(err)
        }
      )
    })
  }

  init(done: (err?: Error | null) => void) {
    getPort({ port: this.port })
      .then((port) => {
        this.port = port
        this.emit('waitPort', this.port)

        const listenTimeout = setTimeout(() => {
          const err = new Error('timed out with peer server listen')
          this.emit('error', err)
          done(err)
        }, 5000)

        // TODO if connect finishes afer the setTimeout, done might get
        // called again

        this.server.listen(this.port, () => {
          clearTimeout(listenTimeout)

          checkPort(this.port, (err, open) => {
            if (err) {
              done(err)
            } else if (!open) {
              this.server.close()
              this.natPmpMap(done)
            } else {
              done()
            }
          })
        })
      })
      .catch((error) => {
        this.emit('error', error)
        return done(error)
      })
  }
}

export default PeerServer
