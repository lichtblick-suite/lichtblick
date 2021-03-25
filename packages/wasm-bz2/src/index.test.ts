// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { TextDecoder } from "util";

import Bzip2 from ".";

describe("wasm-bz2", () => {
  it("decodes simple example and reports errors", async () => {
    await Bzip2.isLoaded;
    const data = Buffer.from(
      "QlpoOTFBWSZTWX78x88AAAMZgEACEAAyRoiQIAAiCMmmxCAaAMxKhYKglaLuSKcKEg/fmPng",
      "base64",
    );
    expect(() => Bzip2.decompress(data, 13)).toThrow(
      "BZ2 decompression failed: -8 (BZ_OUTBUFF_FULL)",
    );
    expect(new TextDecoder().decode(Bzip2.decompress(data, 14))).toEqual("hello wasm-bz2");
    expect(new TextDecoder().decode(Bzip2.decompress(data, 100))).toEqual("hello wasm-bz2");
  });
});
