// find a query in our sharelist

import { extname } from 'node:path'

// format files into a flattened array with strings suitable for searching
function formatShareList(shareList) {
  let flattened = []

  for (let dir of Object.keys(shareList)) {
    for (const file of shareList[dir]) {
      dir = dir.replace(/\//g, '\\')
      let formatted = dir + ' '
      formatted += file.file.replace(extname(file.file), '')
      formatted = formatted.replace(/[/_\-]/g, ' ')
      formatted = formatted.replace(/[^\d a-z]/gi, '').toLowerCase()
      flattened.push({ dir, file, formatted })
    }
  }

  return flattened
}

function searchShareList(shareList, query, limit = 50) {
  query = query.toLowerCase().replace(/[/_\-]/g, ' ')
  query = query
    .replace(/[^\d a-z]/gi, '')
    .toLowerCase()
    .trim()

  if (query.length < 3) {
    return []
  }

  let found = []
  let formatted = formatShareList(shareList)
  let terms = query.split(' ')

  // ok so it's not actually a pair anymore
  for (const filePair of formatted) {
    let formatted = filePair.formatted

    for (let term of terms) {
      if (!formatted.includes(term)) {
        return
      }
    }

    found.push({
      file: filePair.dir + '\\' + filePair.file.file,
      size: filePair.file.size,
      extension: filePair.file.extension,
      bitrate: filePair.file.bitrate,
      duration: filePair.file.duration,
      vbr: filePair.file.vbr,
    })
  }

  // TODO instead of slicing we should break a for loop
  return found.slice(0, limit)
}

export const search = searchShareList
