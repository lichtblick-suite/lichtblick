// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { decodeRendererArg, encodeRendererArg } from "./rendererArgs";

describe("encodeRendererArg & decodeRendererArg", () => {
  it("encodes and decodes", () => {
    const encoded = encodeRendererArg("deepLinks", ["foxglove://example"]);
    expect(encoded).toEqual("--deepLinks=WyJmb3hnbG92ZTovL2V4YW1wbGUiXQ==");
    expect(decodeRendererArg("deepLinks", ["arg1", encoded, "arg2"])).toEqual([
      "foxglove://example",
    ]);
  });
});
