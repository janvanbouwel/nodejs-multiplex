const BITS = 7;
const MSB = 1 << BITS;
const MAX_VAL = MSB - 1;

export function encodeByte(num: number): Buffer {
  return Buffer.from([num]);
}

export function encodeInteger(num: number): Buffer {
  const result = Buffer.alloc(5);
  let pos = 0;

  while (num > MAX_VAL) {
    pos = result.writeUInt8((num & MAX_VAL) | MSB, pos);
    num >>>= BITS;
  }
  pos = result.writeUInt8(num & MAX_VAL, pos);
  return result.subarray(0, pos);
}

export function encodeString(str: string): [Buffer, Buffer] {
  const strBuffer = Buffer.from(str);
  return [encodeInteger(strBuffer.length), strBuffer];
}

export class Uint8ArrayReader {
  pos = 0;
  buffer: Buffer;
  constructor(array: Uint8Array) {
    this.buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  }

  readByte(): number {
    const byte = this.buffer.readUInt8(this.pos);
    this.pos++;
    return byte;
  }

  readInteger(): number {
    let num = 0;
    let byte;
    let shift = 0;
    while (((byte = this.readByte()), byte >= MSB)) {
      num |= (byte & MAX_VAL) << shift;
      shift += BITS;
    }
    num |= (byte & MAX_VAL) << shift;

    return num;
  }

  readString(): string {
    const len = this.readInteger();
    const str = this.buffer.subarray(this.pos, this.pos + len).toString();
    this.pos += len;

    return str;
  }

  rest(): Buffer {
    return this.buffer.subarray(this.pos);
  }
}
