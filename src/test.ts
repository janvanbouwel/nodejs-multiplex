import streamConsumers from "node:stream/consumers";

import { Multiplex } from "./index.js";
import { Duplex, PassThrough } from "node:stream";
import assert from "node:assert";
import {
  Uint8ArrayReader,
  encodeByte,
  encodeInteger,
  encodeString,
} from "./encoding.js";

function testEncode() {
  const str = "abcdef";
  const encoded = encodeString(str);

  const buf = Buffer.concat([
    encodeByte(56),
    encodeInteger(20),
    encodeInteger(5120),
    ...encoded,
  ]);

  const reader = new Uint8ArrayReader(buf);

  const readByte = reader.readByte();
  assert.strictEqual(readByte, 56);
  assert.strictEqual(reader.readInteger(), 20);
  assert.strictEqual(reader.readInteger(), 5120);
  const result = reader.readString();
  assert.strictEqual(result, str);
}

testEncode();

async function test() {
  const chan1 = new PassThrough();
  const chan2 = new PassThrough();

  const left = Duplex.from({ readable: chan1, writable: chan2 });
  const right = Duplex.from({ readable: chan2, writable: chan1 });

  const msAlice = new Multiplex(left);
  const msBob = new Multiplex(right);

  const abcAlice = msAlice.create("abc");
  const abcBob = msBob.create("abc");

  const defAlice = msAlice.create("def");
  const defBob = msBob.create("def");

  const payload = "This is a test payload, it should arrive fine :)";

  defAlice.write(Buffer.from(payload));
  abcAlice.end(Buffer.from(payload));
  defAlice.end(Buffer.from(payload));

  assert.strictEqual(await streamConsumers.text(abcBob), payload);
  assert.strictEqual(await streamConsumers.text(defBob), payload + payload);
}

await test();
