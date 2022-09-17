// client -> peer packet factories

import { deflateSync } from 'node:zlib'

import { files, shares } from './encode-list'
import Message from './index'

export function pierceFirewall(token) {
  return new Message().int8(0).int32(token)
}
export function peerInit(username, cType, token) {
  return new Message().int8(1).str(username).str(cType).int32(token)
}
export function getShareFileList() {
  return new Message().int32(4)
}
export function sharedFileList(shareList) {
  let msg = new Message().int32(5)
  shares(msg, shareList)
  return msg
}
export function fileSearchRequest(token, query) {
  return new Message().int32(8).int32(token).str(query)
}
export function fileSearchResult(args) {
  let msg = new Message().str(args.username).int32(args.token)
  files(msg, args.fileList)
  msg.int8(args.slotsFree).int32(args.speed).int64(args.queueSize)
  return new Message().int32(9).writeBuffer(deflateSync(msg.data))
}
export function userInfoRequest() {
  return new Message().int32(15)
}
export function userInfoReply(args) {
  let msg = new Message().int32(16).str(args.description)

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
export function folderContentsRequest(folders) {
  folders = Array.isArray(folders) ? folders : [folders]
  let msg = new Message().int32(36).int32(folders.length)
  for (const folder of folders) msg.str(folder)
  return msg
}
export function folderContentsResponse(shareLists, fileLists) {
  let zipped = new Message()

  zipped.int32(Object.keys(fileLists).length)

  for (const dir of Object.keys(fileLists)) {
    shares(zipped, shareLists[dir], false)
  }

  zipped = deflateSync(zipped.data)

  let msg = new Message().int32(37)
  msg.writeBuffer(deflateSync(zipped.data))
  return msg
}
export function transferRequest(isUpload, token, file, size) {
  let msg = new Message().int32(40)
  msg.int32(+isUpload) // direction 1 for upload
  msg.int32(token).str(file)

  if (isUpload) {
    msg.int64(size)
  }

  return msg
}
export function transferResponse(token, allowed, size) {
  let msg = new Message().int32(41).int32(token)

  if (allowed) {
    msg.int8(true).int64(size)
  } else {
    msg.int8(false).str(size) // reason
  }

  return msg
}
export function queueUpload(file) {
  return new Message().int32(43).str(file)
}
export function placeInQueue(file, place) {
  return new Message().int32(44).str(file).int32(place)
}
export function uploadFailed(file) {
  return new Message().int32(46).str(file)
}
export function queueFailed(file, reason) {
  return new Message().int32(50).str(file).str(reason)
}
export function placeInQueueRequest(file) {
  return new Message().int32(51).str(file)
}
