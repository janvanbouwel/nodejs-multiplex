import { Duplex } from "node:stream";

export class MSChannel extends Duplex {
  constructor(
    readonly id: string,
    write: (
      chunk: Buffer,
      cb: (error?: Error | null | undefined) => void,
    ) => void,
    destroy: (
      error: Error | null,
      callback: (error: Error | null) => void,
    ) => void,
    final: (callback: (error?: Error | null | undefined) => void) => void,
  ) {
    super({
      write: (chunk, _, cb) => {
        if (!(chunk instanceof Buffer)) {
          cb(new Error("Invalid data."));
          return;
        }
        write(chunk, cb);
      },
      read: () => {
        return;
      },
      destroy,
      final,
      allowHalfOpen: true,
    });
  }
}
