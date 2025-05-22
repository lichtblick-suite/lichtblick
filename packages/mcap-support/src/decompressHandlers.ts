// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapTypes } from "@mcap/core";

let handlersPromise: Promise<McapTypes.DecompressHandlers> | undefined;
export async function loadDecompressHandlers(): Promise<McapTypes.DecompressHandlers> {
  return await (handlersPromise ??= _loadDecompressHandlers());
}

// eslint-disable-next-line no-underscore-dangle
async function _loadDecompressHandlers(): Promise<McapTypes.DecompressHandlers> {
  const [decompressZstd, decompressLZ4, bzip2] = await Promise.all([
    import("@lichtblick/wasm-zstd").then(async (mod) => {
      await mod.isLoaded;
      return mod.decompress;
    }),
    import("@lichtblick/wasm-lz4").then(async (mod) => {
      await mod.default.isLoaded;
      return mod.default;
    }),
    import("@lichtblick/wasm-bz2").then(async (mod) => await mod.default.init()),
  ]);

  return {
    lz4: (buffer, decompressedSize): Uint8Array => {
      const decompressed = decompressLZ4(buffer, Number(decompressedSize));
      return new Uint8Array(decompressed);
    },

    bz2: (buffer, decompressedSize): Uint8Array => {
      const decompressed = bzip2.decompress(buffer, Number(decompressedSize), { small: false });
      return new Uint8Array(decompressed);
    },

    zstd: (buffer, decompressedSize): Uint8Array => {
      const decompressed = decompressZstd(buffer, Number(decompressedSize));
      return new Uint8Array(decompressed);
    },
  };
}
