// peer -> client packet decoders

import { inflateSync } from 'node:zlib'

import { files, shares } from './decode-list'
import Message from './reader'

export default {
  0: (msg) => ({
    type: 'pierceFirewall',
    token: msg.int32(),
  }),
  1: (msg) => ({
    type: 'peerInit',
    username: msg.str(),
    cType: msg.str(),
    token: msg.int32(),
  }),
  4: (msg) => ({ type: 'getShareFileList' }),
  5: (msg) => ({ type: 'sharedFileList', fileList: shares(msg) }),
  8: (msg) => ({
    type: 'fileSearchRequest',
    token: msg.int32(),
    query: msg.str(),
  }),
  9: (msg) => {
    let unzipped = msg.data.slice(msg.pointer, msg.data.length)
    // TODO move this to the decoder and make this async
    unzipped = new Message(inflateSync(unzipped))

    return {
      type: 'fileSearchResult',
      username: unzipped.str(),
      token: unzipped.int32(),
      fileList: files(unzipped),
      slotsFree: !!unzipped.int8(),
      speed: unzipped.int32(),
      queueSize: unzipped.int64(),
    }
  },
  15: () => ({ type: 'userInfoRequest' }),
  16: (msg) => {
    let decoded = {
      type: 'userInfoReply',
      description: msg.str(),
    }

    let hasPicture = msg.int8()

    if (hasPicture) {
      decoded.picture = msg.file()
    }

    decoded.totalUpload = msg.int32()
    decoded.queueSize = msg.int32()
    decoded.slotsFree = msg.int8()

    return decoded
  },
  // this might be unofficial, but nicotine supports it!
  22: (msg) => {
    let decoded = {
      type: 'messageUser',
      id: msg.int32(),
      timestamp: new Date(msg.int32() * 1000),
      username: msg.str(),
      message: msg.str(),
    }

    try {
      decoded.isAdmin = !!msg.int8()
    } catch {
      decoded.isAdmin = false
    }

    return decoded
  },
  36: (msg) => {
    let decoded = {
      type: 'folderContentsRequest',
      dirs: [],
    }

    let fileCount = msg.int32()
    for (let i = 0; i < fileCount; i += 1) {
      decoded.dirs.push(msg.str())
    }

    return decoded
  },
  37: (msg) => {
    let decoded = {
      type: 'folderContentsResponse',
      requests: {},
    }

    let unzipped = msg.data.slice(msg.pointer, msg.length)
    unzipped = new Message(inflateSync(unzipped))

    let dirRequests = unzipped.int32()

    for (let i = 0; i < dirRequests; i += 1) {
      decoded.requests[unzipped.str()] = shares(unzipped, false)
    }

    return decoded
  },
  40: (msg) => {
    let decoded = {
      type: 'transferRequest',
      direction: msg.int32(),
      token: msg.int32(),
      file: msg.str(),
    }

    if (decoded.direction) {
      decoded.size = msg.int64()
    }

    return decoded
  },
  41: (msg) => {
    let decoded = {
      type: 'transferResponse',
      token: msg.int32(),
      allowed: !!msg.int8(),
    }

    if (decoded.allowed) {
      decoded.size = msg.int64()
    } else {
      decoded.reason = msg.str()
    }

    return decoded
  },
  43: (msg) => ({ type: 'queueUpload', file: msg.str() }),
  44: (msg) => ({ type: 'placeInQueue', file: msg.str(), place: msg.int32() }),
  46: (msg) => ({ type: 'uploadFailed', file: msg.str() }),
  50: (msg) => ({ type: 'queueFailed', file: msg.str(), reason: msg.str() }),
  51: (msg) => ({ type: 'placeInQueueRequest', file: msg.str() }),
  52: () => ({ type: 'uploadQueueNotification' }),
}
