import path from 'node:path'
import { EventEmitter } from 'node:stream'
import stream from 'node:stream'

import * as chokidar from 'chokidar'
import { ThrottleGroup } from 'stream-throttle'

import * as buildList from './lib/build-list'
import Client from './lib/client'
import DistribPeer from './lib/distrib-peer'
import makeToken from './lib/make-token'
import Peer from './lib/peer'
import PeerServer from './lib/peer-server'
import * as searchShareList from './lib/search-share-list'
import uploadSpeed from './lib/upload-speed'
import { Address } from './lib/utils'
import pkg from './package.json'

type ConnType = string

export default class LiveLook extends EventEmitter {
  username: string
  password: string
  server: string
  port: number
  waitPort: number
  sharedFolder: string
  downloadFolder: string
  description: string
  autojoin: string[]
  maxPeers: number
  uploadSlots: number
  downloadSlots: number
  uploadThrottle: number
  downloadThrottle: number
  status: number
  shareList: buildList.ShareList
  peers: any
  pendingPeers: any
  parentPeer: any
  potentialParents: any
  childPeers: any
  branchLevel: number
  branchRoot: string
  maxChildren: number
  peerAddresses: Record<string, Address>
  uploads: any
  downloads: any
  uploadQueue: any
  downloadQueue: any
  toDownload: any
  rooms: any
  tickers: any
  cache: any
  client: Client
  uploadThrottler: ThrottleGroup
  downloadThrottler: ThrottleGroup
  peerServer: PeerServer
  loggedIn: boolean
  lastSearch: number
  lastSelfSearch: number
  lastBroadcastSearch: number
  shareWatcher?: chokidar.FSWatcher
  uploadSpeed: number

  constructor(args) {
    super()

    this.username = args.username
    this.password = args.password
    this.server = args.server || 'server.slsknet.org'
    this.port = args.port || 2242
    this.waitPort = args.waitPort || 2234
    this.sharedFolder = args.sharedFolder
    this.downloadFolder = args.downloadFolder
    this.description = args.description || pkg.homepage
    this.autojoin = args.autojoin || []
    this.maxPeers = args.maxPeers || 100
    this.uploadSlots = args.uploadSlots || 2
    this.downloadSlots = args.downloadSlots || 2
    this.uploadThrottle = args.uploadThrottle || 56 * 1024
    this.downloadThrottle = args.downloadThrottle || 56 * 1024

    if (!Array.isArray(this.autojoin)) {
      this.autojoin = [this.autojoin]
    }

    // our online status (1 away, 2 online)
    this.status = 2

    // the share list
    // { dir: [ { file, size, ... } ]
    this.shareList = {}

    // these are only P type peers, not F or D
    // { ip: { Peer } }
    this.peers = {}

    // when we send off a connect to peer request to the server, we send
    // the type (P, F, D) and a token. the peer will send us back the token
    // but not the type, so keep track of those.
    // { connectToken: cType }
    this.pendingPeers = {}

    // our parent D peer
    this.parentPeer = null

    // peers that could be our parent. sent from netinfo after we say we're
    // orphaned
    this.potentialParents = []

    // child peers to send search results to from our parent peer
    this.childPeers = {}

    // how far we are down the family tree (how many parents our parent has)
    this.branchLevel = 0

    // who our parent is
    this.branchRoot = ''

    // how many children we should accept at max. i'm hardcoding 10 for now
    // but it should be a ratio packet they send divided by our speed. TODO.
    this.maxChildren = 10

    // { username: { ip, port } }
    this.peerAddresses = {}

    // our *active* transfers
    // { token: { file: { file, size, ... }, dir: String, peer: Peer } }
    this.uploads = {}
    this.downloads = {}

    // pending transfers
    // [ ]
    this.uploadQueue = []
    this.downloadQueue = []

    // not exactly a queue - these are files we requested and others have
    // queued
    // { file: { file, size, ... } }
    this.toDownload = {}

    // which rooms we're in
    // { room: [ { users }, ... ] }
    this.rooms = {}

    // ticker messages! these usually spam on the top of the chatroom you're
    // in. an alternate implementation could use them as status messages
    // { room: { username: tickerMessage } }
    this.tickers = {}

    // cache gzipped search results (?) and our shares
    this.cache = {}

    // TODO add ability to change the rate later
    this.uploadThrottler = new ThrottleGroup({ rate: this.uploadThrottle })
    this.downloadThrottler = new ThrottleGroup({
      rate: this.downloadThrottle,
    })

    // the connection to soulseek's server
    this.client = new Client({ ip: this.server, port: this.port })
    this.client.attachHandlers(this)

    // our server to accept peer connections
    this.peerServer = new PeerServer(
      {
        port: this.waitPort,
        maxPeers: this.maxPeers,
      },
      this
    )

    this.peerServer.on('error', (err) => this.emit('error', err))
    this.peerServer.on('waitPort', (waitPort) => this.setWaitPort(waitPort))

    // are we sucessfully logged in?
    this.loggedIn = false

    // the last time we searched (i don't want to accidentally send too
    // many)
    this.lastSearch = -1

    // the time we sent a successful search
    this.lastSelfSearch = -1

    // the last time we broadcasted a search to our children
    this.lastBroadcastSearch = -1
  }

  // populate our share list and connect to the soulseek server
  init(done?: (err: Error | null) => void) {
    // TODO reverse these i think
    this.refreshShareList((err) => {
      if (err) {
        return done?.(err)
      }

      this.client.init(done)
    })
  }

  // initialize our sharelist (object defining directories and files to share)
  // can be called before we log in or any time after to refresh
  refreshShareList(
    done?: (err: Error | null, shareList?: buildList.ShareList) => void
  ) {
    buildList.shares(this.sharedFolder, (err, shareList) => {
      if (err) {
        this.emit('error', err)
        return done(err)
      }

      this.shareList = shareList
      this.refreshShareCount()

      if (this.shareWatcher) {
        return done?.(null, this.shareList)
      }

      this.shareWatcher = chokidar.watch(this.sharedFolder, {
        // without this, i was getting 'add' fires before it could
        // read metadata.
        awaitWriteFinish: {
          stabilityThreshold: 1000,
        },
        cwd: this.sharedFolder + '/../',
        ignoreInitial: true,
      })

      this.shareWatcher.on('add', (file) => {
        const dir = path.dirname(file)
        const ext = path.extname(file).slice(1)

        // we could listen for addDir, but it fires a new request
        // for each subdirectory and there might not be any files
        // there. our structure requires the full directory path as
        // the key.
        if (!Object.prototype.hasOwnProperty.call(this.shareList, dir)) {
          this.shareList[dir] = []
        }

        // TODO maybe a setTimeout here for good measure
        buildList.metaData(file, (err, metadata) => {
          if (err) {
            return this.emit('error', err)
          }

          metadata.file = path.basename(file)
          metadata.extension = ext
          this.shareList[dir].push(metadata)
          this.refreshShareCount()
        })
      })

      this.shareWatcher.on('unlinkDir', (dir) => {
        if (Object.prototype.hasOwnProperty.call(this.shareList, dir)) {
          delete this.shareList[dir]
          this.refreshShareCount()
        }
      })

      this.shareWatcher.on('unlink', (file) => {
        const dir = path.dirname(file)

        if (!Object.prototype.hasOwnProperty.call(this.shareList, dir)) {
          return
        }

        for (let i = 0; i < this.shareList[dir].length; i += 1) {
          const cFile = this.shareList[dir][i]

          if (cFile.file === file) {
            this.shareList[dir].splice(i, 1)
            this.refreshShareCount()
            return
          }
        }
      })

      this.shareWatcher.on('change', (file) => {
        const dir = path.dirname(file)

        if (!Object.prototype.hasOwnProperty.call(this.shareList, dir)) {
          return
        }

        for (let i = 0; i < this.shareList[dir].length; i += 1) {
          const cFile = this.shareList[dir][i]

          if (cFile.file === file) {
            buildList.metaData(file, (err, metadata) => {
              if (err) {
                return this.emit('error', err)
              }

              metadata.file = path.basename(file)
              metadata.extension = path.extname(file)
              this.shareList[dir][i] = metadata
              this.refreshShareCount()
            })

            return
          }
        }
      })

      return done(null, shareList)
    })
  }

  // login (or connect first) to the soulseek server and send our initializing
  // packets (upload speed, share count, joined rooms, etc.)
  login(done: (err: Error | null, res?: any) => void) {
    if (!this.client.connected) {
      this.init((err) => {
        this.login(done)
      })

      return
    }

    this.client.once('login', (res) => {
      this.loggedIn = res.success

      if (!this.loggedIn) {
        return done(null, res)
      }

      this.refreshShareCount()
      this.refreshUploadSpeed()
      for (const room of this.autojoin) this.joinRoom(room)

      if (this.peerServer.listening) {
        return done(null, res)
      }

      this.peerServer.init((err) => {
        if (err) {
          this.emit('error', err)
          return done(err)
        }

        done(null, res)
      })

      setTimeout(() => {
        this.refreshParentInfo()
        this.connectToNextParent()
      }, 1000)
    })

    this.client.send('login', this.username, this.password)
  }

  // this is the port our peer server listens on
  setWaitPort(port: number) {
    if (port) {
      this.waitPort = port
    }

    this.client.send('setWaitPort', this.waitPort)
  }

  sayChatroom(room: string, message: string) {
    this.client.send('sayChatroom', room, message)
  }

  joinRoom(room: string) {
    this.client.send('joinRoom', room)
  }

  leaveRoom(room: string) {
    this.client.send('leaveRoom', room)
  }

  messageUser(username: string, message: string) {
    this.client.send('messageUser', username, message)
  }

  // accepts 2 for online, 1 for away, or the corresponding strings
  setStatus(status: number | string) {
    if (status) {
      if (!Number.isNaN(status)) {
        this.status = Number.parseInt(String(status))
      } else {
        this.status = status === 'online' ? 2 : 1
      }
    }

    this.client.send('setStatus', this.status)
  }

  // count the amount of files we're sharing and send them to the server
  refreshShareCount() {
    if (!this.loggedIn) {
      return
    }

    const dirs = Object.keys(this.shareList).length
    let files = 0

    for (const dir of Object.keys(this.shareList)) {
      files += this.shareList[dir].length
    }

    this.client.send('sharedFoldersFiles', dirs, files)
  }

  // fetch the upload speed from speedtest.net's api
  refreshUploadSpeed(done?: (err: Error | null, speed?: number) => void) {
    uploadSpeed((err, speed) => {
      if (err) {
        this.emit('error', err)
        return done?.(err)
      }

      this.uploadSpeed = speed
      this.client.send('sendUploadSpeed', this.uploadSpeed)
      done?.(null, speed)
    })
  }

  // fetch one of our shared files (usually to send to another user)
  getSharedFile(filePath: string) {
    const file = filePath.replace(/\\/g, '/')
    const dir = path.dirname(file)
    const basename = path.basename(file)

    let mappedDir = this.shareList[dir]
    mappedDir = mappedDir ? mappedDir.map((file) => file.file) : []
    const filePos = mappedDir.indexOf(basename)

    if (filePos === -1) {
      return null
    }

    return this.shareList[dir][filePos]
  }

  // check if the transfer is already in progress
  isTransferring(transfer: any, isUpload: boolean) {
    const transfers = isUpload ? this.uploads : this.downloads

    for (const token of Object.keys(transfers)) {
      const c = transfers[token]
      const isSending =
        c.peer.ip === transfer.peer.ip &&
        c.file.file === transfer.file.file &&
        c.dir === transfer.dir

      if (isSending) {
        return true
      }
    }

    return false
  }

  // get the position of an upload for a peer
  getUploadQueuePos(upload) {
    for (let i = 0; i < this.uploadQueue.length; i += 1) {
      const toUpload = this.uploadQueue[i]
      const isQueued =
        toUpload.peer.ip === upload.peer.ip &&
        toUpload.file.file === upload.file.file &&
        toUpload.dir === upload.dir

      if (isQueued) {
        return i
      }
    }

    return -1
  }

  // get the ip and address of a user from their username
  getPeerAddress(
    username: string,
    done: (err: Error | null, peerAddress?: Address) => void
  ) {
    if (this.peerAddresses[username]) {
      return done(null, this.peerAddresses[username])
    }

    this.client.send('getPeerAddress', username)

    const onAddress = (res) => {
      if (res.username === username) {
        clearTimeout(addressTimeout)
        this.removeListener('getPeerAddress', onAddress)

        if (res.ip === '0.0.0.0' && res.port === 0) {
          done(new Error(`${username} is offline.`))
        } else {
          done(null, res)
        }
      }
    }

    const addressTimeout = setTimeout(() => {
      this.removeListener('getPeerAddress', onAddress)
      done(new Error(`timed out fetching ${username} address`))
    }, 5000)

    this.on('getPeerAddress', onAddress)
  }

  // connect to a peer from an IP address and port (and token if available)
  connectToPeerAddress(
    address: Address,
    cType: ConnType,
    done: (err: Error | null, peer?: any) => void
  ) {
    let finished = false

    const connectTimeout = setTimeout(() => {
      done(
        new Error(
          'timed out connecting to address directly:' +
            `${address.ip}:${address.port}`
        )
      )
    }, 5000)

    // try to connect to them directly...
    let peer
    if (cType === 'P') {
      peer = new Peer(address)
    } else if (cType === 'D') {
      peer = new DistribPeer(address)
    }

    peer.token = makeToken()

    peer.once('error', (err) => {
      if (!finished) {
        clearTimeout(connectTimeout)
        finished = true
        done(err)
      }
    })

    peer.attachHandlers(this)
    peer.init(() => {
      if (!finished) {
        clearTimeout(connectTimeout)
        finished = true
        //peer.pierceFirewall();
        peer.send('peerInit', this.username, cType, peer.token)
        done(null, peer)
      }
    })
  }

  // try to establish a connection to a peer with soulseek's server as an
  // intermediate. this is usually done after we try to directly connect
  // to them. don't use this directly
  connectToPeerUsername(
    username: string,
    cType: ConnType,
    done: (err: Error | null, peer?: any) => void
  ) {
    // server let us know the peer couldn't connect to us
    const onCantConnect = (res) => {
      if (res.token === token) {
        clearTimeout(peerTimeout)
        this.removeListener('cantConnectToPeer', onCantConnect)
        this.removeListener('peerConnect', onPeerConnect)
        done(new Error(`peer ${username} can't connect to us at all`))
      }
    }

    // we connected to a peer, but it may not have been the one we fired off
    // here
    const onPeerConnect = (peer) => {
      if (peer.token === token) {
        clearTimeout(peerTimeout)
        this.removeListener('cantConnectToPeer', onCantConnect)
        this.removeListener('peerConnect', onPeerConnect)
        done(null, peer)
      }
    }

    const token = makeToken()
    this.pendingPeers[token] = cType

    const peerTimeout = setTimeout(() => {
      this.removeListener('cantConnectToPeer', onCantConnect)
      this.removeListener('peerConnect', onPeerConnect)
      done(new Error('peer took longer than 5 seconds to connect to us'))
    }, 5000)

    this.on('cantConnectToPeer', onCantConnect)
    this.on('peerConnect', onPeerConnect)
    this.client.send('connectToPeer', token, username, cType)
  }

  // get a Peer instance from a username string by any mean's necessary!
  getPeerByUsername(
    username: string,
    cType: ConnType,
    done: (err: Error | null, peer?: any) => void
  ) {
    // first check our already-connected peers
    if (cType === 'P') {
      for (const ip of Object.keys(this.peers)) {
        const peer = this.peers[ip]

        if (peer.username === username) {
          return done(null, peer)
        }
      }
    }

    this.getPeerAddress(username, (err, address) => {
      if (err) {
        return done(err)
      }

      this.connectToPeerAddress(address, cType, (err, peer) => {
        if (err) {
          // TODO maybe send 1001 here?
          this.connectToPeerUsername(username, cType, done)
          return
        }

        done(null, peer)
      })
    })
  }

  // see which files a user is sharing
  // TODO cache this!!
  getShareFileList(
    username: string,
    done: (err: Error | null, shareList?: any) => void
  ) {
    this.getPeerByUsername(username, 'P', (err, peer) => {
      if (err) {
        return done(err)
      }

      const onShareList = (res) => {
        if (res.peer.username === username) {
          clearTimeout(shareListTimeout)
          this.removeListener('sharedFileList', onShareList)
          done(null, res.shareList)
        }
      }

      const shareListTimeout = setTimeout(() => {
        this.removeListener('sharedFileList', onShareList)
        done(new Error('timed out getting share file list for ' + username))
      }, 15_000) // this is a pretty generous time

      this.on('sharedFileList', onShareList)
      peer.send('getShareFileList')
    })
  }

  // search a specific user's shares
  searchUserShares(
    username: string,
    query: string,
    done: (err: Error | null, res?: any) => void
  ) {
    this.getPeerByUsername(username, 'P', (err, peer) => {
      if (err) {
        return done(err)
      }

      const onSearchResult = (res) => {
        // it's unlikely but we could've generated the same token
        // twice
        if (res.peer.username === username && res.token === token) {
          clearTimeout(searchTimeout)
          this.removeListener('fileSearchResult', onSearchResult)
          done(null, res)
        }
      }

      const token = makeToken()

      const searchTimeout = setTimeout(() => {
        this.removeListener('fileSearchResult', onSearchResult)
        done(new Error('timed out searching share file list for ' + username))
      }, 15_000)

      this.on('fileSearchResult', onSearchResult)
      peer.send('fileSearchRequest', token, query)
    })
  }

  getUserInfo(username: string, done: (err: Error | null, res?: any) => void) {
    this.getPeerByUsername(username, 'P', (err, peer) => {
      if (err) {
        return done(err)
      }

      const onInfoReply = (res) => {
        if (res.peer.username === username) {
          clearTimeout(infoTimeout)
          this.removeListener('userInfoReply', onInfoReply)
          done(null, res)
        }
      }

      const infoTimeout = setTimeout(() => {
        this.removeListener('userInfoReply', onInfoReply)
        done(new Error('timed out fetching user info for ' + username))
      }, 5000)

      this.on('userInfoReply', onInfoReply)
      peer.send('userInfoRequest')
    })
  }

  // request the contents of a specific directory of a peer
  getFolderContents(
    username: string,
    dir: string,
    done: (err: Error | null, contents?: any) => void
  ) {
    dir = dir.replace(/\//g, '\\')

    this.getPeerByUsername(username, 'P', (err, peer) => {
      if (err) {
        return done(err)
      }

      const onFolderResponse = (res) => {
        const resDir = Object.keys(res.requests)[0]

        if (res.peer.username === username && resDir === dir) {
          clearTimeout(folderTimeout)
          this.removeListener('folderContentsResponse', onFolderResponse)
          done(null, res.requests[resDir])
        }
      }

      const folderTimeout = setTimeout(() => {
        this.removeListener('folderContentsResponse', onFolderResponse)
        done(new Error('timed out getting folder response for ' + username))
      }, 5000)

      this.on('folderContentsResponse', onFolderResponse)
      peer.send('folderContentsRequest', dir)
    })
  }

  // download a file from a user. the file should be the full path
  downloadFile(username: string, file: string, fileStart = 0) {
    const downloadStream = new stream.PassThrough()

    this.getPeerByUsername(username, 'P', (err, peer) => {
      if (err) {
        return downloadStream.emit('error', err)
      }

      const token = makeToken()

      const download = {
        file: path.basename(file),
        dir: path.dirname(file),
        fileStart,
        peer,
      }

      // TODO check download sslots
      this.downloads[token] = download

      const onQueue = (res) => {
        if (res.token === token) {
          this.removeListener('queueDownload', onQueue)
          downloadStream.emit('queue')
        }
      }

      const onStart = (res) => {
        if (
          !(
            res.download.file === download.file &&
            res.download.dir === download.dir
          )
        ) {
          return
        }

        this.removeListener('startDownload', onStart)
        this.removeListener('queueDownload', onQueue)

        // this could be the same token we generated, or a new one if
        // they queued us and generated a new transfer request
        const downloadToken = res.token

        const onData = (res) => {
          if (res.token === downloadToken) {
            downloadStream.write(res.data)
          }
        }

        const onEnd = (res) => {
          if (res.token === downloadToken) {
            this.removeListener('endDownload', onEnd)
            this.removeListener('fileData', onData)
            downloadStream.end()
          }
        }

        this.on('fileData', onData)
        this.on('endDownload', onEnd)
      }

      this.on('startDownload', onStart)
      file = file.replace(/\//g, '\\')
      peer.send('transferRequest', 0, token, file)
    })

    return downloadStream
  }

  // search other peers for files
  searchFiles(
    query: string,
    args: { timeout?: number; max?: number } = {},
    done?: (err: Error | null, results?: any[]) => void
  ) {
    args.timeout = args.timeout || 5000
    args.max = args.max || 500

    const searchSpew = new stream.PassThrough({ objectMode: true })

    if (Date.now() - this.lastSearch < 1000) {
      const err = new Error('last search was <1s ago!')
      process.nextTick(() => searchSpew.emit('error', err))
      done(err)
      return searchSpew
    }

    this.lastSearch = Date.now()

    const token = makeToken()

    const results = []
    const onResult = (res) => {
      if (res.token === token) {
        for (const file of res.fileList) {
          if (results.length >= args.max) {
            clearTimeout(searchTimeout)
            this.removeListener('fileSearchResult', onResult)
            searchSpew.end()
            done(null, results)
            return
          }

          const result = {
            username: res.username,
            file: file.file,
            size: file.size,
            bitrate: file.bitrate,
            vbr: file.vbr,
            duration: file.duration,
            slotsFree: res.slotsFree,
            speed: res.speed,
            queueSize: res.queueSize,
          }

          results.push(result)
          searchSpew.write(result)
        }
      }
    }

    const searchTimeout = setTimeout(() => {
      this.removeListener('fileSearchResult', onResult)
      searchSpew.end()
      done(null, results)
    }, args.timeout)

    this.on('fileSearchResult', onResult)
    this.client.send('fileSearch', token, query)

    return searchSpew
  }

  // respond to direct or distributed file search requests
  respondToPeerSearch(username, token, query, something) {
    if (Date.now() - this.lastBroadcastSearch > 5000) {
      this.sendToChildren('search', {
        username,
        token,
        query,
        something,
      })
      this.lastBroadcastSearch = Date.now()
    }

    if (username !== 'fourfish' && Date.now() - this.lastSelfSearch < 10_000) {
      //console.log('too frequent searching bro');
      return
    }

    const files = searchShareList.search(this.shareList, query)

    if (files.length > 0) {
      console.log('found', files.length, 'for', query)

      this.getPeerByUsername(username, 'P', (err, peer) => {
        if (err) {
          return this.emit('error', err)
        }

        this.lastSelfSearch = Date.now()

        peer.send('fileSearchResult', {
          username: this.username,
          token,
          fileList: files,
          slotsFree: Object.keys(this.uploads).length === 0,
          speed: this.uploadSpeed,
          queueSize: 0, // TODO put our real queue size here
        })
      })
    }
  }

  // tell the server about our parent and child information
  refreshParentInfo() {
    this.client.send('haveNoParent', !this.parentPeer)
    this.client.send('parentIp', this.parentPeer ? this.parentPeer.ip : '')
    this.client.send('branchLevel', this.branchLevel)
    this.client.send('branchRoot', this.branchRoot)
    this.client.send('childDepth', Object.keys(this.childPeers).length)
    const atCapacity = Object.keys(this.childPeers).length >= this.maxChildren
    this.client.send('acceptChildren', this.parentPeer && !atCapacity)
    this.sendToChildren('branchLevel', this.branchLevel)
    this.sendToChildren('branchRoot', this.branchRoot)
  }

  sendToChildren(type, ...args) {
    for (const ip of Object.keys(this.childPeers)) {
      const child = this.childPeers[ip]
      child.send(type, ...args)
    }
  }

  connectToNextParent() {
    if (this.potentialParents.length === 0) {
      this.client.send('haveNoParent', true)
      this.client.send('acceptChildren', false)
      return
    }

    const nextParent = this.potentialParents.shift()

    console.log('trying to connect to parent', nextParent)

    this.peerAddresses[nextParent.username] = {
      ip: nextParent.ip,
      port: nextParent.port,
    }

    this.getPeerByUsername(nextParent.username, 'D', (err, peer) => {
      if (err) {
        this.emit('error', err)
        this.connectToNextParent()
        return
      }

      console.log('successfully connected to parent!')
    })
  }
}
