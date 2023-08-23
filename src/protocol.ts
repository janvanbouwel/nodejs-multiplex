import { ChunkedStream } from "@janvanbouwel/chunked-stream";
import { Uint8ArrayReader, encodeByte, encodeString } from "./encoding.js";

enum MessageKind {
  DATA = 1,
  END = 2,
  DESTROY = 3,
  DESTROY_ERR = 4,
}

export function createDecode(
  onData: (id: string, data: Buffer) => void,
  onEnd: (id: string) => void,
  onDestroy: (id: string, err: boolean) => void,
): (data: Uint8Array) => void {
  return (data: Uint8Array) => {
    const reader = new Uint8ArrayReader(data);

    const kind: MessageKind = reader.readByte();

    const id = reader.readString();

    if (kind === MessageKind.END) {
      onEnd(id);
      return;
    }
    if (kind === MessageKind.DESTROY) {
      onDestroy(id, false);
      return;
    }
    if (kind === MessageKind.DESTROY_ERR) {
      onDestroy(id, true);
      return;
    }

    const chunk = reader.rest();
    onData(id, chunk);
  };
}

export function encodeWrite(
  stream: ChunkedStream,
  id: string,
  chunk: Buffer,
  callback: (error?: Error | null | undefined) => void,
) {
  if (chunk.length === 0) return;

  stream.write(
    [encodeByte(MessageKind.DATA), ...encodeString(id), chunk],
    callback,
  );
}

export function sendEnd(
  stream: ChunkedStream,
  id: string,
  callback: (error?: Error | null | undefined) => void,
) {
  stream.write([encodeByte(MessageKind.END), ...encodeString(id)], callback);
}

export function sendDestroy(
  stream: ChunkedStream,
  id: string,
  callback: (error?: Error | null | undefined) => void,
) {
  stream.write(
    [encodeByte(MessageKind.DESTROY), ...encodeString(id)],
    callback,
  );
}

export function sendDestroyErr(
  stream: ChunkedStream,
  id: string,
  callback: (error?: Error | null | undefined) => void,
) {
  stream.write(
    [encodeByte(MessageKind.DESTROY_ERR), ...encodeString(id)],
    callback,
  );
}
