// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapTypes } from "@mcap/core";
import type { ZstdModule, ZstdStreaming } from "zstd-codec";

let handlersPromise: Promise<McapTypes.DecompressHandlers> | undefined;
export async function loadDecompressHandlers(): Promise<McapTypes.DecompressHandlers> {
  return await (handlersPromise ??= _loadDecompressHandlers());
}

// eslint-disable-next-line no-underscore-dangle
async function _loadDecompressHandlers(): Promise<McapTypes.DecompressHandlers> {
  const [zstd, decompressLZ4, bzip2] = await Promise.all([
    import("zstd-codec").then(async ({ ZstdCodec }) => {
      return await new Promise<ZstdModule>((resolve) => ZstdCodec.run(resolve));
    }),
    import("wasm-lz4").then(async (mod) => {
      await mod.default.isLoaded;
      return mod.default;
    }),
    import("@foxglove/wasm-bz2").then(async (mod) => await mod.default.init()),
  ]);

  let zstdStreaming: ZstdStreaming | undefined;

  return {
    lz4: (buffer, decompressedSize) => decompressLZ4(buffer, Number(decompressedSize)),

    bz2: (buffer, decompressedSize) =>
      bzip2.decompress(buffer, Number(decompressedSize), { small: false }),

    zstd: (buffer, decompressedSize) => {
      if (!zstdStreaming) {
        zstdStreaming = new zstd.Streaming();
      }
      // We use streaming decompression because the zstd-codec package has a limited (and
      // non-growable) amount of WASM memory, and does not currently support passing the
      // decompressedSize into the simple one-shot decode() function.
      // https://github.com/yoshihitoh/zstd-codec/issues/223
      const result = zstdStreaming.decompressChunks(
        (function* () {
          const chunkSize = 4 * 1024 * 1024;
          const endOffset = buffer.byteOffset + buffer.byteLength;
          for (let offset = buffer.byteOffset; offset < endOffset; offset += chunkSize) {
            yield new Uint8Array(buffer.buffer, offset, Math.min(chunkSize, endOffset - offset));
          }
        })(),
        Number(decompressedSize),
      );
      if (!result) {
        throw new Error("Decompression failed");
      }
      return result;
    },
  };
}
