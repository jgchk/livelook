// peer -> client packet decoders

import { inflateSync } from 'node:zlib'

import { Uint64LE } from 'int64-buffer'

import { files, shares } from './decode-list'
import MessageReader from './reader'
import Message from './reader'

export type UserInfoReply = {
  type: 'userInfoReply'
  description: string
  picture?: Buffer
  totalUpload: number
  queueSize: number
  slotsFree: number
}

export type TransferRequest = {
  type: 'transferRequest'
  direction: number
  token: number
  file: string
  size?: Uint64LE
}

export type TransferResponse = {
  type: 'transferResponse'
  token: number
  allowed: boolean
  size?: Uint64LE
  reason?: string
}

export default {
  0: (msg: MessageReader) => ({
    type: 'pierceFirewall',
    token: msg.int32(),
  }),
  1: (msg: MessageReader) => ({
    type: 'peerInit',
    username: msg.str(),
    cType: msg.str(),
    token: msg.int32(),
  }),
  4: () => ({ type: 'getShareFileList' }),
  5: (msg: MessageReader) => ({
    type: 'sharedFileList',
    fileList: shares(msg),
  }),
  8: (msg: MessageReader) => ({
    type: 'fileSearchRequest',
    token: msg.int32(),
    query: msg.str(),
  }),
  9: (msg: MessageReader) => {
    const unzippedData = msg.data.subarray(msg.pointer, msg.size())
    // TODO move this to the decoder and make this async
    const unzipped = new Message(inflateSync(unzippedData))

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
  16: (msg: MessageReader) => {
    const description = msg.str()

    const hasPicture = msg.int8()

    let picture: Buffer | undefined
    if (hasPicture) {
      picture = msg.file()
    }

    const totalUpload = msg.int32()
    const queueSize = msg.int32()
    const slotsFree = msg.int8()

    const decoded: UserInfoReply = {
      type: 'userInfoReply',
      description,
      picture,
      totalUpload,
      queueSize,
      slotsFree,
    }

    return decoded
  },
  // this might be unofficial, but nicotine supports it!
  22: (msg: MessageReader) => ({
    type: 'messageUser',
    id: msg.int32(),
    timestamp: new Date(msg.int32() * 1000),
    username: msg.str(),
    message: msg.str(),
    isAdmin: (() => {
      try {
        return !!msg.int8()
      } catch {
        return false
      }
    })(),
  }),
  36: (msg: MessageReader) => {
    const decoded = {
      type: 'folderContentsRequest',
      dirs: [],
    }

    const fileCount = msg.int32()
    for (let i = 0; i < fileCount; i += 1) {
      decoded.dirs.push(msg.str())
    }

    return decoded
  },
  37: (msg: MessageReader) => {
    const decoded = {
      type: 'folderContentsResponse',
      requests: {},
    }

    const unzippedData = msg.data.subarray(msg.pointer, msg.size())
    const unzipped = new Message(inflateSync(unzippedData))

    const dirRequests = unzipped.int32()

    for (let i = 0; i < dirRequests; i += 1) {
      decoded.requests[unzipped.str()] = shares(unzipped, false)
    }

    return decoded
  },
  40: (msg: MessageReader) => {
    const decoded: TransferRequest = {
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
  41: (msg: MessageReader) => {
    const decoded: TransferResponse = {
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
  43: (msg: MessageReader) => ({ type: 'queueUpload', file: msg.str() }),
  44: (msg: MessageReader) => ({
    type: 'placeInQueue',
    file: msg.str(),
    place: msg.int32(),
  }),
  46: (msg: MessageReader) => ({ type: 'uploadFailed', file: msg.str() }),
  50: (msg: MessageReader) => ({
    type: 'queueFailed',
    file: msg.str(),
    reason: msg.str(),
  }),
  51: (msg: MessageReader) => ({
    type: 'placeInQueueRequest',
    file: msg.str(),
  }),
  52: () => ({ type: 'uploadQueueNotification' }),
}
