// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "zstd-codec" {
  class Simple {
    // eslint-disable-next-line no-restricted-syntax
    public decompress(compressed_bytes: Uint8Array): Uint8Array | null;
  }
  class Streaming {
    // eslint-disable-next-line no-restricted-syntax
    public decompressChunks(chunks: Iterable<Uint8Array>, size_hint?: number): Uint8Array | null;
  }

  export type { Simple as ZstdSimple };
  export type { Streaming as ZstdStreaming };

  export type ZstdModule = {
    Simple: typeof Simple;
    Streaming: typeof Streaming;
  };

  export const ZstdCodec: {
    run(callback: (zstd: ZstdModule) => void): void;
  };
}
