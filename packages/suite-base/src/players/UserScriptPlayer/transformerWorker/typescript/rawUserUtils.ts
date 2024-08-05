// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import markers from "./userUtils/markers.ts?raw";
import pointClouds from "./userUtils/pointClouds.ts?raw";
import quaternions from "./userUtils/quaternions.ts?raw";
import readers from "./userUtils/readers.ts?raw";
import time from "./userUtils/time.ts?raw";
import types from "./userUtils/types.ts?raw";
import vectors from "./userUtils/vectors.ts?raw";

export default [
  { fileName: "pointClouds.ts", sourceCode: pointClouds },
  { fileName: "quaternions.ts", sourceCode: quaternions },
  { fileName: "readers.ts", sourceCode: readers },
  { fileName: "time.ts", sourceCode: time },
  { fileName: "types.ts", sourceCode: types },
  { fileName: "vectors.ts", sourceCode: vectors },
  { fileName: "markers.ts", sourceCode: markers },
];
