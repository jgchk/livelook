// client -> peer packet factories

import { deflateSync } from 'node:zlib'

import { ConnType } from '../utils'
import { files, ShareFile, ShareList, shares } from './encode-list'
import Message from './writer'

export function pierceFirewall(token: number) {
  return new Message().int8(0).int32(token)
}
export function peerInit(username: string, cType: ConnType, token: number) {
  return new Message().int8(1).str(username).str(cType).int32(token)
}
export function getShareFileList() {
  return new Message().int32(4)
}
export function sharedFileList(shareList: ShareList) {
  const msg = new Message().int32(5)
  shares(msg, shareList)
  return msg
}
export function fileSearchRequest(token: number, query: string) {
  return new Message().int32(8).int32(token).str(query)
}
export function fileSearchResult(args: {
  username: string
  token: number
  fileList: ShareFile[]
  slotsFree: number
  speed: number
  queueSize: number
}) {
  const msg = new Message().str(args.username).int32(args.token)
  files(msg, args.fileList)
  msg.int8(args.slotsFree).int32(args.speed).int64(args.queueSize)
  return new Message().int32(9).writeBuffer(deflateSync(msg.data))
}
export function userInfoRequest() {
  return new Message().int32(15)
}
export function userInfoReply(args: {
  description: string
  picture?: string
  uploadSlots: number
  queueSize: number
  slotsFree: number
  uploadsFrom: number
}) {
  const msg = new Message().int32(16).str(args.description)

  if (args.picture) {
    msg.int8(true).file(args.picture)
  } else {
    msg.int8(false)
  }

  msg.int32(args.uploadSlots).int32(args.queueSize).int8(args.slotsFree)
  // who we accept uploads from
  msg.int32(args.uploadsFrom)

  return msg
}
export function messageAcked() {
  return new Message().int32(23)
}
export function folderContentsRequest(folders: string[]) {
  folders = Array.isArray(folders) ? folders : [folders]
  const msg = new Message().int32(36).int32(folders.length)
  for (const folder of folders) msg.str(folder)
  return msg
}
export function folderContentsResponse(
  shareLists: Record<string, ShareList>,
  fileLists: Record<string, ShareFile[]>
) {
  const zippedMsg = new Message()

  zippedMsg.int32(Object.keys(fileLists).length)

  for (const dir of Object.keys(fileLists)) {
    shares(zippedMsg, shareLists[dir], false)
  }

  const msg = new Message().int32(37)
  msg.writeBuffer(deflateSync(zippedMsg.data))
  return msg
}
export function transferRequest(
  isUpload: boolean,
  token: number,
  file: string,
  size: number
) {
  const msg = new Message().int32(40)
  msg.int32(+isUpload) // direction 1 for upload
  msg.int32(token).str(file)

  if (isUpload) {
    msg.int64(size)
  }

  return msg
}
export function transferResponse(
  args:
    | { token: number; allowed: true; size: number }
    | { token: number; allowed: false; reason: string }
) {
  const msg = new Message().int32(41).int32(args.token)

  if (args.allowed === true) {
    msg.int8(true).int64(args.size)
  } else {
    msg.int8(false).str(args.reason) // reason
  }

  return msg
}
export function queueUpload(file: string) {
  return new Message().int32(43).str(file)
}
export function placeInQueue(file: string, place: number) {
  return new Message().int32(44).str(file).int32(place)
}
export function uploadFailed(file: string) {
  return new Message().int32(46).str(file)
}
export function queueFailed(file: string, reason: string) {
  return new Message().int32(50).str(file).str(reason)
}
export function placeInQueueRequest(file: string) {
  return new Message().int32(51).str(file)
}
