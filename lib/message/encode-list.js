import { deflateSync } from 'node:zlib'

import Message from './index'

function encodeFiles(packet, fileList) {
  packet.int32(fileList.length)

  for (let file of fileList) {
    packet.int8(1)
    packet.str(file.file)
    packet.int64(file.size)
    packet.str(file.extension)

    let attrs = []

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
function encodeShares(packet, shareList, compress = true) {
  let dirs = Object.keys(shareList)
  let compressed = new Message()

  compressed.int32(dirs.length)

  for (let dir of dirs) {
    compressed.str(dir.replace(/\//g, '\\'))
    encodeFiles(compressed, shareList[dir])
  }

  if (compress) {
    compressed = deflateSync(compressed.data)
  }

  packet.writeBuffer(compressed)
}

export const files = encodeFiles
export const shares = encodeShares
