import { Duplex, finished } from "node:stream";
import { EventEmitter } from "node:events";
import {
  sendEnd,
  encodeWrite,
  createDecode,
  sendDestroy,
  sendDestroyErr,
} from "./protocol.js";
import { MSChannel } from "./multiplex-socket.js";
import crypto from "crypto";
import {
  ChunkedStream,
  createChunkedStream,
} from "@janvanbouwel/chunked-stream";
import { isUint8Array } from "node:util/types";

/**
 * A multiplexer that creates duplex streams associated with an id, that are written to/read from an original given stream (for example a net.Socket).
 *
 * Events:
 *   `'close': () => void'`
 *   `'new-channel': (ms: MSChannel) => void`
 */
export class Multiplex extends EventEmitter {
  private stream: ChunkedStream;

  readonly emitNew: boolean;

  private routes = new Map<string, MSChannel>();

  isClosed() {
    return this.stream.closed;
  }

  constructor(stream: Duplex, emitNew = false) {
    super();

    this.emitNew = emitNew;

    this.stream = createChunkedStream(stream);

    void this.startReading();
  }

  private decode = createDecode(
    this.route.bind(this),
    this.onEnd.bind(this),
    this.onDestroy.bind(this),
  );

  private route(id: string, data: Buffer) {
    let ms = this.routes.get(id);

    if (!ms && this.emitNew) {
      ms = this.create(id);
      this.emit("new-channel", ms);
    }

    if (ms) {
      ms.push(data);
    }
  }

  private onEnd(channel: string) {
    const ms = this.routes.get(channel);
    if (!ms) return;
    ms.push(null);
  }

  private onDestroy(channel: string, err: boolean) {
    const ms = this.routes.get(channel);
    if (!ms) return;
    if (err) ms.destroy(Error("Channel was destroyed"));
    else ms.destroy();
  }

  create(id: string): MSChannel {
    if (this.isClosed()) throw new Error("This Multiplex has been closed.");
    if (this.routes.has(id))
      throw new Error("Cant use same channel name multiple times");

    const ms = new MSChannel(
      id,
      (chunk, cb) => {
        this.write(id, chunk, cb);
      },
      (err, cb) => {
        if (err)
          this.sendDestroyErr(id, () => {
            cb(err);
          });
        else
          this.sendDestroy(id, () => {
            cb(err);
          });
      },
      (cb) => {
        this.sendEnd(id, cb);
      },
    );

    this.routes.set(id, ms);

    finished(ms, () => {
      this.routes.delete(id);
    });

    return ms;
  }

  createRandom(): [MSChannel, string] {
    let routeId: string;
    do {
      routeId = "p" + crypto.randomBytes(4).toString("base64");
    } while (this.routes.has(routeId));
    return [this.create(routeId), routeId];
  }

  private sendEnd(
    channel: string,
    callback: (error?: Error | null | undefined) => void,
  ) {
    sendEnd(this.stream, channel, callback);
  }

  private sendDestroy(
    channel: string,
    callback: (error?: Error | null | undefined) => void,
  ) {
    sendDestroy(this.stream, channel, callback);
  }

  private sendDestroyErr(
    channel: string,
    callback: (error?: Error | null | undefined) => void,
  ) {
    sendDestroyErr(this.stream, channel, callback);
  }

  private write(
    id: string,
    chunk: Buffer,
    callback: (error?: Error | null | undefined) => void,
  ) {
    encodeWrite(this.stream, id, chunk, callback);
  }

  private async startReading(): Promise<void> {
    try {
      for await (const chunk of this.stream) {
        if (!isUint8Array(chunk)) break;
        this.decode(chunk);
      }
    } catch (error) {
      console.log(error);
    }
    this.routes.forEach((val) => {
      val.destroy(Error("underlying stream of this multi closed"));
    });
    this.emit("close");
  }
}
