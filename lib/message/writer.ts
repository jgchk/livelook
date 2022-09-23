import { Uint64LE } from 'int64-buffer'

export default class MessageWriter {
  data: Buffer
  pointer: number

  constructor() {
    this.data = Buffer.alloc(0)
    this.pointer = 0
  }

  int8(val: number | boolean) {
    return this.write8(val)
  }

  int32(val: number) {
    return this.write32(val)
  }

  sInt32(val: number) {
    return this.writeS32(val)
  }

  int64(val: number) {
    return this.write64(val)
  }

  str(val: string) {
    return this.writeStr(val)
  }

  file(val: string) {
    return this.writeFile(val)
  }

  rawHexStr(val: string) {
    return this.writeRawHexStr(val)
  }

  ipAddr(val: number[] | string) {
    return this.writeIpAddr(val)
  }

  size() {
    return this.data.length
  }

  seek(val: number) {
    this.pointer += val
  }

  write8(val: number | boolean) {
    const b = Buffer.alloc(1)
    if (typeof val === 'number') {
      b.writeUInt8(val, 0)
    } else {
      b.writeUInt8(val ? 1 : 0, 0)
    }
    this.data = Buffer.concat([this.data, b])
    this.pointer += 1
    return this
  }

  write32(val: number) {
    const b = Buffer.alloc(4)
    b.writeUInt32LE(val, 0)
    this.data = Buffer.concat([this.data, b])
    this.pointer += 4
    return this
  }

  writeS32(val: number) {
    const b = Buffer.alloc(4)
    b.writeInt32LE(val, 0)
    this.data = Buffer.concat([this.data, b])
    this.pointer += 4
    return this
  }

  write64(val: number) {
    const b = new Uint64LE(val).toBuffer()
    this.data = Buffer.concat([this.data, b])
    this.pointer += 8
    return this
  }

  writeStr(val: string) {
    // convert to buff
    let b = Buffer.from(val, 'utf8')
    const s = Buffer.alloc(4)
    s.writeUInt32LE(b.length, 0)

    // write length
    b = Buffer.concat([s, b])

    // write text
    this.data = Buffer.concat([this.data, b])
    this.pointer += b.length
    return this
  }

  writeFile(val: string) {
    // convert to buff
    let b = Buffer.from(val, 'utf8')
    const s = Buffer.alloc(4)
    s.writeUInt32LE(b.length, 0)

    // write length
    b = Buffer.concat([s, b])

    // write file
    this.data = Buffer.concat([this.data, b])
    this.pointer += b.length
    return this
  }

  writeRawHexStr(val: string) {
    const b = Buffer.from(val, 'hex')
    this.data = Buffer.concat([this.data, b])
    this.pointer += b.length
    return this
  }

  writeBuffer(buff: Buffer) {
    this.data = Buffer.concat([this.data, buff])
    this.pointer += buff.length
    return this
  }

  writeIpAddr(ip: number[] | string) {
    ip = Array.isArray(ip) ? ip : ip.split('.').map(Number.parseInt)
    for (const num of ip) this.int8(num)
    return this
  }

  // this shud b toBuffer() TODO
  getBuff() {
    const b = Buffer.alloc(4)
    b.writeUInt32LE(this.data.length, 0)
    this.data = Buffer.concat([b, this.data])
    return this.data
  }
}
