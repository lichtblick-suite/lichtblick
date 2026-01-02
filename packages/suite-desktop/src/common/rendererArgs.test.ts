// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { decodeRendererArg, encodeRendererArg } from "./rendererArgs";

describe("encodeRendererArg & decodeRendererArg", () => {
  it("encodes and decodes", () => {
    const encoded = encodeRendererArg("deepLinks", ["lichtblick://example"]);
    expect(encoded).toEqual("--deepLinks=WyJsaWNodGJsaWNrOi8vZXhhbXBsZSJd");
    expect(decodeRendererArg("deepLinks", ["arg1", encoded, "arg2"])).toEqual([
      "lichtblick://example",
    ]);
  });
});
