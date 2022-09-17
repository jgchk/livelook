// create a fileList object for ./messages/file-list
// pass in a directory and the function will walk through it and build a POJO
// http://www.museek-plus.org/wiki/SoulseekProtocol#PeerCode5

import { stat } from 'node:fs'
import { basename, dirname, extname } from 'node:path'

import { mapSeries } from 'async'
import { parseFile } from 'music-metadata'
import * as rr from 'recursive-readdir'

function getMetaData(file, done) {
  let found = false

  stat(file, (err, stats) => {
    let populated = { file }

    if (err) {
      return done(err)
    }

    populated.size = stats.size

    parseFile(file)
      .then((metadata) => {
        if (found) {
          return
        }

        found = true

        let vbr = metadata.format.codecProfile
        vbr = vbr ? /v/i.test(vbr) : false

        populated.bitrate = Math.floor(metadata.format.bitrate / 1000)
        populated.duration = Math.floor(metadata.format.duration)
        populated.vbr = vbr
        done(null, populated)
      })
      .catch((error) => {
        // ignoring because this is likely on a non-media file, and not
        // fatal
        if (!found) {
          done(null, populated)
        }
      })
  })
}

// absolute attribute is enabled for search results. if false, returns an object
// keys representing directories containing arrays of files. otherwise just
// returns the array of files
function buildFileList(files, absolute = true, done) {
  mapSeries(files, getMetaData, (err, files) => {
    if (err) {
      return done(err)
    }

    let fileList

    if (absolute) {
      fileList = []

      for (const file of files) {
        const fileExt = extname(file.file).slice(1)

        fileList.push({
          file: file.file,
          size: file.size,
          extension: fileExt,
          bitrate: file.bitrate,
          duration: file.duration,
          vbr: file.vbr,
        })
      }
    } else {
      fileList = {}

      for (const file of files) {
        const fileDir = dirname(file.file)
        const fileName = basename(file.file)
        const fileExt = extname(file.file).slice(1)

        if (!fileList[fileDir]) {
          fileList[fileDir] = []
        }

        fileList[fileDir].push({
          file: fileName,
          size: file.size,
          extension: fileExt,
          bitrate: file.bitrate,
          duration: file.duration,
          vbr: file.vbr,
        })
      }
    }

    done(null, fileList)
  })
}

function buildShareList(dir, done) {
  rr(dir, (err, files) => {
    if (err) {
      return done(err)
    }

    buildFileList(files, false, done)
  })
}

export const metaData = getMetaData
export const files = buildFileList
export const shares = buildShareList
