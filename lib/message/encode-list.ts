import { deflateSync } from 'node:zlib'

import MessageWriter from './writer'

export type ShareFile = {
  file: string
  size: number
  extension: string
  bitrate?: number
  duration?: number
  vbr?: number
}

export type ShareList = Record<string, ShareFile[]>

function encodeFiles(packet: MessageWriter, fileList: ShareFile[]) {
  packet.int32(fileList.length)

  for (const file of fileList) {
    packet.int8(1)
    packet.str(file.file)
    packet.int64(file.size)
    packet.str(file.extension)

    const attrs: number[] = []

    if (file.bitrate) {
      attrs.push(file.bitrate)

      if (file.duration) {
        attrs.push(file.duration, file.vbr)
      }
    }

    packet.int32(attrs.length)
    for (const [i, attr] of attrs.entries()) {
      packet.int32(i)
      packet.int32(attr)
    }
  }
}

// http://www.museek-plus.org/wiki/SoulseekProtocol#PeerCode5
function encodeShares(
  packet: MessageWriter,
  shareList: ShareList,
  compress = true
) {
  const dirs = Object.keys(shareList)
  const sharesMsg = new MessageWriter()

  sharesMsg.int32(dirs.length)

  for (const dir of dirs) {
    sharesMsg.str(dir.replace(/\//g, '\\'))
    encodeFiles(sharesMsg, shareList[dir])
  }

  const compressedData = compress ? deflateSync(sharesMsg.data) : sharesMsg.data

  packet.writeBuffer(compressedData)
}

export const files = encodeFiles
export const shares = encodeShares
