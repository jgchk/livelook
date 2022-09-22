// server -> client packet decoders

import { join, list } from './decode-room'
import MessageReader from './reader'

type AddUserExists = {
  type: 'addUser'
  username: string
  exists: number
  status: number
  speed: number
  downloadNum: number
  files: number
  folders: number
  country?: string
}

type AddUserDoesntExist = {
  type: 'addUser'
  username: string
  exists: number
}

export default {
  1: (msg: MessageReader) => {
    const decoded = { type: 'login', success: msg.int8() }
    decoded[decoded.success ? 'motd' : 'reason'] = msg.str()
    return decoded
  },
  3: (msg: MessageReader) => ({
    type: 'getPeerAddress',
    username: msg.str(),
    ip: msg.ipAddr(),
    port: msg.int32(),
  }),
  5: (msg: MessageReader) => {
    const decoded: AddUserDoesntExist = {
      type: 'addUser',
      username: msg.str(),
      exists: msg.int8(),
    }

    if (!decoded.exists) {
      return decoded
    }

    const status = msg.int32()
    const speed = msg.int32()
    // TODO not sure what this is
    const downloadNum = msg.int32()
    const files = msg.int32()
    const folders = msg.int32()
    // may not be implemented
    let country: string | undefined
    try {
      country = msg.str()
    } catch {
      // discard
    }

    const decoded2: AddUserExists = {
      ...decoded,
      status,
      speed,
      downloadNum,
      files,
      folders,
      country,
    }

    return decoded2
  },
  7: (msg: MessageReader) => ({
    type: 'getUserStatus',
    username: msg.str(),
    status: msg.int32(),
    privileged: msg.int8(),
  }),
  13: (msg: MessageReader) => ({
    type: 'sayChatroom',
    room: msg.str(),
    username: msg.str(),
    message: msg.str(),
  }),
  14: join,
  15: (msg: MessageReader) => ({
    type: 'leaveRoom',
    room: msg.str(),
  }),
  16: (msg: MessageReader) => ({
    type: 'userJoinedRoom',
    room: msg.str(),
    username: msg.str(),
    status: msg.int32(),
    speed: msg.int32(),
    downloadNum: msg.int64(),
    files: msg.int32(),
    folders: msg.int32(),
    slotsFree: msg.int32(),
    country: msg.str(),
  }),
  17: (msg: MessageReader) => ({
    type: 'userLeftRoom',
    room: msg.str(),
    username: msg.str(),
  }),
  18: (msg: MessageReader) => ({
    type: 'connectToPeer',
    username: msg.str(),
    cType: msg.str(),
    ip: msg.ipAddr(),
    port: msg.int32(),
    token: msg.int32(),
    privileged: msg.int8(),
  }),
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
  26: (msg: MessageReader) => {
    return {
      type: 'fileSearch',
      username: msg.str(),
      query: msg.str(),
    }
  },
  32: () => ({ type: 'ping' }),
  // this is apparently deprecated, but it's still being sent to us
  36: (msg: MessageReader) => ({
    type: 'getUserStats',
    username: msg.str(),
    speed: msg.int32(),
    downloadNum: msg.int64(),
    files: msg.int32(),
    directories: msg.int32(),
  }),
  41: () => ({ type: 'relog' }),
  54: (msg: MessageReader) => {
    const decoded = {
      type: 'globalRecommendations',
      recommendations: [],
      unrecommendations: [],
    }

    const recCount = msg.int32()
    for (let i = 0; i < recCount; i += 1) {
      decoded.recommendations.push({
        name: msg.str(),
        count: msg.int32(),
      })
    }

    const unrecCount = msg.int32()
    for (let i = 0; i < unrecCount; i += 1) {
      decoded.unrecommendations.push({
        name: msg.str(),
        count: msg.int32(),
      })
    }

    return decoded
  },
  57: (msg: MessageReader) => {
    const decoded = { type: 'userInterests', liked: [], hated: [] }

    const likedCount = msg.int32()
    for (let i = 0; i < likedCount; i += 1) {
      decoded.liked.push(msg.str())
    }

    const hatedCount = msg.int32()
    for (let i = 0; i < hatedCount; i += 1) {
      decoded.hated.push(msg.str())
    }

    return decoded
  },
  64: list,
  69: (msg: MessageReader) => {
    const decoded = { type: 'privilegedUsers', users: [] }

    const userCount = msg.int32()
    for (let i = 0; i < userCount; i += 1) {
      decoded.users.push(msg.str())
    }

    return decoded
  },
  83: (msg: MessageReader) => ({
    type: 'parentMinSpeed',
    minSpeed: msg.int32(),
  }),
  84: (msg: MessageReader) => ({
    type: 'parentSpeedRatio',
    ratio: msg.int32(),
  }),
  91: (msg: MessageReader) => ({
    type: 'addToPrivileged',
    username: msg.str(),
  }),
  92: (msg: MessageReader) => ({
    type: 'checkPrivileges',
    timeLeft: msg.int32(),
  }),
  93: (msg: MessageReader) => ({
    type: 'searchRequest',
    distributedCode: msg.int8(),
    unknown: msg.int32(),
    username: msg.str(),
    token: msg.int32(),
    query: msg.str(),
  }),
  102: (msg: MessageReader) => {
    const decoded = { type: 'netInfo', parents: [] }

    const parentCount = msg.int32()

    for (let i = 0; i < parentCount; i += 1) {
      decoded.parents.push({
        username: msg.str(),
        ip: msg.ipAddr(),
        port: msg.int32(),
      })
    }

    return decoded
  },
  104: (msg: MessageReader) => ({
    type: 'wishlistInterval',
    interval: msg.int32(),
  }),
  110: (msg: MessageReader) => {
    const decoded = { type: 'similarUsers', users: [] }

    const userCount = msg.int32()
    for (let i = 0; i < userCount; i += 1) {
      decoded.users.push({
        username: msg.str(),
        status: msg.int32(),
      })
    }

    return decoded
  },
  111: (msg: MessageReader) => {
    const decoded = {
      type: 'itemRecommendations',
      item: msg.str(),
      recommendations: [],
    }

    const recCount = msg.int32()
    for (let i = 0; i < recCount; i += 1) {
      decoded.recommendations.push({
        name: msg.str(),
        count: msg.int32(),
      })
    }

    return decoded
  },
  112: (msg: MessageReader) => {
    const decoded = {
      type: 'itemSimilarUsers',
      item: msg.str(),
      users: [],
    }

    const userCount = msg.int32()
    for (let i = 0; i < userCount; i += 1) {
      decoded.users.push({ username: msg.str(), count: msg.int32() })
    }

    return decoded
  },
  113: (msg: MessageReader) => {
    const decoded = {
      type: 'roomTickerState',
      room: msg.str(),
      users: {},
    }

    const userCount = msg.int32()
    for (let i = 0; i < userCount; i += 1) {
      // TODO make sure this isn't reversed - this is how nicotine does it
      decoded.users[msg.str()] = msg.str()
    }

    return decoded
  },
  114: (msg: MessageReader) => ({
    type: 'roomTickerAdd',
    room: msg.str(),
    username: msg.str(),
    ticker: msg.str(),
  }),
  115: (msg: MessageReader) => ({
    type: 'roomTickerRemove',
    room: msg.str(),
    username: msg.str(),
  }),
  125: (msg: MessageReader) => ({
    type: 'ackNotifyPrivileges',
    token: msg.int32(),
  }),
  // members we can alter in a private room
  133: (msg: MessageReader) => {
    const decoded = {
      type: 'privateRoomUsers',
      users: [],
    }

    const userCount = msg.int32()
    for (let i = 0; i < userCount; i += 1) {
      decoded.users.push(msg.str())
    }

    return decoded
  },
  134: (msg: MessageReader) => ({
    type: 'privateRoomAddUser',
    room: msg.str(),
    username: msg.str(),
  }),
  135: (msg: MessageReader) => ({
    type: 'privateRoomRemoveUser',
    room: msg.str(),
    username: msg.str(),
  }),
  139: (msg: MessageReader) => ({ type: 'privateRoomAdded', room: msg.str() }),
  140: (msg: MessageReader) => ({
    type: 'privateRoomRemoved',
    room: msg.str(),
  }),
  141: (msg: MessageReader) => ({
    type: 'privateRoomToggle',
    enable: msg.int8(),
  }),
  142: (msg: MessageReader) => ({
    type: 'changePassword',
    password: msg.str(),
  }),
  143: (msg: MessageReader) => ({
    type: 'privateRoomAddOperator',
    room: msg.str(),
    username: msg.str(),
  }),
  144: (msg: MessageReader) => ({
    type: 'privateRoomRemoveOperator',
    room: msg.str(),
    username: msg.str(),
  }),
  145: (msg: MessageReader) => ({
    type: 'privateRoomOperatorAdded',
    room: msg.str(),
  }),
  146: (msg: MessageReader) => ({
    type: 'privateRoomOperatorRemoved',
    room: msg.str(),
  }),
  148: (msg: MessageReader) => {
    const decoded = {
      type: 'privateRoomOwned',
      room: msg.str(),
      operators: [],
    }

    const opCount = msg.int32()
    for (let i = 0; i < 0; i += 1) {
      decoded.operators.push(msg.str())
    }

    return decoded
  },
  152: (msg: MessageReader) => ({
    type: 'publicChat',
    room: msg.str(),
    username: msg.str(),
    message: msg.str(),
  }),
  1001: (msg: MessageReader) => ({
    type: 'cantConnectToPeer',
    token: msg.int32(),
  }),
}
