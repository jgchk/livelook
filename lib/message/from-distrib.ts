import MessageReader from './reader'

export type Ping = {
  type: 'ping'
  something?: number
}

export default {
  0: (msg: MessageReader) => {
    const decoded: Ping = { type: 'ping' }

    if (msg.size() >= 4) {
      decoded.something = msg.int32()
    }

    return decoded
  },
  3: (msg: MessageReader) => ({
    type: 'search',
    something: msg.int32(),
    username: msg.str(),
    token: msg.int32(),
    query: msg.str(),
  }),
  4: (msg: MessageReader) => ({
    type: 'branchLevel',
    level: msg.int32(),
  }),
  5: (msg: MessageReader) => ({
    type: 'branchRoot',
    root: msg.str(),
  }),
  7: (msg: MessageReader) => ({
    type: 'childDepth',
    depth: msg.int32(),
  }),
}
