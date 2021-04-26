// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// https://github.com/gkjohnson/xacro-parser/issues/56
declare module "xacro-parser" {
  export { XacroParser } from "xacro-parser/src/XacroParser";
  export { default as XacroLoader } from "xacro-parser/src/XacroLoader";
}
