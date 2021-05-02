// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "wasm-lz4" {
  function decompress(...args: unknown[]): Buffer;
  namespace decompress {
    const isLoaded: Promise<boolean>;
  }

  export default decompress;
}
