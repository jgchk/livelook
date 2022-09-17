import { connect } from 'nat-pmp'
import { get_gateway_ip } from 'network'

// TODO add a timer that automatically re-opens a port once ttl runs out
// also unmap ports on process.exit

export default function (done) {
  get_gateway_ip((err, gateway) => {
    if (err) {
      this.emit('error', err)
      return done(err)
    }

    let natpmpClient = connect(gateway)
    natpmpClient.on('error', (error) => this.emit('error', err))

    let natpmpTimeout = setTimeout(() => {
      natpmpClient.close()
      let err = new Error(
        'unable to connect to nat-pmp. try enabling ' +
          `upnp or forward port ${this.port} at http://${gateway}`
      )
      this.emit('error', err)
      done(err)
    }, 5000)

    natpmpClient.portMapping(
      {
        private: this.port,
        public: this.port,
        ttl: 3600, // TODO obv increase this
      },
      (err, res) => {
        clearTimeout(natpmpTimeout)
        natpmpClient.close()

        if (!err) {
          this.pmp = res
          this.emit('waitPort', this.pmp.public)
        }

        done(err)
      }
    )
  })
}
