import { createReadStream } from 'node:fs'
import net from 'node:net'

import makeToken from '../make-token'
import toPeer from '../message/to-peer'

export default (livelook, peer) => {
  const handlers = {
    error: (err) => livelook.emit('error', err),
    close: () => {
      let isUpload = !!livelook.uploads[peer.fileToken]

      if (isUpload) {
        livelook.emit('endUpload', {
          token: peer.fileToken,
          upload: livelook.uploads[peer.fileToken],
        })

        delete livelook.uploads[peer.fileToken]

        let nextUpload = livelook.uploadQueue.shift()

        if (!nextUpload) {
          return
        }

        let token = nextUpload.token
        delete nextUpload.token

        let file = nextUpload.dir.replace(/\//g, '\\') + '\\'
        file += nextUpload.file.file
        let size = nextUpload.file.size

        livelook.uploads[token] = nextUpload
        nextUpload.peer.send('transferRequest', 1, token, file, size)
      } else {
        livelook.emit('endDownload', { token: peer.fileToken })
        delete livelook.downloads[peer.fileToken]
        // TODO move onto next download maybe?
      }
    },
    // when we receive a file token
    fileToken: (token, start) => {
      let upload = livelook.uploads[token]

      if (!upload) {
        return
      }

      let filePath = './' + upload.dir + '/' + upload.file.file
      let fileStream = createReadStream(filePath, { start })
      fileStream = fileStream.pipe(livelook.uploadThrottler.throttle())
      fileStream.on('error', (err) => {
        peer.socket.end()
        livelook.emit('error', err)
      })
      fileStream.on('end', () => peer.socket.end())
      fileStream.pipe(peer.socket)
    },
    fileData: (data) => {
      livelook.emit('fileData', { token: peer.fileToken, data })
    },
  }

  for (const h of Object.keys(handlers)) peer.on(h, handlers[h])
}
