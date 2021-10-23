// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { GlTf } from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/gltf";

type TypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array;

export type GlbModel = {
  json: GlTf;
  accessors: TypedArray[];
  images: ImageBitmap[];
};
