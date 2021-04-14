// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/module.d.ts" />

import ModuleFactory, { BZ2Module } from "@foxglove/wasm-bz2/dist/module";

const wasmUrl = new URL("../dist/module.wasm", import.meta.url);

let loaded = false;
let Module: BZ2Module;

function urlToPath(url: URL): string {
  if (url.protocol !== "file:") {
    return url.pathname;
  }
  // On Windows, new URL("file:///C:/wasm-bz2/dist/module.wasm").pathname -> "/C:/wasm-bz2/dist/module.wasm"
  // In this case, strip the leading `/` off to transform it into a regular filesystem path
  return url.pathname.replace(/^\/([A-Z]):\//, "$1:/");
}

const isLoaded = new Promise<void>((resolve) => {
  ModuleFactory({
    locateFile: () => {
      // The ModuleFactory tries to be smart about how it loads the file path based environment and protocol.
      // In browsers it will try to load the path via _fetch_, however, if it detects file:// prefix it assumes
      // that _fetch_ won't work and tries to fall-back to loading without _fetch_ which fails since we do not
      // provide a fallback function.
      // Use a helper method that returns `wasmUrl.pathname` with an extra check for Windows filesystem paths
      return urlToPath(wasmUrl);
    },
    onRuntimeInitialized: () => {
      loaded = true;
      resolve();
    },
  }).then((module) => (Module = module));
});

export default {
  isLoaded,
  decompress(src: Uint8Array, destSize: number, { small = false } = {}): Uint8Array {
    if (!loaded) {
      throw new Error("wasm-bz2 module not initialized; await isLoaded before calling decompress");
    }
    const srcBuf = Module._malloc(src.byteLength); // eslint-disable-line no-underscore-dangle
    const dstBuf = Module._malloc(destSize); // eslint-disable-line no-underscore-dangle
    Module.HEAPU8.subarray(srcBuf, srcBuf + src.byteLength).set(src);
    try {
      const { code, error, buffer } = Module.decompress(
        dstBuf,
        destSize,
        srcBuf,
        src.byteLength,
        small ? 1 : 0,
      );
      if (code !== 0 || !buffer) {
        throw new Error(`BZ2 decompression failed: ${code} (${error ?? "unknown"})`);
      }
      return new Uint8Array(buffer); // copy out of emscripten heap before freeing
    } finally {
      Module._free(srcBuf); // eslint-disable-line no-underscore-dangle
      Module._free(dstBuf); // eslint-disable-line no-underscore-dangle
    }
  },
};
