// confirm our peer server is accepting outside connections

import { get } from 'node:http'

export default (port, done) => {
  const url = `http://tools.slsknet.org/porttest.php?port=${port}`
  let finished = false

  get(url, (res) => {
    let body = ''

    res.on('data', (data) => (body += data))

    res.on('end', () => {
      body = body.toString()

      if (!finished) {
        finished = true
        done(null, body.includes(`Port: ${port}/tcp open`))
      }
    })
  }).on('error', (err) => {
    if (err && !finished) {
      finished = true
      done(err)
    }
  })
}
