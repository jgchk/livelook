// client -> server packet factories

import { createHash } from 'node:crypto'

import Message from './writer'

const VERSION = 157
const MINOR = 17

export function login(username, password) {
  let hash = createHash('md5').update(username + password)
  hash = hash.digest('hex')
  const msg = new Message().int32(1).str(username).str(password)
  msg.int32(VERSION).str(hash).int32(MINOR)
  return msg
}
export function setWaitPort(port) {
  return new Message().int32(2).int32(port)
}
export function getPeerAddress(username) {
  return new Message().int32(3).str(username)
}
export function addUser(username) {
  return new Message().int32(5).str(username)
}
export function getUserStatus(username) {
  return new Message().int32(7).str(username)
}
export function sayChatroom(room, message) {
  return new Message().int32(13).str(room).str(message)
}
export function joinRoom(room) {
  return new Message().int32(14).str(room)
}
export function leaveRoom(room) {
  return new Message().int32(15).str(room)
}
export function connectToPeer(token, username, type) {
  return new Message().int32(18).int32(token).str(username).str(type)
}
export function messageUser(username, message) {
  return new Message().int32(22).str(username).str(message)
}
export function messageAcked(id) {
  return new Message().int32(23).int32(id)
}
export function fileSearch(token, query) {
  return new Message().int32(26).int32(token).str(query)
}
export function setStatus(online) {
  return new Message().int32(28).int32(online ? 2 : 1)
}
export function ping() {
  return new Message().int32(32)
}
export function sharedFoldersFiles(folderCount, fileCount) {
  return new Message().int32(35).int32(folderCount).int32(fileCount)
}
export function userSearch(username, token, query) {
  return new Message().int32(42).int32(token).str(query)
}
export function addThingILike(item) {
  return new Message().int32(51).str(item)
}
export function removeThingILike(item) {
  return new Message().int32(52).str(item)
}
export function recommendations() {
  return new Message().sInt32(54)
}
export function globalRecommendations() {
  return new Message().sInt32(56)
}
export function userInterests(username) {
  return new Message().int32(57).str(username)
}
export function roomList(username) {
  return new Message().int32(57).str(username)
}
export function privilegedUsers() {
  return new Message().int32(69)
}
export function haveNoParent(haveParent) {
  return new Message().int32(71).int8(haveParent)
}
export function parentIp(ip) {
  return new Message().int32(73).ipAddr(ip)
}
export function checkPrivileges() {
  return new Message().int32(92)
}
export function acceptChildren(accept) {
  return new Message().int32(100).int8(accept)
}
export function wishlistSearch(token, query) {
  return new Message().int32(103).int32(token).str(query)
}
export function similarUsers() {
  return new Message().int32(110)
}
export function itemRecommendations(item) {
  return new Message().sInt32(111).str(item)
}
export function itemSimilarUsers(item) {
  return new Message().int32(112).str(item)
}
export function roomTickerSet(room, ticker) {
  return new Message().int32(117).str(room).str(ticker)
}
export function addThingIHate(item) {
  return new Message().int32(118).str(item)
}
export function removeThingIHate(item) {
  return new Message().int32(119).str(item)
}
export function roomSearch(room, token, query) {
  return new Message().int32(120).int32(token).str(query)
}
export function sendUploadSpeed(speed) {
  return new Message().int32(121).int32(speed)
}
export function givePrivileges(username, days) {
  return new Message().int32(123).str(username).int32(days)
}
export function notifyPrivileges(token, username) {
  return new Message().int32(124).int32(token).str(username)
}
export function ackNotifyPrivileges() {
  return new Message().int32(125)
}
export function branchLevel(level) {
  return new Message().int32(126).int32(level)
}
export function branchRoot(root) {
  return new Message().int32(127).str(root)
}
export function childDepth(depth) {
  return new Message().int32(129).int32(depth)
}
export function privateRoomAddUser(room, username) {
  return new Message().int32(134).str(room).str(username)
}
export function privateRoomRemoveUser(room, username) {
  return new Message().int32(135).str(room).str(username)
}
export function privateRoomDismember(room) {
  return new Message().int32(136).str(room)
}
export function privateRoomDisown(room) {
  return new Message().int32(137).str(room)
}
export function privateRoomToggle(enable) {
  return new Message().int32(141).str(enable)
}
export function changePassword(password) {
  return new Message().int32(142).str(password)
}
export function privateRoomAddOperator(room, username) {
  return new Message().int32(143).str(room).str(username)
}
export function privateRoomRemoveOperator(room, username) {
  return new Message().int32(144).str(room).str(username)
}
export function messageUsers(usernames, message) {
  const msg = new Message().int32(149).int32(usernames.length)
  for (const username of usernames) msg.str(username)
  msg.str(message)
  return msg
}
export function askPublicChat() {
  return new Message().int32(150)
}
export function stopPublicChat() {
  return new Message().int32(151)
}
export function cantConnectToPeer(token, username) {
  return new Message().int32(1001).int32(token).str(username)
}
