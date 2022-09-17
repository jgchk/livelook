import { Uint64LE } from 'int64-buffer'

export default class MessageReader {
  data: Buffer
  pointer: number

  constructor(buffer: Buffer) {
    this.data = buffer
    this.pointer = 0
  }

  int8() {
    return this.read8()
  }

  int32() {
    return this.read32()
  }

  sInt32() {
    return this.readS32()
  }

  int64() {
    return this.read64()
  }

  str() {
    return this.readStr()
  }

  file() {
    return this.readFile()
  }

  rawHexStr(val: number) {
    return this.readRawHexStr(val)
  }

  ipAddr() {
    return this.readIpAddr()
  }

  size() {
    return this.data.length
  }

  seek(val: number) {
    this.pointer += val
  }

  read8() {
    const val = this.data.readUInt8(this.pointer)
    this.pointer += 1
    return val
  }

  read32() {
    const val = this.data.readUInt32LE(this.pointer)
    this.pointer += 4
    return val
  }

  readS32() {
    const val = this.data.readInt32LE(this.pointer)
    this.pointer += 4
    return val
  }

  read64() {
    const val = new Uint64LE(this.data.slice(this.pointer, this.pointer + 8))
    this.pointer += 8
    return val
  }

  readStr() {
    const size = this.data.readUInt32LE(this.pointer)
    this.pointer += 4

    const str = this.data.toString('utf8', this.pointer, this.pointer + size)
    this.pointer += size
    return str
  }

  // read the embedded image files
  readFile() {
    const size = this.data.readUInt32LE(this.pointer)
    this.pointer += 4

    const buff = this.data.slice(this.pointer, this.pointer + size)
    this.pointer += size
    return buff
  }

  readRawHexStr(size: number) {
    const str = this.data.toString('hex', this.pointer, this.pointer + size)
    this.pointer += size
    return str
  }

  readIpAddr() {
    const ip = []

    for (let i = 0; i < 4; i += 1) {
      ip.push(this.read8())
    }

    return ip.reverse().join('.')
  }

  // this shud b toBuffer() TODO
  getBuff() {
    const b = Buffer.alloc(4)
    b.writeUInt32LE(this.data.length, 0)
    this.data = Buffer.concat([b, this.data])
    return this.data
  }
}
