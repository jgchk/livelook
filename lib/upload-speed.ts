import speedTest from 'speedtest-net'

export default (done: (err: Error | null, speed?: number) => void) => {
  /*let test = speedTest({ maxTime: 5000 });
    let finished = false;

    test.on('data', data => {
        if (!finished) {
            finished = true;
            done(null, data.speeds.upload * 1024 * 1024);
        }
    });

    test.on('error', err => {
        if (!finished) {
            finished = true;
            done(err);
        }
    });*/

  done(null, 614_400)
}
