import Message from './writer'

export function ping(something?: number) {
  const msg = new Message().int8(0)

  if (something !== undefined) {
    msg.int32(something)
  }

  return msg
}
export function search(args: {
  something?: number
  username: string
  token: number
  query: string
}) {
  const msg = new Message().int8(3).int32(args.something ?? 0)
  msg.str(args.username).int32(args.token).str(args.query)
  return msg
}
export function branchLevel(level: number) {
  return new Message().int8(4).int32(level)
}
export function branchRoot(root: number) {
  return new Message().int8(5).int32(root)
}
export function childDepth(depth: number) {
  return new Message().int8(8).int32(depth)
}

export { peerInit, pierceFirewall } from './to-peer'
