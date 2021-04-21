// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
declare module "@foxglove/wasm-bz2/wasm/module" {
  export type BZ2Module = EmscriptenModule & {
    decompress: (
      destPtr: number,
      dstSize: number,
      srcPtr: number,
      srcSize: number,
      small: number,
    ) => { code: number; error?: string; buffer?: Uint8Array };
  };

  const ModuleFactory: EmscriptenModuleFactory<BZ2Module>;
  export default ModuleFactory;
}
