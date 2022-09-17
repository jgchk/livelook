// create a fileList object for ./messages/file-list
// pass in a directory and the function will walk through it and build a POJO
// http://www.museek-plus.org/wiki/SoulseekProtocol#PeerCode5

import { stat } from 'node:fs'
import { basename, dirname, extname } from 'node:path'

import { mapSeries } from 'async'
import { parseFile } from 'music-metadata'
import * as rr from 'recursive-readdir'

export type ShareList =
  | (Metadata | PartialMetadata)[]
  | Record<string, (Metadata | PartialMetadata)[]>

export type Metadata = {
  file: string
  extension: string
  size: number
  bitrate: number
  duration: number
  vbr: boolean
}

export type PartialMetadata = {
  file: string
  extension: string
  size: number
  bitrate?: number
  duration?: number
  vbr?: boolean
}

function getMetaData(
  file: string,
  done: (err: Error | null, metadata?: Metadata | PartialMetadata) => void
) {
  let found = false

  stat(file, (err, stats) => {
    if (err) {
      return done(err)
    }

    const populated: Metadata | PartialMetadata = {
      file,
      size: stats.size,
      extension: extname(file).slice(1),
    }

    parseFile(file)
      .then((metadata) => {
        if (found) {
          return
        }

        found = true

        const vbr = metadata.format.codecProfile
        populated.vbr = vbr ? /v/i.test(vbr) : false
        populated.bitrate = Math.floor(metadata.format.bitrate / 1000)
        populated.duration = Math.floor(metadata.format.duration)

        done(null, populated)
      })
      .catch(() => {
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
function buildFileList(
  files: string[],
  absolute = true,
  done: (err: Error | null, fileList?: ShareList) => void
) {
  mapSeries(files, getMetaData, (err, files) => {
    if (err) {
      return done(err)
    }

    let fileList: ShareList

    if (absolute) {
      fileList = []

      for (const file of files) {
        fileList.push({
          file: file.file,
          size: file.size,
          extension: file.extension,
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

        if (!fileList[fileDir]) {
          fileList[fileDir] = []
        }

        fileList[fileDir].push({
          file: fileName,
          size: file.size,
          extension: file.extension,
          bitrate: file.bitrate,
          duration: file.duration,
          vbr: file.vbr,
        })
      }
    }

    done(null, fileList)
  })
}

function buildShareList(
  dir: string,
  done: (
    err: Error | null,
    fileList?:
      | (Metadata | PartialMetadata)[]
      | Record<string, (Metadata | PartialMetadata)[]>
  ) => void
) {
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
